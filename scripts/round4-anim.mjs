/**
 * 第四轮 · 六套实验台动画实拍（C1 洗涤 / C2 搅拌 / C3 加试剂 / C4 转移 / C5 称量 / C6 定容）
 *
 * 做法：真点真拖 exp01 七步，同时
 *   ① CDP Page.startScreencast 录帧（每帧带 Chrome 时间戳，用来挑逐帧画面）
 *   ② 页面内每帧采样：WAAPI running 数 / 液面 data-liquid-level / 天平读数 / 动作层存在
 *   ③ 记录动作层与倾倒层的挂载-卸载时刻（= DOM 生命周期）
 * 产出：evidence/2026-10-24-round4-anim/*.png + data.json
 *
 * 用法：node scripts/round4-anim.mjs [--base http://127.0.0.1:3000]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const argOf = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;
const BASE = (argOf("--base", process.env.BASE ?? "http://127.0.0.1:3000")).replace(/\/$/, "");
const OUT = path.resolve(argOf("--out", "evidence/2026-10-24-round4-anim"));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- 页面内探针 */
const PROBE = () => {
  const P = {
    acts: [],       // 动作层 / 倾倒层的 add-remove
    samples: [],    // 每帧采样
    lastPointer: 0, // 最后一次 pointerup / click
    on: true,
  };
  window.__probe = P;
  const boot = () => {
  if (!document.documentElement) return setTimeout(boot, 10);

  const layerOf = (el) => {
    if (!el.querySelector) return null;
    if (el.matches("[data-action-layer]")) return "action";
    if (el.matches("[data-bench-pour]")) return "pour";
    if (el.querySelector("[data-action-layer]")) return "action";
    if (el.querySelector("[data-bench-pour]")) return "pour";
    return null;
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        const k = layerOf(n);
        if (k) P.acts.push({ kind: "add", layer: k, t: Date.now() });
        // 倾倒层是「瓶飞进来」才挂的：内部元素后挂也算一次
        for (const sel of ["[data-action-layer]", "[data-bench-pour]"]) {
          for (const inner of n.querySelectorAll?.(sel) ?? []) void inner;
        }
      }
      for (const n of m.removedNodes) {
        if (n.nodeType !== 1) continue;
        const k = layerOf(n);
        if (k) P.acts.push({ kind: "remove", layer: k, t: Date.now() });
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  const mark = () => { P.lastPointer = Date.now(); };
  window.addEventListener("pointerup", mark, true);
  window.addEventListener("click", mark, true);

  let stop = false;
  window.__probeStop = () => { stop = true; };
  const levels = () => [...document.querySelectorAll("[data-vessel-liquid]")].map((el) => ({
    id: el.getAttribute("data-vessel-liquid"),
    level: Number(el.getAttribute("data-liquid-level")),
    fill: el.querySelector("[data-liquid-rect]")?.getAttribute("fill") ?? null,
    sediment: Boolean(el.querySelector('[data-liquid-layer="sediment"]')),
  }));
  const tick = () => {
    if (stop) return;
    const anims = document.getAnimations ? document.getAnimations() : [];
    let running = 0;
    for (const a of anims) if (a.playState === "running") running++;
    P.samples.push({
      t: Date.now(),
      running,
      action: Boolean(document.querySelector("[data-action-layer]")),
      pour: Boolean(document.querySelector("[data-bench-pour]")),
      clickable: Boolean(document.querySelector('[data-demo-id="demo-action-skip"]')),
      readout: document.querySelector("[data-balance-readout]")?.textContent?.trim() ?? null,
      levels: levels(),
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  };
  boot();
};

/* ---------------------------------------------------------------- 小工具 */
async function newCtx(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  return { ctx, page, errs };
}

async function drag(page, fromSel, toSel) {
  const a = await page.locator(fromSel).first().boundingBox();
  const b = await page.locator(toSel).first().boundingBox();
  if (!a || !b) throw new Error(`拖拽元素不存在 ${fromSel} -> ${toSel}`);
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2;
  const ex = b.x + b.width / 2, ey = b.y + b.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(sx + ((ex - sx) * i) / 12, sy + ((ey - sy) * i) / 12, { steps: 2 });
    await sleep(22);
  }
  await sleep(70);
  await page.mouse.up();
}

/** 等到动作层彻底消失（DOM 生命周期结束） */
async function waitQuiet(page, timeout = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const busy = await page.evaluate(() => ({
      action: Boolean(document.querySelector("[data-action-layer]")),
      pour: Boolean(document.querySelector("[data-bench-pour]")),
      running: (document.getAnimations?.() ?? []).filter((a) => a.playState === "running").length,
    }));
    if (!busy.action && !busy.pour && busy.running === 0) return Date.now();
    await sleep(100);
  }
  return null;
}

/* ---------------------------------------------------------------- 主流程 */
const browser = await chromium.launch();
const { ctx, page, errs } = await newCtx(browser, 1440, 900);
await page.goto(`${BASE}/api/session`, { waitUntil: "load" }).catch(() => null);
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "load", timeout: 120000 });
await page.waitForSelector('[data-demo-id="demo-scene-vessel-volumetric"]', { timeout: 90000 });
await sleep(1200);

/* 录屏：CDP screencast，帧自带 epoch ms 时间戳 */
const cdp = await ctx.newCDPSession(page);
let frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
await cdp.send("Page.startScreencast", { format: "png", quality: 92, everyNthFrame: 1 });
frames = [];

/** 采集一个「动作窗口」：记录前后状态 + DOM 生命周期 + 帧率 */
async function capture(label, fn) {
  frames.length = 0;
  await page.evaluate(() => {
    window.__probe.acts.length = 0;
    window.__probe.samples.length = 0;
  });
  const before = await page.evaluate(() => ({
    step: Number(/第\s*0*(\d+)\s*步/.exec(document.body.innerText)?.[1] ?? 0),
    levels: [...document.querySelectorAll("[data-vessel-liquid]")].map((el) => ({
      id: el.getAttribute("data-vessel-liquid"),
      level: Number(el.getAttribute("data-liquid-level")),
      fill: el.querySelector("[data-liquid-rect]")?.getAttribute("fill") ?? null,
      sediment: Boolean(el.querySelector('[data-liquid-layer="sediment"]')),
    })),
    readout: document.querySelector("[data-balance-readout]")?.textContent?.trim() ?? null,
    body: document.body.innerText.slice(0, 4000),
  }));
  const tTrigger = Date.now();
  await fn();
  const tQuiet = await waitQuiet(page, 10000);
  await sleep(450); // 留一点尾巴给切帧
  const after = await page.evaluate(() => ({
    step: Number(/第\s*0*(\d+)\s*步/.exec(document.body.innerText)?.[1] ?? 0),
    levels: [...document.querySelectorAll("[data-vessel-liquid]")].map((el) => ({
      id: el.getAttribute("data-vessel-liquid"),
      level: Number(el.getAttribute("data-liquid-level")),
      fill: el.querySelector("[data-liquid-rect]")?.getAttribute("fill") ?? null,
      sediment: Boolean(el.querySelector('[data-liquid-layer="sediment"]')),
    })),
    readout: document.querySelector("[data-balance-readout]")?.textContent?.trim() ?? null,
    body: document.body.innerText.slice(0, 4000),
  }));
  const probe = await page.evaluate(() => ({ acts: window.__probe.acts, samples: window.__probe.samples }));
  const shot = { label, tTrigger, tQuiet, before, after, probe, frames: frames.slice() };
  // 帧率统计（动画区间 = 第一次出现动作层/倾倒层 → 卸载）
  const acts = probe.acts;
  const add = acts.find((a) => a.kind === "add");
  const rem = [...acts].reverse().find((a) => a.kind === "remove");
  const winStart = add?.t ?? tTrigger;
  const winEnd = rem?.t ?? tQuiet ?? tTrigger;
  const inWin = probe.samples.filter((s) => s.t >= winStart && s.t <= winEnd);
  const dts = [];
  for (let i = 1; i < inWin.length; i++) dts.push(inWin[i].t - inWin[i - 1].t);
  dts.sort((a, b) => a - b);
  const pct = (p) => (dts.length ? dts[Math.min(dts.length - 1, Math.floor(dts.length * p))] : null);
  const fps = {
    windowMs: winEnd - winStart,
    frames: dts.length,
    avg: dts.length ? +(dts.reduce((s, v) => s + v, 0) / dts.length).toFixed(2) : null,
    p95: pct(0.95),
    max: dts.length ? Math.max(...dts) : null,
    over33: dts.filter((d) => d > 33).length,
  };
  // 动画「看起来结束」= 最后一次 running>0 的采样时刻
  const lastRunning = [...inWin].reverse().find((s) => s.running > 0);
  shot.metrics = {
    animMs: lastRunning ? lastRunning.t - winStart : null,
    domMs: winEnd - winStart,
    triggerToQuietMs: tQuiet ? tQuiet - tTrigger : null,
    fps,
    layers: acts.map((a) => `${a.kind}:${a.layer}@${a.t}`),
  };
  shot.winStart = winStart;
  shot.winEnd = winEnd;
  console.log(`[${label}] step ${before.step}→${after.step} anim=${shot.metrics.animMs}ms dom=${shot.metrics.domMs}ms frames=${fps.frames} avg=${fps.avg} p95=${fps.p95} max=${fps.max} >33=${fps.over33}`);
  return shot;
}

const shots = [];

// ── C1 洗涤：容量瓶拖进洗涤槽（第 1 步）
shots.push(await capture("C1-洗涤", () => drag(page, '[data-demo-id="demo-scene-vessel-volumetric"]', '[data-demo-id="demo-scene-sink"]')));
await sleep(600);

// ── 第 2 步：点天平（调平+内校，读数动作，不是 C5）
await capture("S2-调平", async () => { await page.locator('[data-demo-id="demo-scene-instrument-balance"]').first().click(); });
await sleep(800);

// ── C5 称量：第 3 步点天平（差减称量）
shots.push(await capture("C5-称量", async () => { await page.locator('[data-demo-id="demo-scene-instrument-balance"]').first().click(); }));
await sleep(800);

// ── 第 4 步：蒸馏水拖到烧杯 = C3 加试剂（倾倒）+ C2 搅拌（溶解），两段连播
shots.push(await capture("C3C2-加试剂与搅拌", () => drag(page, '[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-beaker"]')));
await sleep(800);

// ── C6 定容：第 5 步蒸馏水拖到容量瓶
shots.push(await capture("C6-定容", () => drag(page, '[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-volumetric"]')));
await sleep(800);

// ── C4 转移：第 6 步移液管拖到锥形瓶
shots.push(await capture("C4-转移", () => drag(page, '[data-demo-id="demo-tool-pipette"]', '[data-demo-id="demo-scene-vessel-flask"]')));

await cdp.send("Page.stopScreencast").catch(() => undefined);

/* ---------------------------------------------------------------- 拼图 */
async function sheet(label, framesIn, file, note) {
  const sel = framesIn.map((f) => `data:image/png;base64,${f.data}`);
  const cols = 2;
  // 裁出画面主体（台面 + 底部操作条，原始坐标 x 0..1015 / y 88..463），再缩放 0.64
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0f1115;font:13px/1.4 system-ui;color:#e8eaed;width:1340px">
  <div style="padding:10px 14px;font-size:16px;font-weight:600">${label} · ${note}</div>
  <div style="display:grid;grid-template-columns:repeat(${cols},650px);gap:10px;padding:0 12px 12px;justify-content:center">
  ${sel.map((s, i) => `<figure style="margin:0">
    <div style="width:650px;height:430px;overflow:hidden;position:relative;border:1px solid #2a2e37;background:#0b0d11">
      <img src="${s}" style="position:absolute;left:0;top:-56px;width:1440px;transform:scale(.64);transform-origin:0 0;display:block">
    </div>
    <figcaption style="padding:3px 2px;color:#9aa2b1">f${i + 1} · +${Math.round(framesIn[i].rel)}ms</figcaption></figure>`).join("")}
  </div></body>`;
  const p = await browser.newPage({ viewport: { width: 1340, height: 700 } });
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForTimeout(320);
  const el = await p.locator("body").boundingBox();
  await p.setViewportSize({ width: 1340, height: Math.ceil(el.height) + 10 });
  await p.screenshot({ path: file, fullPage: true });
  await p.close();
}

const cleanShot = (s, layer) => {
  // 挑一个动作层的帧窗口；动作层/倾倒层各自成段
  const segs = [];
  let open = null;
  for (const a of s.probe.acts) {
    if (a.kind === "add" && (!layer || a.layer === layer)) open = { start: a.t, layer: a.layer };
    if (a.kind === "remove" && open && a.layer === open.layer) { segs.push({ start: open.start, end: a.t }); open = null; }
  }
  if (open && s.tQuiet) segs.push({ start: open.start, end: s.tQuiet });
  return segs;
};

const pick = (s, seg, n = 8, mode = "even") => {
  const inSeg = s.frames.filter((f) => f.t >= seg.start - 250 && f.t <= seg.end + 250);
  if (!inSeg.length) return [];
  const t0 = inSeg[0].t;
  const t1 = inSeg[inSeg.length - 1].t;
  const out = [];
  for (let i = 0; i < n; i++) {
    // even = 全段均匀；step = 严格 65ms 间隔（任务口径 60~80ms）
    const want = mode === "step" ? t0 + 65 * i : t0 + ((t1 - t0) * i) / Math.max(1, n - 1);
    let best = inSeg[0], bestD = Infinity;
    for (const f of inSeg) { const d = Math.abs(f.t - want); if (d < bestD) { bestD = d; best = f; } }
    if (!out.includes(best)) out.push(best);
  }
  return out.map((f) => ({ ...f, rel: f.t - t0 }));
};

/** 局部放大拼图：只裁动作发生的那台器皿附近，放大 1.35 倍，看清液面/水柱/棒 */
const CROP = {
  C1: { x: 50, y: 440, w: 300, h: 260 },
  C2: { x: 370, y: 210, w: 320, h: 280 },
  C3: { x: 330, y: 200, w: 340, h: 290 },
  C4: { x: 760, y: 220, w: 380, h: 260 },
  C5: { x: 150, y: 290, w: 260, h: 210 },
  C6: { x: 760, y: 210, w: 320, h: 280 },
};

async function sheetZoom(label, framesIn, file, note, crop) {
  const s = 1.35;
  const sel = framesIn.map((f) => `data:image/png;base64,${f.data}`);
  const w = Math.round(crop.w * s);
  const h = Math.round(crop.h * s);
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0f1115;font:13px/1.4 system-ui;color:#e8eaed;width:${w * 2 + 60}px">
  <div style="padding:10px 14px;font-size:16px;font-weight:600">${label} · 局部放大 ×${s} · ${note}</div>
  <div style="display:grid;grid-template-columns:repeat(2,${w}px);gap:10px;padding:0 14px 12px;justify-content:center">
  ${sel.map((s2, i) => `<figure style="margin:0">
    <div style="width:${w}px;height:${h}px;overflow:hidden;position:relative;border:1px solid #2a2e37;background:#0b0d11">
      <img src="${s2}" style="position:absolute;left:${-Math.round(crop.x * s)}px;top:${-Math.round(crop.y * s)}px;width:${Math.round(1440 * s)}px;display:block">
    </div>
    <figcaption style="padding:3px 2px;color:#9aa2b1">f${i + 1} · +${Math.round(framesIn[i].rel)}ms</figcaption></figure>`).join("")}
  </div></body>`;
  const p = await browser.newPage({ viewport: { width: w * 2 + 60, height: 700 } });
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForTimeout(320);
  const el = await p.locator("body").boundingBox();
  await p.setViewportSize({ width: w * 2 + 60, height: Math.ceil(el.height) + 10 });
  await p.screenshot({ path: file, fullPage: true });
  await p.close();
}

const manifest = [];
/** 一套动画 = 两张图：`<C>-<名字>.png` 严格 65ms 间隔 8 帧（任务口径）+ `-全段.png` 全段 8 帧（看整体节奏） */
async function emit(idName, name, s, seg, note) {
  const stepFrames = pick(s, seg, 8, "step");
  const evenFrames = pick(s, seg, 8, "even");
  const ms = Math.round(seg.end - seg.start);
  await sheet(`${idName} ${name}`, stepFrames, `${OUT}/${idName}-${name}.png`, `${note} · 65ms 间隔 · 动作层 ${ms}ms`);
  await sheet(`${idName} ${name}`, evenFrames, `${OUT}/${idName}-${name}-全段.png`, `${note} · 全段均匀 · 动作层 ${ms}ms`);
  await sheetZoom(`${idName} ${name}`, stepFrames, `${OUT}/${idName}-${name}-放大.png`, note, CROP[idName]);
  manifest.push({ id: idName, file: `${idName}-${name}.png`, fileFull: `${idName}-${name}-全段.png`, ms, frames: stepFrames.length, layer: seg.layer });
}

for (const s of shots) {
  const segs = cleanShot(s);
  if (!segs.length) { console.log(`!! ${s.label} 没抓到动作层时段`); continue; }
  if (s.label === "C3C2-加试剂与搅拌") {
    const pour = segs.find((g) => g.layer === "pour") ?? segs[0];
    const act = segs.filter((g) => g.layer === "action").at(-1) ?? segs.at(-1);
    await emit("C3", "加试剂", s, pour, "倾倒：举瓶→倾斜→液柱→液面");
    await emit("C2", "搅拌", s, act, "搅拌：玻璃棒绕圈→液面跟转");
    s.segsUsed = { pour, act };
    continue;
  }
  const seg = s.label === "C6-定容" ? segs.at(-1) : segs.at(0);
  const [idName, name] = s.label.split("-");
  const note = s.label === "C1-洗涤" ? "洗涤本体（后面自动接 drain，另计）" : "";
  await emit(idName, name, s, seg, note);
  s.segsUsed = { main: seg, all: segs };
}

const data = {
  base: BASE,
  out: OUT,
  manifest,
  shots: shots.map((s) => ({
    label: s.label,
    stepFrom: s.before.step,
    stepTo: s.after.step,
    metrics: s.metrics,
    clickableRatio: s.probe.samples.length
      ? +(s.probe.samples.filter((x) => x.clickable).length / s.probe.samples.length).toFixed(2)
      : null,
    before: { levels: s.before.levels, readout: s.before.readout },
    after: { levels: s.after.levels, readout: s.after.readout },
    segs: cleanShot(s),
    segsUsed: s.segsUsed ?? null,
    captionAfter: s.after.body.match(/[^\n]{0,60}(完成|成功|错误|失败)[^\n]{0,60}/g)?.slice(0, 3) ?? [],
  })),
  errors: errs.slice(0, 12),
  frameCount: frames.length,
};
fs.writeFileSync(`${OUT}/data.json`, JSON.stringify(data, null, 2));
console.log(JSON.stringify({ manifest, errors: data.errors }, null, 2));
await browser.close();
