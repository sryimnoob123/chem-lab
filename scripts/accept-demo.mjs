/**
 * 演示模式验收：点一次按钮 → 自动演完 → 字幕时间轴 / 卡顿检测 / 退出重来 / 沿途截图。
 * 用法：node scripts/accept-demo.mjs [最长秒=150]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const limit = Number(process.argv[2] ?? 150);
const dir = path.join(os.tmpdir(), "chemlab-shots", "accept-demo");
fs.mkdirSync(dir, { recursive: true });

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(dir, "0-portal.png") });

const t0 = Date.now();
await page.locator("[data-demo-id='demo-mode-open']").click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(dir, "1-overlay-open.png") });

const captions = [];
const scenes = [];
let lastCap = "";
let lastSrc = "";
let lastChange = Date.now();

for (;;) {
  if ((Date.now() - t0) / 1000 > limit) break;
  await page.waitForTimeout(600);
  const src = await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "");
  const cap = await page.locator(".demo-caption__text").innerText().catch(() => "");
  if (src && src !== lastSrc) {
    lastSrc = src;
    scenes.push({ t: Math.round((Date.now() - t0) / 1000), src });
    const idx = scenes.length;
    const name = src.replace(/[/?=&]+/g, "_").replace(/^_+|_+$/g, "") || "home";
    await page.screenshot({ path: path.join(dir, `${idx + 1}-${name}.png`) });
  }
  if (cap && cap !== lastCap) {
    lastCap = cap;
    lastChange = Date.now();
    captions.push({ t: Math.round((Date.now() - t0) / 1000), cap });
  }
  const gap = (Date.now() - lastChange) / 1000;
  if (gap > 12) {
    console.log(`⚠ ${Math.round(gap)}s 没有新字幕（疑似卡住），当前位置 ${lastSrc}`);
    break;
  }
  if (scenes.length >= 6 && captions.length > 14) break;
}

// 结果页截图（报告）
const frameText = await page.frameLocator(".demo-frame__iframe").locator("body").innerText().catch(() => "");
await page.screenshot({ path: path.join(dir, "9-end.png"), fullPage: false });

// 退出 + 重来
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
const closed = (await page.locator(".demo-overlay").count()) === 0;
await page.locator("[data-demo-id='demo-mode-open']").click();
await page.waitForTimeout(500);
await page.locator("[data-demo-id='demo-mode-restart']").click();
await page.waitForTimeout(2500);
const restartedSrc = await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "");
await page.locator("[data-demo-id='demo-mode-exit']").click();
await page.waitForTimeout(300);
const closedByBtn = (await page.locator(".demo-overlay").count()) === 0;

await b.close();

const gaps = captions.slice(1).map((c, i) => c.t - captions[i].t);
const maxGap = Math.max(...gaps, 0);
console.log("\n=== 场景 ===");
for (const s of scenes) console.log(`  ${String(s.t).padStart(3)}s  ${s.src}`);
console.log(`\n=== 字幕 ${captions.length} 条，最大间隔 ${maxGap}s ===`);
for (const c of captions.slice(0, 12)) console.log(`  ${String(c.t).padStart(3)}s  ${c.cap.slice(0, 52)}`);
console.log("\n=== 交互 ===");
console.log("  Esc 可退出:", closed);
console.log("  重来回到首场:", restartedSrc);
console.log("  退出按钮可关:", closedByBtn);
console.log("  页内出现报告字样:", /总分|实验报告/.test(frameText));
console.log("\n截图目录:", dir);
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 3)));
