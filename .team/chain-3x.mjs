/**
 * 演示前整链 3 遍自测：登录 → 选实验 → 逐步操作 → 交卷 → 报告页。
 * 只盯三件事：空白页、死链（非 2xx）、控制台 error。撞见一个就打印出来。
 *
 * 第 1~3 遍：exp01 / exp03 / exp09 各走一遍「逐步点建议动作 → 交卷」
 * 第 4 遍：一键演示 `/demo?autoplay=1`（自动播放到报告页）
 *
 * 用法：node .team/chain-3x.mjs
 */
import { chromium } from "@playwright/test";
import { dismissOnboarding } from "../scripts/lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const EXPS = ["exp01", "exp03", "exp09"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 140)}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource|401|403/.test(t)) return; // 鉴权类是预期
  consoleErrors.push(`console: ${t.slice(0, 140)}`);
});

const problems = [];
const rows = [];

async function checkPage(step) {
  const info = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    return { textLen: text.length, href: location.pathname + location.search };
  });
  if (info.textLen < 40) problems.push(`${step}: 空白页（${info.textLen} 字符）@ ${info.href}`);
  if (consoleErrors.length) {
    problems.push(`${step}: 控制台 ${consoleErrors.length} 条 -> ${consoleErrors.slice(0, 2).join(" | ")}`);
  }
  consoleErrors = [];
  return info;
}

// 登录一次
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
const loginResp = await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});
if (!loginResp.ok()) problems.push(`登录失败: ${loginResp.status()}`);

// 第 1~3 遍：三个实验各走一遍逐步操作
for (const expId of EXPS) {
  const t0 = Date.now();
  const row = { 轮次: `逐步 · ${expId}`, 落报告: false, 步数: 0, 用时: 0 };

  const resp = await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
  if (!resp || resp.status() !== 200) problems.push(`${expId}: 进实验 HTTP ${resp?.status()}`);
  await page.waitForTimeout(1800);
  await dismissOnboarding(page).catch(() => undefined);
  await checkPage(`${expId} 进实验`);

  // 逐步点「建议动作」，最多 40 步。注意：
  // 交卷按钮（demo-finish）在页面上一直可见，不能拿它当"做完了"的判据；
  // 用「第 N 步 / 共 M 步」的进度判断，N === M 时再交卷。
  for (let step = 0; step < 40; step++) {
    const progress = await page.evaluate(() => {
      const m = document.body.innerText.match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
      return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
    });
    if (progress && progress.cur >= progress.total) break;

    const op = page.locator('[data-demo-id^="demo-op-"]').first();
    if (!(await op.isVisible().catch(() => false))) {
      await page.waitForTimeout(800);
      continue;
    }
    await op.click({ timeout: 4000 }).catch(() => undefined);
    row.步数 += 1;
    await page.waitForTimeout(700);

    // 偶尔会有「继续 / 下一题」类弹窗
    const cont = page.getByRole("button", { name: /继续|下一题|知道了/ }).first();
    if (await cont.isVisible().catch(() => false)) {
      await cont.click().catch(() => undefined);
      await page.waitForTimeout(400);
    }
  }

  // 交卷
  const finish = page.locator('[data-demo-id="demo-finish"]').first();
  if (await finish.isVisible().catch(() => false)) {
    await finish.click().catch(() => undefined);
    await page.waitForURL(/\/report/, { timeout: 25000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    row.落报告 = /\/report/.test(page.url());
  }
  await checkPage(`${expId} 报告页`);

  row.用时 = Math.round((Date.now() - t0) / 1000);
  rows.push(row);
}

// 第 4 遍：一键演示
{
  const t0 = Date.now();
  const row = { 轮次: "一键演示 /demo", 落报告: false, 步数: "-", 用时: 0 };
  const resp = await page.goto(`${BASE}/demo?autoplay=1`, { waitUntil: "domcontentloaded" });
  if (!resp || resp.status() !== 200) problems.push(`/demo: HTTP ${resp?.status()}`);
  await checkPage("/demo 打开");

  // demo 页每场约 60~75 秒；最多等 200 秒。
  // 报告页可能出现在 iframe 里，所以连所有 frame 的 URL 一起看。
  for (let i = 0; i < 100; i++) {
    await page.waitForTimeout(2000);
    const reached = page.frames().some((f) => /\/report/.test(f.url())) || /\/report/.test(page.url());
    if (reached) {
      row.落报告 = true;
      break;
    }
  }
  await checkPage("/demo 结束");
  row.用时 = Math.round((Date.now() - t0) / 1000);
  rows.push(row);
}

await browser.close();

console.log("轮次\t\t\t步数\t用时\t落报告");
for (const r of rows) {
  console.log(`${r.轮次}\t${r.步数}\t${r.用时}s\t${r.落报告 ? "✅" : "❌"}`);
}
console.log("");
if (problems.length === 0) {
  console.log("✅ 无空白页 / 无死链 / 无控制台 error");
  process.exit(0);
}
console.log(`❌ 发现 ${problems.length} 个问题：`);
for (const p of problems) console.log("  - " + p);
process.exit(1);
