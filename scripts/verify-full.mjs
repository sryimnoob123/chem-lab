/**
 * 生产链路完整验证（用户 2026-10-21 要求：不要只看 200，要真点到出报告）
 *
 * 走的是**真实学生路径**：
 *   门户 → 登录 → 列表里点实验卡 → 关闭新手教学 → 逐个操作（每步等结果条）→ 交卷 → 报告页 → 教师端
 *
 * 每步截图落 `public/shots-prod/verify/`，把「点不下去 / 没反馈」的操作列成清单。
 *
 * 用法：
 *   $env:BASE_URL="http://localhost:3001"; node scripts/verify-full.mjs
 *   node scripts/verify-full.mjs exp01        # 只跑一个
 *
 * 出口码：0 = 三个实验 + 教师端全通；1 = 有失败项
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  clickOpById,
  dismissOnboarding,
  loginStudent,
  waitForFeedback,
} from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const ONLY = process.argv[2]?.toLowerCase();
const OUT = path.join(process.cwd(), "public/shots-prod", process.env.SHOT_DIR ?? "verify");
fs.mkdirSync(OUT, { recursive: true });

/**
 * 每个实验的「正确操作序列」（从 lib/demo/scripts/<id>.ts 提取，跳过陷阱分支）。
 * 顺序即真实流程顺序；前置没做的话按钮会 disabled，脚本会如实记成失败。
 */
const PLANS = {
  exp03: {
    label: "醋酸电离常数的测定",
    ops: [
      "demo-op-step1-assemble", "demo-op-step1-transfer", "demo-op-step1-dilute",
      "demo-op-step2-wash", "demo-op-step2-transfer", "demo-op-step2-dilute",
      "demo-op-step3-heat", "demo-op-step3-read",
      "demo-op-step4-wash", "demo-op-step4-calibrate",
      "demo-op-step5-hit", "demo-op-step5-wash", "demo-op-step5-read",
      "demo-op-step6-compute", "demo-op-step6-average", "demo-op-step6-cleanup",
    ],
  },
  exp01: {
    label: "仪器认领 / 天平 / 溶液配制",
    ops: [
      "demo-op-step1-check", "demo-op-step1-wash", "demo-op-step1-dry",
      "demo-op-step2-level", "demo-op-step2-calibrate",
      // step2-brush 是"可选观察项"，而 step2-calibrate 带 completesStep:true，
      // 校准完成即推进到第 3 步，brush 按钮随之消失 —— 不是 bug，不放进主链路。
      "demo-op-step3-gross", "demo-op-step3-transfer", "demo-op-step3-compute",
      "demo-op-step4-dissolve", "demo-op-step4-cool", "demo-op-step4-rinse",
      "demo-op-step5-water", "demo-op-step5-read", "demo-op-step5-shake",
      "demo-op-step6-rinse", "demo-op-step6-suck", "demo-op-step6-drain",
      "demo-op-step7-water", "demo-op-step7-acid", "demo-op-step7-label",
    ],
  },
  exp08: {
    label: "分析天平称量练习",
    ops: [
      "demo-op-step1-bottle", "demo-op-step1-silica", "demo-op-step1-sign",
      "demo-op-step2-touch", "demo-op-step2-structure", "demo-op-step2-nameplate",
      "demo-op-step3-level", "demo-op-step3-preheat", "demo-op-step3-zero",
      "demo-op-step4-paper", "demo-op-step4-add", "demo-op-step4-adjust",
      "demo-op-step5-weigh", "demo-op-step5-transfer", "demo-op-step5-compute",
      "demo-op-step6-ink", "demo-op-step6-strike", "demo-op-step6-compute",
      "demo-op-step7-check", "demo-op-step7-brush", "demo-op-step7-shutdown",
    ],
  },
  exp09: {
    label: "酸碱标准溶液配制与标定",
    ops: [
      "demo-op-step1-weigh", "demo-op-step1-dissolve", "demo-op-step1-transfer",
      "demo-op-step2-add-water", "demo-op-step2-measure-acid", "demo-op-step2-add-acid", "demo-op-step2-transfer",
      "demo-op-step3-inspect", "demo-op-step3-wash", "demo-op-step3-rinse",
      "demo-op-step4-naoh-in-acid-burette", "demo-op-step4-clamp", "demo-op-step4-fill", "demo-op-step4-zero",
      "demo-op-step5-rinse-pipette", "demo-op-step5-pipette", "demo-op-step5-indicator",
      "demo-op-step6-titrate-fast", "demo-op-step6-half-drop", "demo-op-step6-read-end",
      "demo-op-step7-repeat", "demo-op-step7-record", "demo-op-step7-compute",
    ],
  },
};

const targets = ONLY ? [ONLY] : Object.keys(PLANS);
for (const t of targets) {
  if (!PLANS[t]) {
    console.error(`未知实验：${t}`);
    process.exit(2);
  }
}

/**
 * 前测答案（BOPPPS 的 P 段门禁：3 题全对才解锁操作台）。
 * 来源：lib/pedagogy/curriculum/<expId>.ts 的 pre[].answer。
 * ⚠️ 这是真实学生路径的一部分 —— flow-smoke 用 ?force=1 绕过了它，
 * 所以之前"8/8 通过"并不代表学生从列表点进来能走通。
 */
const PRE_ANSWERS = {
  exp01: [["exp01-pre-1", "D"], ["exp01-pre-2", "B"], ["exp01-pre-3", "C"]],
  exp03: [["exp03-pre-1", "A"], ["exp03-pre-2", "B"], ["exp03-pre-3", "B"]],
  exp08: [["exp08-pre-1", "C"], ["exp08-pre-2", "B"], ["exp08-pre-3", "B"]],
  exp09: [["exp09-pre-1", "A"], ["exp09-pre-2", "B"], ["exp09-pre-3", "B"]],
};

/** 作答并提交前测；没出现前测时静默返回（已通过的会记住）。 */
async function passPre(page, expId) {
  const submit = page.locator("[data-demo-id='bopbps-pre-submit']");
  if ((await submit.count()) === 0) return { appeared: false, passed: true };
  for (const [qid, answer] of PRE_ANSWERS[expId] ?? []) {
    await page.locator(`[data-demo-id='bopbps-op-${qid}-${answer}']`).click({ timeout: 3000 }).catch(() => {});
  }
  await submit.click({ timeout: 4000 }).catch(() => {});
  // 解锁是同一页内切换：等操作台动作出现
  const unlocked = await page
    .waitForSelector("[data-demo-id^='demo-op-']", { state: "visible", timeout: 9000 })
    .then(() => true)
    .catch(() => false);
  return { appeared: true, passed: unlocked };
}

/**
 * 陷阱动作：点了**应该**出失败反馈（demo 脚本里就是当负例演示的）。
 * 这些不算"点了没反应"，但必须验证"有反应且是失败"，否则学生点错了没知觉。
 */
const TRAPS = new Set([
  "demo-op-step2-touch",
  "demo-op-step4-naoh-in-acid-burette",
  "demo-op-step3-hot",
  "demo-op-step5-hit",
]);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 140)));
page.on("console", (m) => {
  const text = m.text();
  if (/favicon|Failed to load resource|Download the React DevTools/i.test(text)) return;
  if (m.type() === "error") pageErrors.push("console: " + text.slice(0, 140));
});

const report = { base: BASE, startedAt: new Date().toISOString(), experiments: [], teacher: null, pageErrors };

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

// ---------- 1. 门户 ----------
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await shot("00-home");

// ---------- 2. 登录 ----------
const loggedIn = await loginStudent(page, { base: BASE });
await shot("01-catalog");

// ---------- 3. 每个实验走完 ----------
for (const expId of targets) {
  const plan = PLANS[expId];
  const item = { expId, label: plan.label, opsTotal: plan.ops.length, steps: [], failures: [], report: null };
  report.experiments.push(item);

  const card = page.locator(`[data-demo-id='demo-catalog-${expId}']`).first();
  const hasCard = (await card.count()) > 0;
  // 禁用态是 <div aria-disabled>，点了没反应；只有可见的真链接才能点进实验页
  const visible = hasCard && (await card.isVisible().catch(() => false));
  const isLink = visible && (await card.evaluate((el) => el.tagName === "A").catch(() => false));
  const clickable = isLink;
  if (clickable) {
    await card.click({ timeout: 6000 }).catch(() => {});
  } else {
    // 还在「更多实验」折叠里 / 或已禁用：直接进页（不带 force，仍走前测，保持真实路径）
    await page.goto(`${BASE}/exp/${expId}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  }
  await page.waitForTimeout(1400);
  if (!page.url().includes(`/exp/${expId}`)) {
    item.failures.push({ stage: "进入", why: `点卡片后没进实验页，当前 ${page.url()}` });
    continue;
  }
  // 真实路径：先过前测（3 题全对才解锁操作台），再关新手教学
  const pre = await passPre(page, expId);
  item.pretest = pre;
  if (pre.appeared && !pre.passed) {
    item.failures.push({ stage: "前测", why: "前测提交后 9s 内没有解锁操作台" });
    await shot(`10-${expId}-pretest-blocked`);
    continue;
  }
  await dismissOnboarding(page);
  await shot(`10-${expId}-enter`);

  // 逐个操作
  for (let i = 0; i < plan.ops.length; i++) {
    const opId = plan.ops[i];
    const expect = TRAPS.has(opId) ? "fail" : "ok";
    const clicked = await clickOpById(page, opId, { timeout: 4000 });
    if (!clicked) {
      item.failures.push({ stage: "操作", op: opId, why: "按钮不存在 / 点不下去（disabled 或前置未满足）" });
      continue;
    }
    const got = await waitForFeedback(page, expect, { timeout: 5000 });
    item.steps.push({ op: opId, ok: got, expect });
    if (!got) {
      item.failures.push({
        stage: "操作",
        op: opId,
        why: expect === "fail" ? "陷阱操作点了但没出失败反馈" : "点了但没有成功结果条",
      });
      continue;
    }
    // 陷阱触发后要「重做本步」才能继续，否则下一步的前置不满足
    if (expect === "fail") {
      const retry = page.locator("[data-demo-id^='demo-retry-']").first();
      if (await retry.count()) {
        await retry.click({ timeout: 3000 }).catch(() => page.keyboard.press("r"));
        await page.waitForTimeout(420);
      }
      item.negatives = (item.negatives ?? 0) + 1;
    }
    if (i === 0) await shot(`11-${expId}-step1`);
  }

  // 交卷
  const finish = page.locator("[data-demo-id='demo-finish'], button:has-text('交卷')").first();
  if (!(await finish.count())) {
    item.failures.push({ stage: "交卷", why: "没有交卷按钮" });
  } else {
    await finish.click({ timeout: 6000 }).catch(() => {});
    try {
      await page.waitForURL(/\/report/, { timeout: 30000 });
      await page.waitForTimeout(900);
      await shot(`20-${expId}-report`);
      const text = await page.locator("body").innerText();
      item.report = {
        hasScore: /总分/.test(text),
        hasSummary: /本次总结/.test(text),
        hasCompetency: /能力|素养/.test(text),
        hasReview: /错题|解析|复盘/.test(text),
        hasTimeline: /对|错/.test(text),
        hasExport: /下载记录/.test(text),
        textLen: text.length,
      };
      if (!item.report.hasScore) item.failures.push({ stage: "报告", why: "报告页没有总分" });
      if (!item.report.hasSummary) item.failures.push({ stage: "报告", why: "报告页没有「本次总结」" });
      if (!item.report.hasExport) item.failures.push({ stage: "报告", why: "报告页没有导出入口" });
    } catch {
      item.failures.push({ stage: "交卷", why: "点了交卷 30s 内没到报告页" });
    }
  }

  // 回列表做下一个
  await page.goto(BASE + "/experiments", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
}

// ---------- 4. 教师端 ----------
try {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const teacherTab = page.locator("[data-demo-id='demo-login-tab-teacher']").first();
  if (await teacherTab.count()) {
    await teacherTab.click();
    await page.waitForTimeout(300);
    await page.locator("[data-demo-id='demo-login-quick-teacher']").first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForURL(/\/teacher/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot("30-teacher");
    const text = await page.locator("body").innerText();
    const rows = await page.locator("table tbody tr").count().catch(() => 0);
    report.teacher = {
      url: page.url(),
      hasTable: rows > 0,
      rows,
      hasScore: /分/.test(text),
      hasStudent: /202501\d\d|周若曦/.test(text),
    };
    if (!report.teacher.hasTable) report.teacher.note = "教师端没看到学生表格";
  }
} catch (err) {
  report.teacher = { error: String(err).slice(0, 200) };
}

await browser.close();

// ---------- 汇总 ----------
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

console.log(`\n=== 完整链路验证（${BASE}）===`);
console.log(`登录：${loggedIn ? "✓" : "✗"}`);
for (const item of report.experiments) {
  const okCount = item.steps.filter((s) => s.ok).length;
  const total = item.opsTotal ?? item.steps.length;
  console.log(`\n${item.expId}（${item.label}）操作 ${okCount}/${total} 有正确响应${item.negatives ? ` · 陷阱 ${item.negatives} 次均有失败反馈` : ""}`);
  if (item.report) {
    const r = item.report;
    console.log(
      `  报告：总分 ${r.hasScore ? "✓" : "✗"} 总结 ${r.hasSummary ? "✓" : "✗"} 能力 ${r.hasCompetency ? "✓" : "✗"} 错题 ${r.hasReview ? "✓" : "✗"} 导出 ${r.hasExport ? "✓" : "✗"}`,
    );
  }
  for (const f of item.failures.slice(0, 8)) {
    console.log(`  ✗ [${f.stage}] ${f.op ?? ""} ${f.why}`);
  }
}
if (report.teacher) {
  console.log(
    `\n教师端：${report.teacher.hasTable ? `✓ 表格 ${report.teacher.rows} 行` : "✗ 没看到学生表格"}${report.teacher.error ? ` (${report.teacher.error})` : ""}`,
  );
}
const failedTotal = report.experiments.reduce((sum, item) => sum + item.failures.length, 0) + (report.teacher?.hasTable ? 0 : 1);
console.log(`\n截图目录：${OUT}`);
console.log(`失败项合计：${failedTotal}`);
process.exitCode = failedTotal ? 1 : 0;
