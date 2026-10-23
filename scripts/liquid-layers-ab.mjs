/**
 * B2 液体分层的 A/B 实测（同一构建、同一页面、同一液位，只差 B2 的三层）。
 *
 * 为什么不用「回退文件再 build」做 before：这个工作树里同时有多个 worker 在写（第 3/4/5/6 轮
 * 并发跑同一目录），任何 git checkout / stash 都会把别人的半成品带走。所以 before 用**注入 CSS 关掉 B2 三层**
 * 来做对照 —— 器皿几何、液位、布局、字体、构建全都一致，唯一变量就是这三层（外加两条旧渐变回落到 B2 前的 stop-opacity）。
 *
 * 量的是像素，不是 DOM 属性：
 *   ① exp03（烧杯 + 容量瓶装水）→ 液面盘峰值 / 盘面中位 / 液柱 30%·55%·80% 三段
 *   ② exp01（交付页真倒一次水，液位 0.22）→ 同上
 *   ③ /scene-preview?contents=beaker=naoh,cuso4,water（Cu(OH)₂ 真沉淀）→ 中段液体 vs 器底沉积带、堆顶行间落差
 *
 * 亮度口径 L = 0.2126R + 0.7152G + 0.0722B（0..255），纸白台面 ≈ 246。
 * 只取液体包围盒中间 44% 列，避开两侧器壁与横向体积渐变。
 *
 * 用法：
 *   PLAYWRIGHT_BROWSERS_PATH="C:/Users/<user>/AppData/Local/ms-playwright" \
 *   BASE_URL=http://localhost:3001 OUT=<json> DPR=3 node scripts/liquid-layers-ab.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const SHOTS = path.join(os.tmpdir(), "chemlab-shots");
const OUT = process.env.OUT ?? path.join(SHOTS, "liquid-layers-ab.json");
const DPR = Number(process.env.DPR ?? 3);

/** B2 前的样子：三层关掉 + 两条旧渐变回落到 B2 之前的 stop-opacity（偏移量无法用 CSS 改，差异已记在提交信息里）。 */
const OFF_CSS = `
[data-liquid-layer="surface-sheen"],[data-liquid-layer="surface-rim"],[data-liquid-layer="sediment"]{display:none!important}
linearGradient[id^="liqTop-"] stop:nth-of-type(1){stop-opacity:0.30}
linearGradient[id^="liqTop-"] stop:nth-of-type(2){stop-opacity:0.04}
linearGradient[id^="liqDeep-"] stop:nth-of-type(2){stop-opacity:0.06}
linearGradient[id^="liqDeep-"] stop:nth-of-type(3){stop-opacity:0.20}
`;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
const fix = (v) => (Number.isFinite(v) ? +v.toFixed(1) : null);

async function waitHydrated(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-demo-id='demo-finish']") ?? document.querySelector("button");
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 30000 },
  );
}

/** 量一台器皿：返回液面盘与液柱三段的亮度，以及图层清单。 */
async function readVessel(shot, page, vesselId) {
  const geom = await page.evaluate((id) => {
    const art = document.querySelector(`[data-vessel-art='${id}']`);
    if (!art) return null;
    const body = art.querySelector("[data-liquid-layer='body']") ?? art.querySelector("[data-liquid-rect]");
    const surf = art.querySelector("[data-liquid-surface]");
    const sediment = art.querySelector("[data-liquid-layer='sediment']");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const cs = (layer) => {
      const el = art.querySelector(`[data-liquid-layer='${layer}']`);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { display: s.display, opacity: s.opacity };
    };
    return {
      liquid: box(body),
      surface: box(surf),
      sediment: box(sediment),
      level: art.querySelector("[data-vessel-liquid]")?.getAttribute("data-liquid-level") ?? null,
      fill: body ? getComputedStyle(body).fill : null,
      layers: Array.from(art.querySelectorAll("[data-liquid-layer]")).map((el) => el.getAttribute("data-liquid-layer")),
      sedimentDisplay: cs("sediment")?.display ?? null,
      surfaceRimDisplay: cs("surface-rim")?.display ?? null,
      surfaceSheenDisplay: cs("surface-sheen")?.display ?? null,
    };
  }, vesselId);
  if (!geom?.liquid) return { geom, rows: null };

  const liq = geom.liquid;
  const left = Math.max(0, Math.round((liq.x - 2) * DPR));
  const top = Math.max(0, Math.round((liq.y - 2) * DPR));
  const width = Math.max(1, Math.round((liq.w + 4) * DPR));
  const height = Math.max(1, Math.round((liq.h + 4) * DPR));
  const { data, info } = await sharp(shot)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const x0 = Math.round(info.width * 0.28);
  const x1 = Math.round(info.width * 0.72);
  const rows = [];
  for (let row = 0; row < info.height; row += 1) {
    const vals = [];
    for (let x = x0; x < x1; x += 1) {
      const i = (row * info.width + x) * info.channels;
      vals.push(lum(data[i], data[i + 1], data[i + 2]));
    }
    rows.push({ row, med: median(vals), peak: Math.max(...vals), min: Math.min(...vals) });
  }
  return { geom, rows };
}

/** 液面盘 / 液柱三段。液体很浅时整柱被液面盘覆盖，就只报盘面，不硬凑液柱数字。 */
function metrics(geom, rows) {
  const H = rows.length;
  const ry = Math.max(2, Math.round((geom.surface.h / 2) * DPR));
  const discRows = rows.slice(3, Math.min(H - 2, Math.max(5, Math.round(ry * 0.85))));
  const out = {
    heightPx: H,
    ryPx: ry,
    discPeak: fix(Math.max(...discRows.map((r) => r.peak))),
    discMed: fix(median(discRows.map((r) => r.med))),
    body: null,
    surfaceGain: null,
    depthDrop: null,
    monotone: null,
  };
  const bodyRows = rows.slice(Math.min(H - 3, Math.max(4, Math.round(ry))), H - 3);
  if (bodyRows.length >= 8) {
    const at = (f) => bodyRows[Math.floor((bodyRows.length - 1) * f)];
    const b30 = at(0.3);
    const b55 = at(0.55);
    const b80 = at(0.8);
    out.body = { b30: fix(b30.med), b55: fix(b55.med), b80: fix(b80.med) };
    out.surfaceGain = fix(out.discPeak - b30.med);
    out.depthDrop = fix(b30.med - b80.med);
    out.monotone = b30.med >= b55.med && b55.med >= b80.med;
  }
  out.profile = rows.map((r) => Math.round(r.med)).join(" ");
  return out;
}

/** 沉淀带：中段液体 vs 器底 88% 处，以及堆顶行间最大落差（读成「积了一层」还是「下半截更暗」）。 */
function sedimentMetrics(rows) {
  const H = rows.length;
  const midRow = rows[Math.floor(H * 0.5)];
  const sedRow = rows[Math.floor(H * 0.88)];
  let edge = 0;
  for (let i = Math.floor(H * 0.5); i < H - 1; i += 1) edge = Math.max(edge, Math.abs(rows[i].med - rows[i + 1].med));
  return {
    midL: fix(midRow.med),
    sedimentL: fix(sedRow.med),
    sedimentMinusMid: fix(sedRow.med - midRow.med),
    edgeStep: fix(edge),
  };
}

const browser = await chromium.launch();
const result = { base: BASE, dpr: DPR, at: new Date().toISOString(), scenes: [] };
fs.mkdirSync(SHOTS, { recursive: true });


/** 器皿元素的外扩裁切框（sharp 要 left/top/width/height，且截图是 DPR 倍尺寸）。 */
async function cropBox(page, vesselId) {
  const r = await page.evaluate((id) => {
    const el = document.querySelector(`[data-vessel-art='${id}']`);
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, vesselId);
  return {
    left: Math.max(0, Math.round((r.x - 6) * DPR)),
    top: Math.max(0, Math.round((r.y - 6) * DPR)),
    width: Math.round((r.w + 12) * DPR),
    height: Math.round((r.h + 12) * DPR),
  };
}

/** 对一台器皿做 on/off 两拍：先量当前（B2 开），再注入 OFF_CSS 量一次。 */
async function sample(page, scene, vesselId, { crop = false } = {}) {
  const shotOn = await page.screenshot();
  const on = await readVessel(shotOn, page, vesselId);
  if (crop && on.geom?.liquid) {
    const box = await cropBox(page, vesselId);
    const file = path.join(SHOTS, `liquid-${scene}-${vesselId}-on.png`);
    await sharp(shotOn).extract(box).toFile(file);
    result.crops = result.crops ?? [];
    result.crops.push(file);
  }

  await page.addStyleTag({ content: OFF_CSS });
  await page.waitForTimeout(320);
  const shotOff = await page.screenshot();
  const off = await readVessel(shotOff, page, vesselId);
  if (crop && off.geom?.liquid) {
    const box = await cropBox(page, vesselId);
    const file = path.join(SHOTS, `liquid-${scene}-${vesselId}-off.png`);
    await sharp(shotOff).extract(box).toFile(file);
    result.crops.push(file);
  }

  const rec = {
    scene,
    vessel: vesselId,
    level: on.geom?.level ?? null,
    fill: on.geom?.fill ?? null,
    layers: on.geom?.layers ?? [],
    offHideOk: {
      sediment: off.geom?.sedimentDisplay === "none",
      surfaceRim: off.geom?.surfaceRimDisplay === "none",
      surfaceSheen: off.geom?.surfaceSheenDisplay === "none",
    },
    on: on.rows ? metrics(on.geom, on.rows) : null,
    off: off.rows ? metrics(off.geom, off.rows) : null,
    sediment: on.rows ? sedimentMetrics(on.rows) : null,
  };
  result.scenes.push(rec);
  return rec;
}

/* ---------------- ① exp03：烧杯 + 容量瓶各装水 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.goto(BASE + "/exp/exp03?force=1", { waitUntil: "networkidle" });
  await waitHydrated(page);
  await page.waitForTimeout(1200);
  const beaker = await sample(page, "exp03", "beaker", { crop: true });
  // 容量瓶：同一页，需要先撤掉 OFF 样式才准，所以另开一页
  const page2 = await ctx.newPage();
  await page2.goto(BASE + "/exp/exp03?force=1", { waitUntil: "networkidle" });
  await waitHydrated(page2);
  await page2.waitForTimeout(1200);
  await sample(page2, "exp03", "volumetric", { crop: true });
  void beaker;
  await ctx.close();
}

/* ---------------- ② exp01：交付页真倒一次水 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.goto(BASE + "/exp/exp01?force=1", { waitUntil: "networkidle" });
  await waitHydrated(page);
  let ok = false;
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("1");
    await page.waitForTimeout(700);
  }
  const src = page.locator("[data-demo-id='demo-scene-reagent-water']").first();
  const box = await src.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 16, box.y + box.height / 2 + 8, { steps: 4 });
    const spot = await page.evaluate(() => {
      const cue = document.querySelector("[data-drop-kind='vessel'][data-cue='true']");
      const el = cue ?? document.querySelector("[data-demo-id='demo-scene-vessel-beaker']");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
    });
    if (spot) {
      await page.mouse.move(spot.x, spot.y, { steps: 10 });
      await page.waitForTimeout(180);
      await page.mouse.up();
      ok = true;
    }
  }
  await page.waitForTimeout(2200);
  const rec = await sample(page, "exp01", "beaker", { crop: true });
  rec.drag = ok;
  await ctx.close();
}

/* ---------------- ③ 沉淀：Cu(OH)₂（拖拽走不到这一态，用 ?contents 摆好） ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.goto(BASE + "/scene-preview?contents=beaker=naoh,cuso4,water", { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__chemLabDemoScene), null, { timeout: 30000 });
  await page.waitForTimeout(1400);
  await sample(page, "sediment", "beaker", { crop: true });
  await ctx.close();
}

await browser.close();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

const rows = result.scenes.map((s) => ({
  scene: s.scene,
  vessel: s.vessel,
  level: s.level,
  "on discPeak": s.on?.discPeak ?? "-",
  "off discPeak": s.off?.discPeak ?? "-",
  "on discMed": s.on?.discMed ?? "-",
  "off discMed": s.off?.discMed ?? "-",
  "on b30/55/80": s.on?.body ? `${s.on.body.b30}/${s.on.body.b55}/${s.on.body.b80}` : "-",
  "off b30/55/80": s.off?.body ? `${s.off.body.b30}/${s.off.body.b55}/${s.off.body.b80}` : "-",
  "on depth-": s.on?.depthDrop ?? "-",
  "off depth-": s.off?.depthDrop ?? "-",
  "sed mid": s.sediment?.midL ?? "-",
  "sed bot": s.sediment?.sedimentL ?? "-",
  "sed-mid": s.sediment?.sedimentMinusMid ?? "-",
  "edge step": s.sediment?.edgeStep ?? "-",
}));
console.log("BASE", BASE, "→", OUT);
console.table(rows);
for (const s of result.scenes) {
  console.log(`${s.scene}/${s.vessel} layers:`, s.layers.join(","), "| off-hide ok:", JSON.stringify(s.offHideOk));
  if (s.on?.profile) console.log(`  on  profile: ${s.on.profile}`);
  if (s.off?.profile) console.log(`  off profile: ${s.off.profile}`);
}
console.log("crops:", (result.crops ?? []).join("\n        "));
