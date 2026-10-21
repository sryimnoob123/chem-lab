/**
 * 截预览页（自查视觉用）
 * 用法：node scripts/shot-preview.mjs [url]
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const url = process.argv[2] ?? "http://localhost:3001/preview.html";
const out = path.join(os.tmpdir(), "chemlab-shots", "preview-page.png");
import("node:fs").then((fs) => fs.mkdirSync(path.dirname(out), { recursive: true }));

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
page.on("requestfailed", (r) => errors.push("failed: " + r.url().slice(-60)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
// 触发懒加载图片
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(800);
const broken = await page.evaluate(() =>
  [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src.split("/").slice(-2).join("/"))
);
await page.screenshot({ path: out, fullPage: true });
const h = await page.evaluate(() => document.body.scrollHeight);
const imgs = await page.evaluate(() => document.images.length);
console.log(`截图: ${out}`);
console.log(`页面高 ${h}px · 图片 ${imgs} 张 · 坏图 ${broken.length}${broken.length ? " → " + broken.slice(0, 5).join(", ") : ""} · 报错 ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 3).join(" | "));
await b.close();
process.exitCode = broken.length || errors.length ? 1 : 0;
