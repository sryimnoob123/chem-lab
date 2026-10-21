/**
 * 复核两处翻车点（本地 + 线上同测）：
 *   A. 一键演示按钮热区 ≥32px（点击区 boundingBox）
 *   B. 登录页写清演示账号 20250101 / 周若曦
 * 用法：node .team/hotspot-and-login-copy-check.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch();
const rows = [];
const problems = [];

// A. /demo 的播放按钮 + 场次切换
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const sizes = await page.evaluate(() => {
    const out = {};
    for (const id of ["demo-page-play", "demo-page-replay", "demo-page-script"]) {
      const el = document.querySelector(`[data-demo-id="${id}"]`);
      if (!el) {
        out[id] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      out[id] = { w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  });
  for (const [id, s] of Object.entries(sizes)) {
    const ok = s && s.w >= 32 && s.h >= 32;
    rows.push({ 项: `热区 ${id} ≥32px`, 结果: ok ? "PASS" : "FAIL", 说明: s ? `${s.w}×${s.h}` : "元素不存在" });
    if (!ok) problems.push(`${id} 热区 ${s ? `${s.w}×${s.h}` : "缺失"}`);
  }
  await ctx.close();
}

// B. 登录页演示账号文案
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const hasNo = body.includes("20250101");
  const hasName = body.includes("周若曦");
  const hasHint = /演示|示例|默认账号/.test(body);
  const ok = hasNo && hasName;
  rows.push({
    项: "登录页写清演示账号",
    结果: ok ? "PASS" : "FAIL",
    说明: `学号=${hasNo} 姓名=${hasName} 有演示字样=${hasHint}`,
  });
  if (!ok) problems.push(`登录页缺少演示账号：${body.slice(0, 160)}`);

  // 顺带记录输入框预填值
  const filled = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((el) => el.value).filter(Boolean),
  );
  rows.push({ 项: "登录页预填值", 结果: filled.length >= 2 ? "PASS" : "WARN", 说明: JSON.stringify(filled) });
  await ctx.close();
}

await browser.close();
console.log(`BASE = ${BASE}`);
console.log("项\t\t\t\t结果\t说明");
for (const r of rows) console.log(`${r.项}\t${r.结果}\t${r.说明}`);
console.log("");
console.log(problems.length === 0 ? "✅ 两处复核全 PASS" : `❌ ${problems.length} 个问题`);
process.exit(problems.length === 0 ? 0 : 1);
