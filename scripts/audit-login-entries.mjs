/**
 * 登录两条入口实测（用户 2026-10-22 要求）：
 *  - 学生：学号/姓名留空、乱填，都必须进实验台，任何校验都不许拦
 *  - 教师：从入口点开直达 /teacher，不弹口令
 * 用法：node scripts/audit-login-entries.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const results = [];

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  return { ctx, page: await ctx.newPage() };
}

// ---- 1) 学生留空 ----
{
  const { ctx, page } = await fresh();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 80)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const noInput = page.locator("input[name='studentNo'], input[id*='studentNo'], input[autocomplete='username']").first();
  const nameInput = page.locator("input[name='name'], input[id*='name'], input[autocomplete='name']").first();
  const had = { no: await noInput.count(), name: await nameInput.count() };
  if (had.no) await noInput.fill("");
  if (had.name) await nameInput.fill("");
  const submit = page.locator("[data-demo-id='demo-login-submit']").first();
  await submit.click().catch(() => undefined);
  await page.waitForTimeout(3000);
  results.push({
    label: "学生·留空",
    inputs: had,
    url: new URL(page.url()).pathname,
    passed: page.url().includes("/experiments"),
    error: errs[0] ?? null,
  });
  await page.screenshot({ path: "public/shots-prod/redteam/login-student-blank.png" });
  await ctx.close();
}

// ---- 2) 学生乱填 ----
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const noInput = page.locator("input[name='studentNo'], input[id*='studentNo'], input[autocomplete='username']").first();
  const nameInput = page.locator("input[name='name'], input[id*='name'], input[autocomplete='name']").first();
  if (await noInput.count()) await noInput.fill("abc-999-x");
  if (await nameInput.count()) await nameInput.fill("随便写的");
  await page.locator("[data-demo-id='demo-login-submit']").first().click().catch(() => undefined);
  await page.waitForTimeout(3000);
  results.push({ label: "学生·乱填", url: new URL(page.url()).pathname, passed: page.url().includes("/experiments") });
  await ctx.close();
}

// ---- 3) 教师入口 ----
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  // 切到教师角色（tab / 分段控件）
  const teacherTab = page.locator("[data-demo-id*='teacher'], button:has-text('教师')").first();
  if (await teacherTab.count()) {
    await teacherTab.click().catch(() => undefined);
    await page.waitForTimeout(600);
  }
  const before = await page.evaluate(() => ({
    hasPasscode: !!document.querySelector("input[type='password'], input[name='passcode']"),
  }));
  const quick = page.locator("[data-demo-id='demo-login-quick-teacher']").first();
  const hasQuick = await quick.count();
  if (hasQuick) await quick.click().catch(() => undefined);
  await page.waitForTimeout(3000);
  results.push({
    label: "教师·入口",
    passcodeFieldVisible: before.hasPasscode,
    hasQuickButton: hasQuick,
    url: new URL(page.url()).pathname,
    passed: page.url().includes("/teacher"),
  });
  await page.screenshot({ path: "public/shots-prod/redteam/login-teacher.png" });
  await ctx.close();
}

// ---- 4) 直接访问 /teacher ----
{
  const { ctx, page } = await fresh();
  const resp = await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  results.push({ label: "直接 /teacher", status: resp?.status() ?? null, url: new URL(page.url()).pathname });
  await ctx.close();
}

console.log(JSON.stringify({ results }, null, 2));
await browser.close();
