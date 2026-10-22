/**
 * .team/exp09-flow-mission-board-ui.mjs —— exp09 全流程回归（7 步 → 交卷 → 报告）。
 *
 * 只读产品代码，不改任何仓库文件；脚本本身落在 .team/ 下（角色名后缀避免撞名）。
 * 用法：BASE_URL=http://localhost:3001 node .team/exp09-flow-mission-board-ui.mjs
 * 输出：%TEMP%\chemlab-shots\exp09-flow\*.png + 控制台断言表
 *
 * 断言的语义（Lead 定的标准）：
 * 1. 每步 stepIndex 确实 +1（看 demo-guide-progress 的「第 N/7 步」）
 * 2. 没有卡住（同一步连续点是同一个动作 / 超过 8 次点击不推进 = 卡死）
 * 3. 7 步全部走完 → 交卷 → /exp/exp09/report 且有分数
 * 4. 打印每步的 demo-guide-card 文案 + 报告分数
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clickOp, dismissOnboarding, loginStudent } from "../scripts/lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "exp09-flow");
fs.mkdirSync(outDir, { recursive: true });

const rows = [];
let failed = 0;
const check = (name, ok, detail) => {
  rows.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message).slice(0, 160)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text().slice(0, 160)}`);
});

const stepOf = async () => {
  const text = await page.locator("[data-demo-id='demo-guide-progress']").first().innerText().catch(() => "");
  const match = text.match(/第\s*(\d+)\s*\/\s*(\d+)/);
  return { step: match ? Number(match[1]) : 0, total: match ? Number(match[2]) : 0, text: text.trim() };
};
const cardText = async () =>
  (await page.locator("[data-demo-id='demo-guide-card']").first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();

await loginStudent(page, { base });
await page.goto(`${base}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await dismissOnboarding(page);
await page.waitForTimeout(400);

const first = await stepOf();
check("① 进入实验即第 1 步", first.step === 1 && first.total === 7, JSON.stringify(first));
await page.screenshot({ path: path.join(outDir, "01-step1.png") });

/* ---------------- 7 步：只点「当前可见的建议动作」，每步记录推进 ---------------- */
const stepLog = [];
let guard = 0;
while (guard < 60) {
  guard += 1;
  const current = await stepOf();
  if (current.step === 0) break;
  if (current.step > 7) break;

  const card = await cardText();
  const op = page.locator("[data-demo-id^='demo-op-']:visible").first();
  if (!(await op.count())) {
    check(`第 ${current.step} 步有可点动作`, false, "页面上没有可见的 demo-op-*");
    break;
  }
  const opId = await op.getAttribute("data-demo-id");
  const opLabel = (await op.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const clicked = await clickOp(page, op);
  await page.waitForTimeout(650);
  const next = await stepOf();
  stepLog.push({ step: current.step, opId, opLabel, card, advancedTo: next.step });

  if (current.step === 6) {
    await page.screenshot({ path: path.join(outDir, "02-titrating.png") });
  }
  if (!clicked) {
    check(`第 ${current.step} 步动作可点`, false, `${opId} 点不下去（disabled / 被遮挡）`);
    break;
  }
  if (next.step === current.step) {
    // 同一步内的多段动作是正常设计（如 称量→溶解→转移），继续；但要计数防死循环
    const repeats = stepLog.filter((row) => row.step === current.step).length;
    if (repeats >= 8) {
      check(`第 ${current.step} 步向前推进`, false, `同一步点了 ${repeats} 次仍未推进（疑似卡死）`);
      break;
    }
  }
}

const perStep = new Map();
for (const row of stepLog) {
  if (!perStep.has(row.step)) perStep.set(row.step, []);
  perStep.get(row.step).push(row);
}
const reached = [...perStep.keys()].sort((a, b) => a - b);
check(
  "② 7 步都走到了（每步都有推进记录）",
  reached.length === 7 && reached[0] === 1 && reached[6] === 7,
  `走到第 ${reached[reached.length - 1] ?? 0} 步；每步动作数 ${reached.map((n) => `${n}:${perStep.get(n).length}`).join(" ")}`,
);

// 每步 stepIndex 递增：动作序列里 step 只能从 1→7，不能回退
let monotonic = true;
let prev = 0;
for (const row of stepLog) {
  if (row.step < prev) monotonic = false;
  prev = row.step;
}
check("③ stepIndex 单调递增（没有回退/乱跳）", monotonic, stepLog.map((row) => row.step).join("→"));

console.log("\n=== 每步的看板文案（demo-guide-card）===");
for (const n of reached) {
  const rowsOfStep = perStep.get(n);
  console.log(`第 ${n} 步 · ${rowsOfStep.length} 个动作`);
  for (const row of rowsOfStep) console.log(`   · ${row.opId} 「${row.opLabel}」 ← 卡面：${row.card}`);
}

/* ---------------- 交卷 → 报告 ---------------- */
const finish = page.locator("[data-demo-id='demo-finish'], button:has-text('交卷')").first();
check("④ 有交卷按钮", (await finish.count()) > 0, (await finish.count()) ? "" : "没找到 demo-finish");
await finish.click({ timeout: 8000 }).catch(() => {});
await page.waitForURL(/\/report/, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(900);
const reportUrl = page.url();
check("⑤ 交卷后落到 /exp/exp09/report", /\/exp\/exp09\/report/.test(reportUrl), reportUrl);

const reportText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
const scoreMatch = reportText.match(/(\d{2,3})\s*(?:分|总分|得分)/);
await page.screenshot({ path: path.join(outDir, "03-report.png"), fullPage: true });
check("⑥ 报告页有分数", /总分|得分|成绩|\d+\s*分/.test(reportText), scoreMatch ? `命中「${scoreMatch[0]}」` : "报告里没找到分数文本");
check("⑦ 报告提到步骤/事故/提示（可追溯）", /步骤|事故|提示/.test(reportText), reportText.slice(0, 120));
check("⑧ 无 pageerror", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

console.log(`\n报告页分数片段：${reportText.slice(0, 200)}`);
console.log(`截图：${outDir}`);
console.log(`\n断言：${rows.length - failed}/${rows.length} 通过`);
await browser.close();
process.exitCode = failed ? 1 : 0;
