/**
 * 第四轮 · 帧率实测（1440 / 390 两视口）
 *
 * 做法：页面内 rAF 连采 120 帧（间隔 = 相邻两帧 performance.now 之差），采样窗口盖住整套动作
 * （动作层挂载 → 卸载）。测完把原始间隔数组带回 Node 算 avg / P95 / max / >33ms 帧数。
 * 单独一个脚本、不开 screencast —— 录屏本身会吃掉渲染预算，混在一起测不准。
 *
 * 用法：node scripts/round4-fps.mjs [--base http://127.0.0.1:3000]
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

const SAMPLER = () => {
  window.__fps = { on: false, t: [], acts: [] };
  const boot = () => {
  if (!document.documentElement) return setTimeout(boot, 10);
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches("[data-action-layer]") || n.matches("[data-bench-pour]") || n.querySelector?.("[data-action-layer],[data-bench-pour]")))
          window.__fps.acts.push({ k: "add", t: performance.now() });
      }
      for (const n of m.removedNodes) {
        if (n.nodeType === 1 && (n.matches("[data-action-layer]") || n.matches("[data-bench-pour]") || n.querySelector?.("[data-action-layer],[data-bench-pour]")))
          window.__fps.acts.push({ k: "remove", t: performance.now() });
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  const loop = () => {
    if (window.__fps.on) {
      const now = performance.now();
      const busy = Boolean(document.querySelector("[data-action-layer],[data-bench-pour]"));
      window.__fps.t.push({ t: now, busy });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  };
  boot();
};

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
    await sleep(20);
  }
  await sleep(60);
  await page.mouse.up();
}

function stats(ts) {
  const d = [];
  for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
  if (!d.length) return null;
  const sorted = [...d].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    frames: d.length,
    avg: +(d.reduce((s, v) => s + v, 0) / d.length).toFixed(2),
    p95: +q(0.95).toFixed(2),
    max: +Math.max(...d).toFixed(2),
    over33: d.filter((v) => v > 33.34).length,
    over50: d.filter((v) => v > 50).length,
    fps: +(1000 / (d.reduce((s, v) => s + v, 0) / d.length)).toFixed(1),
  };
}

const browser = await chromium.launch();
const results = [];

for (const vp of [{ label: "1440", w: 1440, h: 900 }, { label: "390", w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(SAMPLER);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/api/session`).catch(() => null);
  await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector('[data-demo-id="demo-scene-vessel-volumetric"]', { timeout: 90000 });
  await sleep(2000);

  /** 一次动作的帧率：开始采样 → 触发 → 等到动作层全消失 → 取 120 帧窗口 */
  async function measure(name, fn) {
    await page.evaluate(() => { window.__fps.t = []; window.__fps.on = true; });
    await fn();
    // 采满 240 帧（约 4s，足够盖住一整条动作 + 收尾）
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      const n = await page.evaluate(() => window.__fps.t.length);
      if (n >= 240) break;
      await sleep(80);
    }
    const raw = await page.evaluate(() => { window.__fps.on = false; return window.__fps.t; });
    // 只统计「动作在播」的那段（busy=true 的帧），最多 120 帧
    const busy = raw.filter((x) => x.busy);
    const slice = (busy.length >= 2 ? busy : raw).slice(0, 120);
    const ts = slice.map((x) => x.t);
    return { name, windowMs: Math.round(ts[ts.length - 1] - ts[0]), ...stats(ts) };
  }

  const rows = [];
  rows.push(await measure("洗涤 C1", () => drag(page, '[data-demo-id="demo-scene-vessel-volumetric"]', '[data-demo-id="demo-scene-sink"]')));
  await sleep(600);
  // 第 2 步调平（不动画窗口也要走完流程）
  await page.locator('[data-demo-id="demo-scene-instrument-balance"]').first().click();
  await sleep(1400);
  rows.push(await measure("称量 C5", () => page.locator('[data-demo-id="demo-scene-instrument-balance"]').first().click()));
  await sleep(800);
  rows.push(await measure("加试剂 C3 + 搅拌 C2", () => drag(page, '[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-beaker"]')));
  await sleep(900);
  rows.push(await measure("定容 C6", () => drag(page, '[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-volumetric"]')));
  await sleep(900);
  rows.push(await measure("转移 C4", () => drag(page, '[data-demo-id="demo-tool-pipette"]', '[data-demo-id="demo-scene-vessel-flask"]')));

  results.push({ viewport: vp, rows });
  await ctx.close();
}

fs.writeFileSync(`${OUT}/fps.json`, JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`\n== ${r.viewport.label}x${r.viewport.h} ==`);
  for (const row of r.rows) console.log(`${row.name}\t${row.windowMs}ms\t${row.frames}帧\tavg ${row.avg}ms (${row.fps}fps)\tP95 ${row.p95}\tmax ${row.max}\t>33ms ${row.over33}\t>50ms ${row.over50}`);
}
await browser.close();
