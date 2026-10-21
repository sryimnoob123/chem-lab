/**
 * 演示模式验收：右上角按钮 → 浮层自动播放 → 旁白推进 → Esc 退出 → 重来。
 * 用法：node scripts/demo-mode-check.mjs
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const shotDir = path.join(os.tmpdir(), "chemlab-shots", "demo-mode");
let fail = 0;
const log = (ok, name, extra = "") => {
  if (!ok) fail += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? " · " + extra : ""}`);
};

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);

// 1 按钮存在于右上角
const btn = page.locator("[data-demo-id='demo-mode-open']").first();
log((await btn.count()) > 0, "右上角有「演示模式」按钮");
const box = await btn.boundingBox();
log(Boolean(box && box.x > 1000), "按钮在右上角", box ? `x=${Math.round(box.x)}` : "无");

// 2 点击开浮层
await btn.click();
await page.waitForTimeout(400);
const overlay = page.locator(".demo-overlay");
log((await overlay.count()) > 0, "点击后浮层打开");
await page.screenshot({ path: path.join(shotDir, "01-open.png") });

// 3 自动播放：等字幕推进
const captions = new Set();
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(1000);
  const t = await page.locator(".demo-caption__text").innerText().catch(() => "");
  if (t) captions.add(t);
}
log(captions.size >= 3, "旁白自动推进", `${captions.size} 条不同字幕`);
console.log("   字幕样本：", [...captions].slice(0, 3).join(" | ").slice(0, 110));
await page.screenshot({ path: path.join(shotDir, "02-playing.png") });

// 4 切场（页面推进）
const frameUrl1 = await page.locator(".demo-frame__iframe").getAttribute("src");

// 5 重来
await page.locator("[data-demo-id='demo-mode-restart']").click();
await page.waitForTimeout(800);
const frameUrl2 = await page.locator(".demo-frame__iframe").getAttribute("src");
log(Boolean(frameUrl2), "「从头再演一遍」可用", `重置到 ${frameUrl2}`);

// 6 Esc 退出
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
log((await page.locator(".demo-overlay").count()) === 0, "Esc 退出浮层");
log((await page.locator("body").evaluate((n) => getComputedStyle(n).overflow)) !== "hidden", "退出后页面可滚动");

// 7 退出按钮
await btn.click();
await page.waitForTimeout(300);
await page.locator("[data-demo-id='demo-mode-exit']").click();
await page.waitForTimeout(300);
log((await page.locator(".demo-overlay").count()) === 0, "「退出演示」按钮可关");

// 8 封面页也有按钮
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
log((await page.locator("[data-demo-id='demo-mode-open']").count()) > 0, "封面也有演示模式入口");
await page.screenshot({ path: path.join(shotDir, "03-cover.png") });

await b.close();
console.log(`\n${fail === 0 ? "全部通过" : `失败 ${fail} 项`}`);
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 4)));
console.log("截图:", shotDir);
process.exitCode = fail ? 1 : 0;
