/**
 * exp09 两条路径验收：
 *   A. 人工：走到第 7 步，核对建议动作按钮文案是否按「数据台实际控件」写的
 *   B. auto：?autodemo=1 跑到最后自动交卷并落到报告页
 * 用法：node .team/exp09-two-paths.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch();
const rows = [];
const problems = [];

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource|401|403/.test(m.text())) {
      errs.push(m.text().slice(0, 120));
    }
  });
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
  return { ctx, page, errs };
}

const stepNow = (page) =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
  });

// A. 人工路径：走到第 7 步看按钮文案
{
  const { ctx, page, errs } = await fresh();
  await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  for (let i = 0; i < 40; i++) {
    const s = await stepNow(page);
    if (s && s.cur >= 7) break;
    const op = page.locator('[data-demo-id^="demo-op-"]').first();
    if (await op.isVisible().catch(() => false)) {
      await op.click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(800);
    } else {
      await page.waitForTimeout(600);
    }
  }

  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const checks = [
    ["第 7 步按钮写「再滴定」且点明补齐 3 行读数", /点「再滴定」补齐 3 行读数/.test(text)],
    ["文案指向数据台的读数（不是别步的滴定终点）", /数据台|3 行读数/.test(text)],
    ["没有残留旧文案「再滴定 2 次凑满」", !/再滴定 2 次凑满/.test(text)],
  ];
  for (const [name, ok] of checks) {
    rows.push({ 路径: "A 人工·exp09 第7步文案", 结果: ok ? "PASS" : "FAIL", 说明: name });
    if (!ok) problems.push(name);
  }
  rows.push({ 路径: "A 人工·第7步页面", 结果: errs.length ? "FAIL" : "PASS", 说明: `${text.length} 字符${errs.length ? ` · ${errs.slice(0, 1)}` : ""}` });
  if (errs.length) problems.push(`人工路径报错: ${errs[0]}`);
  await ctx.close();
}

// B. auto 路径
{
  const { ctx, page, errs } = await fresh();
  const t0 = Date.now();
  await page.goto(`${BASE}/exp/exp09?force=1&autodemo=1`, { waitUntil: "domcontentloaded" });
  let landed = false;
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(2000);
    if (/\/report/.test(page.url())) {
      landed = true;
      break;
    }
  }
  const sec = Math.round((Date.now() - t0) / 1000);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 100));
  rows.push({
    路径: "B auto·自动交卷到报告页",
    结果: landed ? "PASS" : "FAIL",
    说明: landed ? `${sec}s → ${body}` : `停在 ${page.url()}`,
  });
  if (!landed) problems.push("auto 没落到报告页");
  await ctx.close();
}

await browser.close();
console.log("路径\t\t\t\t\t结果\t说明");
for (const r of rows) console.log(`${r.路径}\t${r.结果}\t${r.说明}`);
console.log("");
console.log(problems.length === 0 ? "✅ 两条路径全 PASS" : `❌ ${problems.length} 个问题`);
process.exit(problems.length === 0 ? 0 : 1);
