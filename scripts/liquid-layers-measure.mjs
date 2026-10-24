/**
 * 液体分层实测（B2 的 A/B 证据）：液面反光带 / 液柱两层渐变 / 器底沉淀。
 *
 * 量的是**像素**，不是 DOM 属性。三个场景各取一组读数：
 *   ① exp03（烧杯 + 容量瓶各装水）→ 液面盘亮度增益、液柱上/中/下三段亮度；
 *   ② exp01（真的倒一次水，液位 0.22）→ 交付页面的口径；
 *   ③ /scene-preview 里造一次真沉淀（NaOH + 水 + CuSO₄ → Cu(OH)₂）→ 器底沉淀层与中段液体的亮度差、
 *      沉淀分界处的行间落差（读成「积了一层」还是「下半截更暗」）。
 *
 * 口径：亮度 L = 0.2126R + 0.7152G + 0.0722B（0..255），纸白台面 ≈ 246。
 * 液面椭圆在 38° 俯视下很高（ry = rx × 0.62），短液柱时整柱都被液面盘覆盖 ——
 * 这时只报液面读数、液柱三段报 "-"，不硬凑数字。
 *
 * 用法：
 *   PLAYWRIGHT_BROWSERS_PATH=…/ms-playwright BASE_URL=http://localhost:3001 \
 *   OUT=<json> node scripts/liquid-layers-measure.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = process.env.OUT ?? path.join(os.tmpdir(), "chemlab-shots", "liquid-layers.json");
const DPR = Number(process.env.DPR ?? 3);

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const median = (arr) => (arr.length ? arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)] : NaN);
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

/** 按液体元素的包围盒切图，返回逐行亮度统计（只取中间 44% 列，避开两侧器壁与横向体积渐变） */
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
    return {
      art: box(art),
      liquid: box(body),
      surface: box(surf),
      sediment: box(sediment),
      level: art.querySelector("[data-vessel-liquid]")?.getAttribute("data-liquid-level") ?? null,
      fill: body ? getComputedStyle(body).fill : null,
      layers: Array.from(art.querySelectorAll("[data-liquid-layer]")).map((el) => el.getAttribute("data-liquid-layer")),
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

/** 液面盘 / 液柱三段：液面椭圆（ry 很高）覆盖的部分当「盘」，其下方的行当「液柱」 */
function metrics(geom, rows) {
  const H = rows.length;
  const ry = Math.max(2, Math.round((geom.surface.h / 2) * DPR));
  const discEnd = Math.min(H - 2, Math.max(5, Math.round(ry * 0.85)));
  const discRows = rows.slice(3, discEnd);
  if (discRows.length === 0) return { error: "crop too small", heightPx: H, ryPx: ry };
  const discPeak = Math.max(...discRows.map((r) => r.peak));
  const discMed = median(discRows.map((r) => r.med));
  const bodyRows = rows.slice(Math.min(H - 3, Math.max(4, Math.round(ry))), H - 3);
  const out = {
    heightPx: H,
    ryPx: ry,
    discPeak: fix(discPeak),
    discMed: fix(discMed),
    ringVsDisc: fix(discPeak - discMed),
    body: null,
    surfaceGain: null,
    depthDrop: null,
    monotone: null,
  };
  if (bodyRows.length >= 8) {
    const at = (frac) => bodyRows[Math.floor((bodyRows.length - 1) * frac)];
    const b30 = at(0.3);
    const b55 = at(0.55);
    const b80 = at(0.8);
    out.body = { b30: fix(b30.med), b55: fix(b55.med), b80: fix(b80.med) };
    out.surfaceGain = fix(discPeak - b30.med);
    out.depthDrop = fix(b30.med - b80.med);
    out.monotone = b30.med >= b55.med && b55.med >= b80.med;
  }
  out.profile = rows.map((r) => Math.round(r.med)).join(" ");
  return out;
}

const browser = await chromium.launch();
const result = { base: BASE, dpr: DPR, at: new Date().toISOString(), scenes: {} };
const table = [];

const pushRow = (scene, vessel, level, m) =>
  table.push({
    scene,
    vessel,
    level,
    "disc peak": m.discPeak ?? "-",
    "disc med": m.discMed ?? "-",
    "ring+": m.ringVsDisc ?? "-",
    "body 30%": m.body?.b30 ?? "-",
    "body 55%": m.body?.b55 ?? "-",
    "body 80%": m.body?.b80 ?? "-",
    "surface+": m.surfaceGain ?? "-",
    "depth-": m.depthDrop ?? "-",
  });

/* ---------------- ① exp03：烧杯 + 容量瓶各装水 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.goto(BASE + "/exp/exp03?force=1", { waitUntil: "networkidle" });
  await waitHydrated(page);
  await page.waitForTimeout(1200);
  const shot = await page.screenshot();
  result.scenes.exp03 = {};
  for (const id of ["beaker", "volumetric"]) {
    const { geom, rows } = await readVessel(shot, page, id);
    if (!rows) {
      result.scenes.exp03[id] = { geom, note: "没有液体" };
      continue;
    }
    const m = metrics(geom, rows);
    result.scenes.exp03[id] = { geom, ...m };
    pushRow("exp03", id, geom.level, m);
  }
  await ctx.close();
}

/* ---------------- ② exp01：真倒一次水（交付页面口径） ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.goto(BASE + "/exp/exp01?force=1", { waitUntil: "networkidle" });
  await waitHydrated(page);
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("1");
    await page.waitForTimeout(900);
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
    }
  }
  await page.waitForTimeout(2400);
  const shot = await page.screenshot();
  const { geom, rows } = await readVessel(shot, page, "beaker");
  if (rows) {
    const m = metrics(geom, rows);
    result.scenes.exp01 = { geom, ...m };
    pushRow("exp01", "beaker", geom.level, m);
  } else {
    result.scenes.exp01 = { geom, note: "烧杯里没量到液体（倒水失败）" };
  }
  await ctx.close();
}

/* ---------------- ③ 沉淀：/scene-preview 里造 Cu(OH)₂ ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.goto(BASE + "/scene-preview?contents=beaker=naoh,cuso4,water", { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__chemLabDemoScene), null, { timeout: 30000 });
  // 这一态（液体 + 器底沉淀）拖拽走不到 —— 现象表按组合精确匹配，直接由 ?contents 摆好
  await page.waitForTimeout(1200);
  const shot = await page.screenshot();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(path.join(path.dirname(OUT), "liquid-sediment.png"), shot);
  const { geom, rows } = await readVessel(shot, page, "beaker");
  if (rows) {
    // 沉淀一行一行量：窗口行号 = (元素 y - 液体 bbox y + 2) * DPR
    const toRow = (y) => Math.round((y - geom.liquid.y + 2) * DPR);
    const sedTopRow = toRow(geom.sediment.y);
    const sedBotRow = Math.min(rows.length - 3, toRow(geom.sediment.y + geom.sediment.h));
    const midRow = Math.max(4, Math.round((toRow(geom.liquid.y) + sedTopRow) / 2));
    const rowMed = (r) => rows[Math.max(0, Math.min(rows.length - 1, r))].med;
    // 沉淀内侧一行（避开器底圆弧把纸白混进来）+ 分界处相邻两行的最大落差
    const sedRow = Math.max(sedTopRow + 1, Math.round((sedTopRow + sedBotRow) / 2));
    let edge = 0;
    for (let r = sedTopRow - 4; r <= sedTopRow + 4; r += 1) edge = Math.max(edge, Math.abs(rowMed(r) - rowMed(r + 1)));
    const m = metrics(geom, rows);
    result.scenes.sediment = {
      geom,
      layers: geom.layers,
      liquidFill: geom.fill,
      midRow,
      midL: fix(rowMed(midRow)),
      sedRow,
      sedimentL: fix(rowMed(sedRow)),
      sedimentMinusMid: fix(rowMed(sedRow) - rowMed(midRow)),
      edgeStep: fix(edge),
      ...m,
    };
    table.push({
      scene: "sediment",
      vessel: "beaker",
      level: geom.level,
      midL: fix(rowMed(midRow)),
      sedimentL: fix(rowMed(sedRow)),
      "sed-mid": fix(rowMed(sedRow) - rowMed(midRow)),
      "edge step": fix(edge),
    });
    // 放大图：给肉眼验收用（器皿在 preview 舞台上只有 60px 宽，按元素截 + 高 DPR 才看得出沉淀）
    const dpr8 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 8 });
    const zoomPage = await dpr8.newPage();
    await zoomPage.goto(BASE + "/scene-preview?contents=beaker=naoh,cuso4,water", { waitUntil: "networkidle" });
    await zoomPage.waitForFunction(() => Boolean(document.querySelector("[data-vessel-art='beaker'] [data-liquid-layer='sediment']")), null, {
      timeout: 30000,
    });
    await zoomPage.waitForTimeout(600);
    await zoomPage
      .locator("[data-vessel-art='beaker']")
      .screenshot({ path: path.join(path.dirname(OUT), "liquid-sediment-zoom.png") });
    await dpr8.close();
  } else {
    result.scenes.sediment = { geom, note: "没有液体/沉淀" };
  }
  await ctx.close();
}

await browser.close();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log("BASE", BASE, "→", OUT);
console.table(table);
for (const [name, scene] of Object.entries(result.scenes)) {
  for (const [k, r] of Object.entries(scene)) if (r?.profile) console.log(`${name}/${k} profile:`, r.profile);
}
