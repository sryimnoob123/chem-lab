/**
 * 主流程冒烟（dev 友好版）
 *
 * 为什么不用 flow-chain.mjs：那个脚本 `waitUntil: "networkidle"`，在 dev 模式会被
 * Next 的 HMR 长连接卡到超时（30s），不是页面问题。生产模式（`npm run build` + 3001）仍用 flow-chain.mjs 做终验。
 *
 * 本脚本用 `domcontentloaded` + 显式等待，跑「登录 → 实验 → 正确 → 错误 → 重做 → 交卷 → 报告」。
 * 用户报 bug 后，先跑这个确认真实流程通不通，再定位。
 *
 * 用法：
 *   $env:BASE_URL="http://localhost:3002"; node scripts/flow-smoke.mjs
 *   node scripts/flow-smoke.mjs exp08
 *
 * 出口码：0 = 全通；1 = 有失败项
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clickOp, clickRetry, dismissOnboarding, loginStudent, waitForFeedback } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const target = (process.argv[2] ?? "exp01").toLowerCase();

const CONFIGS = {
  exp01: { ok: "demo-op-step1-wash", trap: "demo-op-step1-wipe", drop: true },
  exp08: { ok: "demo-op-step1-bottle", trap: "demo-op-step1-count", drop: false },
  exp09: { ok: "demo-op-step1-weigh", trap: "demo-op-step1-bare-hands", drop: false },
  exp02: { ok: "demo-op-step1-weigh", trap: "demo-op-step1-bare-hands", drop: false },
  exp03: { ok: "demo-op-step1-weigh", trap: "demo-op-step1-bare-hands", drop: false },
  exp04: { ok: "demo-op-step1-weigh", trap: "demo-op-step1-bare-hands", drop: false },
};
const config = CONFIGS[target];
if (!config) {
  console.error(`未知目标：${target}（支持 ${Object.keys(CONFIGS).join(" / ")}）`);
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const shotDir = path.join(os.tmpdir(), "chemlab-shots", `smoke-${stamp}`);
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 160)));
page.on("console", (m) => {
  const t = m.text();
  if (/favicon|Failed to load resource|Download the React DevTools/i.test(t)) return;
  if (m.type() === "error") pageErrors.push("console: " + t.slice(0, 160));
});

const rows = [];
let failed = 0;
async function step(name, fn, timeout = 12000) {
  const started = Date.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`超时 ${timeout}ms`)), timeout)),
    ]);
    const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    if (text.length < 40) throw new Error("白屏：可见文本不足 40 字");
    rows.push({ name, ok: true, ms: Date.now() - started, url: new URL(page.url()).pathname, detail });
    console.log(`✓ ${name} (${Date.now() - started}ms)`);
    return true;
  } catch (err) {
    failed += 1;
    rows.push({ name, ok: false, ms: Date.now() - started, url: new URL(page.url()).pathname, error: String(err).slice(0, 200) });
    console.log(`✗ ${name} (${Date.now() - started}ms) — ${String(err).slice(0, 200)}`);
    return false;
  }
}

// 1 门户（domcontentloaded，不赌 networkidle）
await step("门户加载", async () => {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const title = await page.title();
  if (!/无机及分析化学实验/.test(title)) throw new Error(`标题不含课程名：${title}`);
});

// 2 登录
await step("学生登录", async () => {
  const ok = await loginStudent(page, { base });
  if (!ok) throw new Error("登录后未跳转到 /experiments");
});

// 3 进实验
await step("进入实验", async () => {
  await page.goto(`${base}/exp/${target}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const url = page.url();
  if (!url.includes(`/exp/${target}`)) throw new Error(`未进入实验页：${url}`);
  // 新手教学（首次进实验自动弹）：新 context 永远算"第一次"，先关掉再点操作
  await dismissOnboarding(page);
});

// 4 正确操作
await step("正确操作 → 成功反馈", async () => {
  const ok = await clickOp(page, page.locator(`[data-demo-id='${config.ok}']`).first());
  if (!ok) throw new Error("正确操作按钮点不下去（disabled 或未找到）");
  const got = await waitForFeedback(page, "ok", { timeout: 6000 });
  if (!got) throw new Error("点了正确操作，6000ms 内没出现成功结果条");
});

// 5 错误操作
await step("错误操作 → 失败反馈", async () => {
  const trap = page.locator(`[data-demo-id='${config.trap}']`).first();
  if (!(await trap.count())) throw new Error("第 1 步没有陷阱选项");
  const ok = await clickOp(page, trap);
  if (!ok) throw new Error("错误选项点不下去（折叠区未展开或前置未满足）");
  const got = await waitForFeedback(page, "fail", { timeout: 6000 });
  if (!got) throw new Error("点了错误操作，6000ms 内没出现失败结果条");
});

// 6 重做
await step("重做本步", async () => {
  const retry = page.locator("[data-demo-id^='demo-retry-']").first();
  if (!(await retry.count())) throw new Error("没有「重做本步」按钮");
  await clickRetry(page);
  await page.waitForTimeout(400);
});

// 7 交卷（finish 走 /api/runs/:id/finish 后 router.push 到报告；dev 首次编译可能 10s+，必须等 URL 而不是死等）
await step("交卷", async () => {
  const finish = page.locator("[data-demo-id='demo-finish'], button:has-text('交卷')").first();
  if (!(await finish.count())) throw new Error("没有交卷按钮");
  await finish.click({ timeout: 6000 });
  await page.waitForURL(/\/report/, { timeout: 30000 });
  await page.waitForTimeout(800);
}, 40000);

// 8 报告
await step("报告页出分", async () => {
  const txt = await page.locator("body").innerText();
  if (!/总分|得分|成绩/.test(txt)) throw new Error("报告页没有分数");
});

await page.screenshot({ path: path.join(shotDir, `smoke-${target}-end.png`), fullPage: true });
await browser.close();

console.log("\n=== 汇总 ===");
console.log(`实验 ${target}：通过 ${rows.length - failed}/${rows.length}`);
for (const r of rows) if (!r.ok) console.log(`  ✗ ${r.name}：${r.error}`);
if (pageErrors.length) {
  console.log("pageerror（去重前 5 条）：");
  for (const e of [...new Set(pageErrors)].slice(0, 5)) console.log("  " + e);
  if (failed === 0) failed += 0; // pageerror 只记录，不改判定（视觉回归另算）
}
fs.writeFileSync(path.join(shotDir, "report.json"), JSON.stringify({ target, rows, pageErrors }, null, 2));
console.log("截图:", path.join(shotDir, `smoke-${target}-end.png`));
process.exitCode = failed ? 1 : 0;
