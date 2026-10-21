/**
 * ③ 一键演示节奏验收（播放器 = /demo?autoplay=1）。
 * 通过 .demo-bar__state 的 data-state 判断 playing/done，测真实单场时长。
 * 口径：单场 40~90s。
 * 用法：node .team/demo-pacing-check.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const stateOf = () =>
  page.locator(".demo-bar__state").first().getAttribute("data-state").catch(() => null);

await page.goto(`${BASE}/demo?autoplay=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

const rows = [];

async function measure(label, maxSec = 150) {
  const t0 = Date.now();
  let sawPlaying = false;
  let done = false;
  for (let i = 0; i < maxSec; i++) {
    await page.waitForTimeout(1000);
    const s = await stateOf();
    if (s === "playing") sawPlaying = true;
    if (sawPlaying && s === "done") {
      done = true;
      break;
    }
  }
  rows.push({ 场次: label, 秒数: Math.round((Date.now() - t0) / 1000), 播完: done });
}

await measure("第 1 场（首页 home）");

// 用下拉框切到 exp09（比点三次"下一场"稳）
await page.selectOption('[data-demo-id="demo-page-script"]', "exp09").catch(() => undefined);
await page.waitForTimeout(1500);
await page.locator('[data-demo-id="demo-page-play"]').click().catch(() => undefined);
await page.waitForTimeout(1500);
await measure("实验场 exp09");

await browser.close();
console.log("场次\t\t\t秒数\t播完");
for (const r of rows) console.log(`${r.场次}\t${r.秒数}s\t${r.播完 ? "✅" : "❌"}`);
const ok = rows.every((r) => r.播完 && r.秒数 >= 40 && r.秒数 <= 90);
console.log("");
console.log(ok ? "✅ 单场落在 40~90s" : "❌ 时长不在 40~90s（或没播完）");
process.exit(ok ? 0 : 1);
