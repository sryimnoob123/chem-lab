/**
 * ⑥ 演示全路径巡检：新手引导 → exp01/03/09 → 事故 L1~L4 → 报告 → 教师后台。
 * 只盯三件事：空白页、死链（非 2xx）、控制台 error / pageerror。
 * 用法：node .team/full-path-check.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const problems = [];
const rows = [];

const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});

async function newPage(ctx) {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${String(e.message).slice(0, 120)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/favicon|Failed to load resource|401|403/.test(t)) return; // 鉴权类预期
    errs.push(`console: ${t.slice(0, 120)}`);
  });
  return { page, errs };
}

async function check(label, page, errs) {
  const info = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    return { len: text.length, url: location.pathname + location.search, code: document.title };
  });
  const row = { 环节: label, 结果: "PASS", 说明: `${info.len} 字符` };
  if (info.len < 40) {
    row.结果 = "FAIL";
    row.说明 = `空白页（${info.len} 字符）@ ${info.url}`;
    problems.push(row.说明);
  } else if (errs.length) {
    row.结果 = "FAIL";
    row.说明 = `${errs.length} 条报错：${errs.slice(0, 2).join(" | ")}`;
    problems.push(`${label}: ${row.说明}`);
  }
  errs.length = 0;
  rows.push(row);
  return row;
}

async function login(page) {
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
}

const stepNow = (page) =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
  });

/** 一路点建议动作到结束→交卷→等报告页 */
async function runExperiment(page, errs, expId) {
  const resp = await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
  if (!resp || resp.status() !== 200) problems.push(`${expId} 进实验 HTTP ${resp?.status()}`);
  await page.waitForTimeout(2200);
  // 新手引导（第一次进会弹）
  const onboarding = page.locator('[data-demo-id="demo-onboarding"]');
  if (await onboarding.isVisible().catch(() => false)) {
    await onboarding.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await check(`${expId} 进实验`, page, errs);

  for (let i = 0; i < 45; i++) {
    const s = await stepNow(page);
    if (s && s.cur >= s.total) break;
    const op = page.locator('[data-demo-id^="demo-op-"]').first();
    if (await op.isVisible().catch(() => false)) {
      await op.click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(800);
    } else {
      await page.waitForTimeout(600);
    }
  }
  const done = await stepNow(page);
  await page.locator('[data-demo-id="demo-finish"]').first().click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForURL(/\/report/, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await check(`${expId} 交卷→报告`, page, errs);
  return done;
}

// A. 新手引导 + 三个实验
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, errs } = await newPage(ctx);
  await login(page);

  // 先把新手引导单独看一眼（新 context 没存"看过"）
  await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  const hasOnboarding = await page.locator('[data-demo-id="demo-onboarding"]').isVisible().catch(() => false);
  rows.push({
    环节: "新手引导（首次进实验）",
    结果: hasOnboarding ? "PASS" : "FAIL",
    说明: hasOnboarding ? "4 步引导卡已弹出" : "没弹",
  });
  if (!hasOnboarding) problems.push("新手引导没有弹出");
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(400);

  for (const expId of ["exp01", "exp03", "exp09"]) {
    await runExperiment(page, errs, expId);
  }
  await ctx.close();
}

// B. 事故 L1~L4：点「其他做法」里的陷阱，检查事故条等级
{
  const TRAPS = [
    { exp: "exp01", op: "demo-op-step1-wipe", level: "L1", name: "纸巾擦容量瓶内壁" },
    { exp: "exp01", op: "demo-op-step1-oven", level: "L2", name: "容量瓶进 105℃ 烘箱" },
    { exp: "exp09", op: "demo-op-step1-bare-hands", level: "L3", name: "徒手抓 NaOH" },
    { exp: "exp03", op: "demo-op-step1-open", level: "L4", name: "敞口量冰醋酸并加水" },
  ];
  for (const t of TRAPS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errs } = await newPage(ctx);
    await login(page);
    await page.goto(`${BASE}/exp/${t.exp}?force=1`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
    await page.waitForTimeout(400);

    // 展开「其他做法」
    const other = page.locator('[data-demo-id="demo-other-ways"]').first();
    if (await other.isVisible().catch(() => false)) {
      await other.click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(500);
    }
    const trap = page.locator(`[data-demo-id="${t.op}"]`).first();
    const ok = await trap.isVisible().catch(() => false);
    if (ok) {
      await trap.click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(1600);
    }
    const level = await page.evaluate(() => {
      const el = document.querySelector("[data-level]");
      return el ? el.getAttribute("data-level") : null;
    });
    const row = {
      环节: `事故 ${t.level}（${t.name}）`,
      结果: level === t.level ? "PASS" : "FAIL",
      说明: level ? `data-level=${level}` : "没找到事故条",
    };
    if (row.结果 === "FAIL") problems.push(`${row.环节}: ${row.说明}`);
    rows.push(row);
    await check(`事故 ${t.level} 后页面`, page, errs);
    await ctx.close();
  }
}

// C. 教师后台
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, errs } = await newPage(ctx);
  const resp = await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
  if (!resp || resp.status() !== 200) problems.push(`/teacher HTTP ${resp?.status()}`);
  await page.waitForTimeout(1500);
  await check("教师后台 /teacher", page, errs);
  const hasRoster = await page.evaluate(() => /学号|姓名|班级|成绩|花名册/.test(document.body.innerText));
  rows.push({ 环节: "教师后台内容", 结果: hasRoster ? "PASS" : "FAIL", 说明: hasRoster ? "有学情表格" : "没看到学情" });
  if (!hasRoster) problems.push("教师后台没有学情内容");
  await ctx.close();
}

await browser.close();

console.log("环节\t\t结果\t说明");
for (const r of rows) console.log(`${r.环节}\t${r.结果}\t${r.说明}`);
console.log("");
if (problems.length === 0) {
  console.log("✅ 全路径 PASS：无空白页 / 无死链 / 无控制台 error");
  process.exit(0);
}
console.log(`❌ ${problems.length} 个问题：`);
for (const p of problems) console.log("  - " + p);
process.exit(1);
