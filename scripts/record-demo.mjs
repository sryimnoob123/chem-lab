/**
 * 录制交差视频：打开首页 → 点右上角「演示模式」→ 让它自己演 → 录屏。
 *
 * 用法：node scripts/record-demo.mjs [秒数=140]
 * 产物：%TEMP%\chemlab-shots\handoff-<stamp>\*.webm
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const seconds = Number(process.argv[2] ?? 140);
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const outDir = path.join(os.tmpdir(), "chemlab-shots", `handoff-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  recordVideo: { dir: outDir, size: { width: 1600, height: 1000 } },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-demo-id='demo-mode-open']").click();
console.log(`录制中 ${seconds}s …`);

const started = Date.now();
let last = "";
while (Date.now() - started < seconds * 1000) {
  await page.waitForTimeout(2000);
  const cap = await page.locator(".demo-caption__text").innerText().catch(() => "");
  const src = await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "");
  if (cap && cap !== last) {
    console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${src} · ${cap.slice(0, 46)}`);
    last = cap;
  }
}

await ctx.close();
await browser.close();

const video = fs.readdirSync(outDir).find((f) => f.endsWith(".webm"));
const full = video ? path.join(outDir, video) : null;
console.log("\n视频:", full ?? "未生成");
if (full) console.log("大小:", (fs.statSync(full).size / 1024 / 1024).toFixed(1), "MB");
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 3)));
