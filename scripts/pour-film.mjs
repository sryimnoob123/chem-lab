/**
 * 倾倒逐帧体检（「倾倒可信」这条的抓手）
 *
 * 做法：推进到第一个「要加试剂」的步骤（场景里带 data-next=true 的试剂瓶），
 * 按落点判定拖到 data-drop="ok" 的器皿上，然后每 55ms 采样一次：
 *   瓶子 transform / 三条液柱 scaleY / 涟漪 opacity / 该器皿液面 transform，
 * 同时把台面 SVG 逐帧截图，用来肉眼核对「举瓶→倾斜→液柱→液面涨」这四拍。
 *
 * 用法：BASE_URL=http://localhost:3001 node scripts/pour-film.mjs
 * 产物：%TEMP%/chemlab-shots/pour-film/frame-00..NN.png + film.json + 控制台时序表
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const dir = process.env.SHOT_DIR ?? path.join(os.tmpdir(), "chemlab-shots", "pour-film");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const def = (await import("../experiments/exp01/definition.ts")).exp01Definition;
const keysFor = (i) =>
  def.steps[i].choices.map((c, k) => (c.role === "correct" ? k + 1 : null)).filter(Boolean);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror:" + String(e.message).slice(0, 160)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  errors.push("console:" + t.slice(0, 140));
});

await page.goto(BASE + "/exp/exp01?force=1", { waitUntil: "networkidle" });
await page.waitForFunction(
  () => {
    const el = document.querySelector("[data-demo-id='demo-finish']");
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
  },
  null,
  { timeout: 30000 },
);

/** 推进到「有 data-next 试剂」的那一步（最多推到第 7 步） */
let stepNow = null;
for (let s = 0; s < 7; s += 1) {
  const hasNext = await page.locator("[data-demo-id^='demo-scene-reagent-'][data-next='true']").count();
  if (hasNext) {
    stepNow = s + 1;
    break;
  }
  for (const k of keysFor(s)) {
    await page.keyboard.press(String(k));
    await page.waitForTimeout(900);
  }
}
if (!stepNow) throw new Error("七步里没找到需要加试剂的步骤（data-next 试剂瓶）");
console.log(`倾倒发生在第 ${stepNow} 步`);

const src = page.locator("[data-demo-id^='demo-scene-reagent-'][data-next='true']").first();
const srcId = await src.getAttribute("data-demo-id");
const s = await src.boundingBox();
if (!s) throw new Error("试剂瓶没有可见位置");
await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
await page.mouse.down();
await page.mouse.move(s.x + s.width / 2 + 18, s.y + s.height / 2 + 10, { steps: 4 });

const vessels = await page.evaluate(() =>
  [...document.querySelectorAll("[data-drop-kind='vessel']")].map((el) => {
    const r = el.getBoundingClientRect();
    return { demo: el.getAttribute("data-demo-id"), x: r.left + r.width / 2, y: r.top + r.height * 0.65 };
  }),
);
let target = null;
for (const v of vessels) {
  await page.mouse.move(v.x, v.y, { steps: 8 });
  await page.waitForTimeout(80);
  const state = await page.evaluate(
    (sel) => document.querySelector(sel)?.getAttribute("data-drop") ?? "none",
    `[data-demo-id='${v.demo}']`,
  );
  if (state === "ok") {
    target = v;
    break;
  }
}
if (!target) throw new Error(`没找到接受 ${srcId} 的器皿`);
const targetId = target.demo.replace("demo-scene-vessel-", "");
await page.mouse.move(target.x, target.y, { steps: 6 });
await page.mouse.up();

// 松手后开始逐帧采样
const bench = page.locator('svg[aria-label^="实验台"]').first();
const frames = [];
const t0 = Date.now();
for (let i = 0; i < 24; i += 1) {
  const sample = await page.evaluate((vid) => {
    const bottle = document.querySelector("[data-pour-bottle]");
    const streams = [...document.querySelectorAll("[data-pour-stream]")];
    const ripple = document.querySelector("[data-pour-ripple]");
    const liquid = document.querySelector(`[data-vessel-liquid="${vid}"]`);
    const read = (el) => (el ? getComputedStyle(el).transform : null);
    return {
      bottle: read(bottle),
      bottleOpacity: bottle ? getComputedStyle(bottle).opacity : null,
      streams: streams.map((x) => {
        const cs = getComputedStyle(x);
        return { tf: cs.transform, op: Number(cs.opacity) };
      }),
      rippleOpacity: ripple ? getComputedStyle(ripple).opacity : null,
      liquid: read(liquid),
      caption: (document.querySelector("[data-demo-id=demo-scene-event]")?.textContent ?? "").slice(0, 40),
    };
  }, targetId);
  const ms = Date.now() - t0;
  frames.push({ ms, ...sample });
  if (i % 3 === 0) {
    await bench.screenshot({ path: path.join(dir, `frame-${String(i).padStart(2, "0")}.png`) }).catch(() => {});
  }
  await page.waitForTimeout(55);
}
await page.waitForTimeout(1200);
const after = await page.evaluate((vid) => {
  const liquid = document.querySelector(`[data-vessel-liquid="${vid}"]`);
  return {
    liquid: liquid ? getComputedStyle(liquid).transform : null,
    caption: (document.querySelector("[data-demo-id=demo-scene-event]")?.textContent ?? "").slice(0, 60),
    stepText: document.querySelector("[class*=topStep]")?.textContent?.replace(/\s+/g, " "),
  };
}, targetId);
fnWrite();
function fnWrite() {
  fs.writeFileSync(path.join(dir, "film.json"), JSON.stringify({ step: stepNow, srcId, targetId, frames, after }, null, 1));
}

const scaleY = (tf) => {
  if (!tf || tf === "none") return 1;
  const m = tf.match(/matrix\(([^)]+)\)/);
  if (!m) return 1;
  const parts = m[1].split(",").map(Number);
  return parts[3];
};
for (const f of frames) {
  // 只看真的可见的液柱（基础态 opacity 0 = 还没长出来，transform 会是基准值 1）
  const streamMax = Math.max(0, ...f.streams.filter((x) => x.op > 0.02).map((x) => scaleY(x.tf)));
  const liquidScale = scaleY(f.liquid);
  console.log(
    `${String(f.ms).padStart(4)}ms  瓶=${f.bottle === "none" ? "原位" : "动"} 不透明度=${Number(f.bottleOpacity ?? 1).toFixed(2)}  液柱=${streamMax.toFixed(2)}  涟漪=${Number(f.rippleOpacity ?? 0).toFixed(2)}  液面=${liquidScale.toFixed(3)}`,
  );
}
console.log("\n松手 1.2s 后:", JSON.stringify(after, null, 1));
console.log(`\n帧图 ${fs.readdirSync(dir).filter((f) => f.endsWith(".png")).length} 张 → ${dir}`);
console.log("pageerror/console:", errors.length ? errors.slice(0, 3) : "0");
await browser.close();
process.exitCode = errors.length ? 1 : 0;
