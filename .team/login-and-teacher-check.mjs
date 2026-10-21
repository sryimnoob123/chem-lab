/**
 * ② 登录链路验收：
 *   A. 学生学号/姓名「留空」直接进
 *   B. 学生随便乱填直接进
 *   C. 教师端 /teacher 打开即进后台，不弹口令（写操作才要口令）
 * 用法：node .team/login-and-teacher-check.mjs
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
  return { ctx, page, errs };
}

// A / B：在登录页直接点「进入」——表单留空或乱填都要能进
for (const [label, values] of [
  ["学生·留空直接进", { no: "", name: "" }],
  ["学生·乱填直接进", { no: "99999999", name: "张三三" }],
]) {
  const { ctx, page, errs } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  // 清掉预填（如果有），再按需填写
  const inputs = page.locator("input");
  const count = await inputs.count();
  if (count >= 1) await inputs.nth(0).fill(values.no);
  if (count >= 2) await inputs.nth(1).fill(values.name);

  const submit = page.getByRole("button", { name: /进入|登录|开始/ }).first();
  await submit.click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1200);

  const url = page.url();
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const ok = !/\/login/.test(url) && body.length > 80;
  rows.push({ 环节: label, 结果: ok ? "PASS" : "FAIL", 说明: `${new URL(url).pathname} · ${body.length} 字符${errs.length ? ` · ${errs.length} 报错` : ""}` });
  if (!ok) problems.push(`${label}: 停在 ${url}`);
  await ctx.close();
}

// C：教师端
{
  const { ctx, page, errs } = await fresh();
  const resp = await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const hasPasswordPrompt = /请输入教师口令|口令不对/.test(body);
  const hasRoster = /学号|姓名|班级|成绩|花名册|平均/.test(body);
  const ok = resp?.status() === 200 && hasRoster && !hasPasswordPrompt;
  rows.push({
    环节: "教师端·打开即进后台（不弹口令）",
    结果: ok ? "PASS" : "FAIL",
    说明: `HTTP ${resp?.status()} · 学情=${hasRoster} · 口令框=${hasPasswordPrompt}${errs.length ? ` · ${errs.length} 报错` : ""}`,
  });
  if (!ok) problems.push("教师端: " + rows.at(-1).说明);
  await ctx.close();
}

await browser.close();
console.log("环节\t\t\t结果\t说明");
for (const r of rows) console.log(`${r.环节}\t${r.结果}\t${r.说明}`);
console.log("");
console.log(problems.length === 0 ? "✅ 三项全 PASS" : `❌ ${problems.length} 项未过`);
process.exit(problems.length === 0 ? 0 : 1);
