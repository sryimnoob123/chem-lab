/**
 * ④ 事故 L1~L4 画面表现 + 提示三级阶梯 —— 逐项实测并截图。
 * 产物：%TEMP%\chemlab-shots\20261022-pm\*.png
 * 用法：node .team/incident-hint-visual.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const SHOTS = join(tmpdir(), "chemlab-shots", "20261022-pm");
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const rows = [];
const problems = [];
let shotIndex = 0;

async function fresh(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
  return { ctx, page, errs };
}

async function shot(page, label) {
  shotIndex += 1;
  const path = join(SHOTS, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path });
  return path;
}

async function enterExp(page, expId) {
  await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
}

// ========== 一、事故 L1~L4 画面表现 ==========
const TRAPS = [
  { exp: "exp01", op: "demo-op-step1-wipe", level: "L1", name: "纸巾擦容量瓶内壁" },
  { exp: "exp01", op: "demo-op-step1-oven", level: "L2", name: "容量瓶进 105℃ 烘箱" },
  { exp: "exp09", op: "demo-op-step1-bare-hands", level: "L3", name: "徒手抓 NaOH" },
  { exp: "exp03", op: "demo-op-step1-open", level: "L4", name: "敞口量冰醋酸并加水" },
];

for (const t of TRAPS) {
  const { ctx, page } = await fresh();
  await enterExp(page, t.exp);

  const other = page.locator('[data-demo-id="demo-other-ways"]').first();
  if (await other.isVisible().catch(() => false)) {
    await other.click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
  const trap = page.locator(`[data-demo-id="${t.op}"]`).first();
  if (await trap.isVisible().catch(() => false)) {
    await trap.click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }

  const visual = await page.evaluate(() => {
    const banner = document.querySelector("[data-level]");
    if (!banner) return null;
    const style = getComputedStyle(banner);
    const rect = banner.getBoundingClientRect();
    // 找到压暗层（opacity < .5 的固定定位遮罩）
    const dim = [...document.querySelectorAll("div")].find((el) => {
      const s = getComputedStyle(el);
      return s.position === "fixed" && Number(s.opacity) < 0.5 && Number(s.opacity) > 0.1;
    });
    // 找红框（border 2px 或 outline 的固定层）
    const redFrame = [...document.querySelectorAll("div")].find((el) => {
      const s = getComputedStyle(el);
      return s.position === "fixed" && (parseFloat(s.borderTopWidth) >= 2 || parseFloat(s.outlineWidth) >= 2);
    });
    return {
      level: banner.getAttribute("data-level"),
      text: (banner.textContent ?? "").replace(/\s+/g, " ").slice(0, 90),
      bg: style.backgroundColor,
      borderColor: style.borderTopColor,
      height: Math.round(rect.height),
      hasDim: Boolean(dim),
      dimOpacity: dim ? getComputedStyle(dim).opacity : null,
      hasRedFrame: Boolean(redFrame),
    };
  });

  const file = await shot(page, `incident-${t.level}`);
  const ok = visual && visual.level === t.level;
  rows.push({
    环节: `事故 ${t.level}（${t.name}）`,
    结果: ok ? "PASS" : "FAIL",
    说明: visual
      ? `data-level=${visual.level} · 高 ${visual.height}px · bg=${visual.bg} · dim=${visual.hasDim}(${visual.dimOpacity}) · 红框=${visual.hasRedFrame}`
      : "没找到事故条",
    截图: file,
  });
  if (!ok) problems.push(`事故 ${t.level} 未正确触发`);
  if (t.level === "L4" && visual && !visual.hasDim) problems.push("L4 没有压暗层");
  await ctx.close();
}

// ========== 二、提示三级阶梯 ==========
{
  const { ctx, page } = await fresh();
  await enterExp(page, "exp01");

  const bulb = page.locator('[data-demo-id="demo-hint-button"]').first();
  const bulbBox = await bulb.boundingBox().catch(() => null);
  rows.push({
    环节: "提示·灯泡按钮存在且可点",
    结果: bulbBox && bulbBox.width >= 32 && bulbBox.height >= 32 ? "PASS" : "FAIL",
    说明: bulbBox ? `${Math.round(bulbBox.width)}×${Math.round(bulbBox.height)}` : "找不到灯泡",
    截图: await shot(page, "hint-0-initial"),
  });
  if (!bulbBox) problems.push("灯泡按钮不存在");

  const levelSeq = [];
  const deductSeq = [];
  for (let i = 1; i <= 3; i++) {
    await bulb.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1300);
    const info = await page.evaluate(() => {
      const btn = document.querySelector('[data-demo-id="demo-hint-button"]');
      const nudge = document.querySelector('[data-demo-id="demo-guide-card"]');
      return {
        level: btn?.getAttribute("data-level"),
        exhausted: btn?.getAttribute("data-exhausted"),
        disabled: btn?.hasAttribute("disabled"),
        btnText: (btn?.textContent ?? "").replace(/\s+/g, " ").trim(),
        guide: (nudge?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
        highlight: nudge?.getAttribute("data-hint"),
      };
    });
    levelSeq.push(info.level);
    deductSeq.push(info.btnText);
    rows.push({
      环节: `提示·第 ${i} 次（L${i}）`,
      结果: info.level === String(i) ? "PASS" : "FAIL",
      说明: `data-level=${info.level} · 置灰=${info.disabled} · 按钮=「${info.btnText}」· 高亮=${info.highlight}`,
      截图: await shot(page, `hint-${i}-L${i}`),
    });
    if (info.level !== String(i)) problems.push(`第 ${i} 次提示 level=${info.level}，期望 ${i}`);
  }

  // 第 4 次：应该已用完 + 置灰
  await bulb.click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  const exhausted = await page.evaluate(() => {
    const btn = document.querySelector('[data-demo-id="demo-hint-button"]');
    return {
      exhausted: btn?.getAttribute("data-exhausted"),
      disabled: btn?.hasAttribute("disabled"),
      text: (btn?.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  });
  rows.push({
    环节: "提示·用完三级后置灰",
    结果: exhausted.disabled && exhausted.exhausted === "true" ? "PASS" : "FAIL",
    说明: `disabled=${exhausted.disabled} · exhausted=${exhausted.exhausted} · 按钮=「${exhausted.text}」`,
    截图: await shot(page, "hint-4-exhausted"),
  });
  if (!exhausted.disabled) problems.push("用完三级后灯泡没有置灰");

  // 交卷 → 报告页看「使用提示 N 次」
  await page.locator('[data-demo-id="demo-finish"]').first().click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForURL(/\/report/, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const reportText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const hintCount = reportText.match(/提示\s*(\d+)\s*次/);
  const deductText = reportText.match(/[−-]\s*(\d+)\s*分/);
  // 报告统计的是「本场所有提示」（我手动点 3 次 + 引擎在错动作时自动给的若干次），
  // 所以这里校验「写了 N 次且 N≥3」，不是死磕 3。
  const count = hintCount ? Number(hintCount[1]) : 0;
  rows.push({
    环节: "报告·写「使用提示 N 次」",
    结果: count >= 3 ? "PASS" : "FAIL",
    说明: `匹配=「${hintCount?.[0] ?? "无"}」扣分=「${deductText?.[0] ?? "无"}」（手动 3 次 + 引擎自动若干）`,
    截图: await shot(page, "report-hint-count"),
  });
  if (count < 3) problems.push(`报告提示次数异常：${hintCount?.[0] ?? "无"}`);

  await ctx.close();
}

// ========== 三、20~30s 无操作自动浮出 L1 ==========
{
  const { ctx, page } = await fresh();
  await enterExp(page, "exp01");
  const t0 = Date.now();
  let floated = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const level = await page
      .locator('[data-demo-id="demo-hint-button"]')
      .first()
      .getAttribute("data-level")
      .catch(() => null);
    if (level && level !== "0") {
      floated = Math.round((Date.now() - t0) / 1000);
      break;
    }
  }
  rows.push({
    环节: "提示·静置自动浮出 L1（20~30s）",
    结果: floated !== null && floated >= 20 && floated <= 35 ? "PASS" : "FAIL",
    说明: floated !== null ? `${floated}s 自动出现` : "40s 内没自动浮出",
    截图: await shot(page, "hint-idle-autopop"),
  });
  if (floated === null || floated < 20 || floated > 35) problems.push(`自动浮出异常：${floated ?? "无"}s`);
  await ctx.close();
}

await browser.close();

console.log(`截图目录：${SHOTS}\n`);
console.log("环节\t\t\t\t\t结果\t说明");
for (const r of rows) console.log(`${r.环节}\t${r.结果}\t${r.说明}`);
console.log("");
console.log(problems.length === 0 ? "✅ ④ 全部 PASS" : `❌ ${problems.length} 个问题：\n  - ${problems.join("\n  - ")}`);
process.exit(problems.length === 0 ? 0 : 1);
