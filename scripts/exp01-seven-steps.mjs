/**
 * exp01 七步逐步截图（证据用）
 *
 * 为什么不用 `scripts/exp01-chain.mjs`：那个脚本走的是「登录→列表→进实验→前测」的完整门禁，
 * 前测一改版就卡住，截不到七步。这里直接用 `?force=1` 跳过门禁，按实验定义里
 * role=correct 的选项序号用键盘推进（陷阱都排在正确项之后，不会误触）。
 *
 * 判定「这一步过了」三条任一成立：① 步号前进 ② 出现「实验完成」结算 ③ 已跳 /postlab /report。
 * 第 7 步做完不推进步号，直接结算 —— 只认步号会把最后一步误判成卡住（踩过）。
 *
 * 用法：BASE_URL=http://localhost:3001 node scripts/exp01-seven-steps.mjs
 * 产物：%TEMP%/chemlab-shots/exp01-steps/01-step-1.png … 07-step-7.png、08-finished.png、09-postlab.png
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const dir = process.env.SHOT_DIR ?? path.join(os.tmpdir(), "chemlab-shots", "exp01-steps");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const def =
  (await import("../experiments/exp01/definition.ts")).exp01Definition ??
  (await import("../experiments/exp01/definition.ts")).default;

/** 某一步「正确动作」的键盘序号：choices 里 role=correct 的下标 +1 */
const correctKeys = (stepIndex) => {
  const step = def?.steps?.[stepIndex];
  if (!step?.choices) return [];
  return step.choices.map((c, i) => (c.role === "correct" ? i + 1 : null)).filter((k) => k !== null);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror:" + String(e.message).slice(0, 160)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  errors.push("console:" + t.slice(0, 140));
});

const stepNo = () =>
  page.evaluate(() => {
    const el = document.querySelector("[class*='topStep']");
    const m = (el?.textContent ?? "").match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? { step: Number(m[1]), total: Number(m[2]) } : null;
  });

const finished = () =>
  page.evaluate(
    () => /实验完成/.test(document.body.innerText) || /postlab|\/report/.test(location.pathname),
  );

const shots = [];
const log = [];
const shot = async (name) => {
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(dir, name) });
  shots.push(name);
};

try {
  await page.goto(BASE + "/exp/exp01?force=1", { waitUntil: "networkidle" });
  // 等 React 接管（动作按钮上出现 __reactProps 才说明键盘/点击真的接上了）
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector("[data-demo-id^='demo-op-']");
        return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
      },
      null,
      { timeout: 30000 },
    )
    .catch(() => {});
  await page.waitForSelector("[data-demo-id='demo-finish']", { timeout: 30000 }).catch(() => {});

  const start = await stepNo();
  if (!start) throw new Error("没读到步号（操作台未加载？）");
  log.push(`起始：第 ${start.step}/${start.total} 步`);

  const captured = new Set();
  for (let guard = 0; guard < 16; guard += 1) {
    const st = await stepNo();
    if (!st) break;

    // 每进到一步先拍一张：这一步的台面 + 「现在该做：…」
    if (!captured.has(st.step)) {
      captured.add(st.step);
      await shot(`${String(st.step).padStart(2, "0")}-step-${st.step}.png`);
    }

    const keys = correctKeys(st.step - 1);
    let advanced = false;
    for (const key of keys.length ? keys : [1]) {
      await page.keyboard.press(String(key));
      await page.waitForTimeout(950);
      const after = await stepNo();
      advanced = (await finished()) || Boolean(after && after.step > st.step);
      if (advanced) break;
    }
    log.push(`第 ${st.step} 步：${advanced ? "过" : "卡住（无正确选项序号或前置未满足）"}`);
    if (!advanced) break;
    if (await finished()) break;
  }

  // 结算屏（实验完成 + 操作分）→ 后测页：整条链的终点证据
  await shot("08-finished.png");
  await page.waitForURL(/postlab|\/report/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  await shot("09-postlab.png");
  log.push(/postlab|\/report/.test(page.url()) ? `已到后测/报告：${new URL(page.url()).pathname}` : "未跳到后测页");
} catch (e) {
  log.push("异常：" + String(e).slice(0, 200));
} finally {
  await browser.close();
}

console.log(log.join("\n"));
console.log(`\n截图 ${shots.length} 张 → ${dir}`);
if (errors.length) console.log(`console/pageerror ${errors.length} 条：${errors.slice(0, 3).join(" | ")}`);
const stuck = log.some((l) => /卡住|异常/.test(l));
process.exitCode = stuck || errors.length ? 1 : 0;
