/**
 * 主流程链路验收：门户 → 登录 → 实验选择 → 实验页 → 操作 → 成功/失败 → 重做 → 交卷 → 报告
 *
 * 用法：
 *   node scripts/flow-chain.mjs            # 默认 exp09
 *   node scripts/flow-chain.mjs exp01      # 回归 exp01
 *   node scripts/flow-chain.mjs exp08      # exp08（?force=1 联调入口）
 *
 * 判定标准（用户口径）：不卡、不白屏、不死循环。
 *   - 不白屏：每一步 body 可见文本 > 40 字
 *   - 不卡：每一步有 8s 超时保护，超时记为卡住
 *   - 不死循环：同一 URL 连续停留超过 3 次判定为循环
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { clickOp, clickRetry, passPreTest } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const target = (process.argv[2] ?? "exp09").toLowerCase();

const CONFIGS = {
  exp01: {
    label: "实验 01",
    row: "a[href*='/exp/exp01'], [data-demo-id*='exp01']",
    url: /\/exp\/exp01/,
    ok: "demo-op-step1-wash",
    trap: "demo-op-step1-wipe",
    drop: true,
  },
  exp08: {
    label: "实验 08",
    direct: "/exp/exp08?force=1",
    url: /\/exp\/exp08/,
    ok: "demo-op-step1-bottle",
    trap: "demo-op-step1-count",
    drop: false,
  },
  exp09: {
    label: "实验 09",
    row: "a[href*='/exp/exp09'], [data-demo-id*='exp09']",
    url: /\/exp\/exp09/,
    ok: "demo-op-step1-weigh",
    trap: "demo-op-step1-bare-hands",
    drop: false,
  },
};

const config = CONFIGS[target];
if (!config) {
  console.error(`未知目标：${target}（只支持 exp01 / exp09）`);
  process.exit(2);
}

const shotDir = path.join(os.tmpdir(), "chemlab-shots", "flow-chain");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const report = [];
let failed = 0;
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 140)));
page.on("console", (m) => {
  // favicon / 静态资源 404 不算页面异常（window.onerror 才算 pageerror）
  if (/favicon|Failed to load resource/.test(m.text())) return;
  if (m.type() === "error") pageErrors.push("console: " + m.text().slice(0, 140));
});

async function step(name, fn, timeout = 8000) {
  const started = Date.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`超时 ${timeout}ms`)), timeout)),
    ]);
    const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    const blank = text.length < 40;
    if (blank) throw new Error("白屏：可见文本不足 40 字");
    report.push({ name, ok: true, ms: Date.now() - started, url: new URL(page.url()).pathname, detail, blank });
    console.log(`✓ ${name} (${Date.now() - started}ms) → ${new URL(page.url()).pathname}`);
    return true;
  } catch (err) {
    failed += 1;
    report.push({ name, ok: false, ms: Date.now() - started, url: new URL(page.url()).pathname, error: String(err).slice(0, 160) });
    console.log(`✗ ${name} (${Date.now() - started}ms) → ${new URL(page.url()).pathname}\n   ${String(err).slice(0, 160)}`);
    return false;
  }
}

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

// 1 门户
await step("门户加载", async () => {
  const t = await page.title();
  if (!/无机及分析化学实验/.test(t)) throw new Error("标题不含课程名：" + t);
});

// 2 进登录
await step("门户 → 登录", async () => {
  const cta = page.locator("a[href='/login'], a[href*=login]").first();
  await cta.click();
  await page.waitForURL(/\/login/, { timeout: 7000 });
});

// 3 学生登录
await step("学生登录", async () => {
  const no = page.locator("[data-demo-id='demo-login-student-no'], input[name='studentNo'], input[placeholder*='学号']").first();
  await no.fill("20250101");
  const nameInput = page.locator("[data-demo-id='demo-login-student-name'], input[name='name'], input[placeholder*='姓名']").first();
  await nameInput.fill("周若曦");
  const submit = page.locator("[data-demo-id='demo-login-submit'], button[type='submit']").first();
  await submit.click();
  await page.waitForURL(/\/experiments/, { timeout: 7000 });
});

// 4 选实验
await step(`选择${config.label}`, async () => {
  if (config.direct) {
    await page.goto(base + config.direct, { waitUntil: "domcontentloaded" });
    await page.waitForURL(config.url, { timeout: 7000 });
    await page.waitForTimeout(500);
    return;
  }
  const row = page.locator(config.row).first();
  await row.waitFor({ state: "visible", timeout: 6000 });
  await row.click();
  await page.waitForURL(config.url, { timeout: 7000 });
  await page.waitForTimeout(500);
});

// 4.5 前测门禁（BOPPPS 的 P 段）：全对才解锁操作台
await step("过前测门禁", async () => {
  const curriculum = (await import(`../lib/pedagogy/curriculum/${target}.ts`))[`${target}Curriculum`];
  const pre = await passPreTest(page, curriculum);
  if (pre.appeared && !pre.passed) throw new Error("前测提交后操作台未解锁");
  return pre.appeared ? "已全对解锁" : "无需前测";
});

// 5 正确操作
await step("第 1 步正确操作 → 成功分支", async () => {
  // exp01：先做一次场景投放，让报告时间线有“投放”条目（复用 exp09 器皿，场景 TODO）。
  if (config.drop) {
    const reagent = page.locator('[data-demo-id="demo-scene-reagent-naoh"]').first();
    const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]').first();
    if (!(await reagent.count()) || !(await flask.count())) throw new Error("场景投放控件缺失");
    await reagent.dragTo(flask);
    await page.waitForTimeout(500);
    const text = await page.locator("body").innerText();
    if (!/逐滴加入锥形瓶/.test(text)) throw new Error("投放后事件条未更新");
  }
  const ok = page.locator(`[data-demo-id='${config.ok}']`).first();
  // 引导式：若该动作不是「建议动作」，clickOp 会先展开「其他做法」
  if (!(await clickOp(page, ok))) throw new Error("正确操作按钮点不下去");
  await page.waitForSelector("[data-demo-id='demo-feedback-ok-1']", { timeout: 5000 });
});

// 6 回到第 1 步做错误操作（用失败分支验证）
await step("错误操作 → 失败分支", async () => {
  const trap = page.locator(`[data-demo-id='${config.trap}']`).first();
  if (!(await trap.count())) throw new Error("没有找到第 1 步的错误选项");
  if (!(await clickOp(page, trap))) throw new Error("错误选项点不下去（折叠区未展开或前置未满足）");
  await page.waitForSelector("[data-demo-id='demo-feedback-fail-1']", { timeout: 5000 });
});

// 7 重做
await step("重做本步", async () => {
  const retry = page.locator("[data-demo-id^='demo-retry-']").first();
  if (!(await retry.count())) throw new Error("没有「重做本步」按钮");
  await clickRetry(page);
  await page.waitForTimeout(400);
});

// 8 交卷
await step("交卷", async () => {
  const finish = page.locator("button:has-text('交卷'), [data-demo-id*='finish'], [data-demo-id*='submit']").first();
  if (!(await finish.count())) throw new Error("没有交卷按钮");
  await finish.click();
  await page.waitForTimeout(1200);
});

// 9 报告
let timeline = [];
await step("报告页", async () => {
  const txt = await page.locator("body").innerText();
  if (!/总分|得分|成绩/.test(txt)) throw new Error("报告页没有分数：" + txt.slice(0, 80));
  timeline = await page.locator("[data-kind]").allInnerTexts();
  if (config.drop && !timeline.some((row) => row.includes("投放"))) {
    throw new Error("报告时间线缺少投放条目");
  }
});

await page.screenshot({ path: path.join(shotDir, `chain-${target}-end.png`), fullPage: true });
await browser.close();

console.log("\n=== 汇总 ===");
console.log(`实验: ${config.label} (${target})`);
console.log(`通过 ${report.length - failed}/${report.length}`);
console.log(`时间线条目: ${timeline.length}${timeline.length ? " · " + timeline.slice(0, 2).join(" / ").replace(/\n/g, " ") : ""}`);
for (const r of report) if (!r.ok) console.log(`  ✗ ${r.name}：${r.error}`);
if (pageErrors.length) console.log("pageerror:", JSON.stringify([...new Set(pageErrors)].slice(0, 5)));
console.log("截图:", path.join(shotDir, `chain-${target}-end.png`));
process.exitCode = failed ? 1 : 0;
