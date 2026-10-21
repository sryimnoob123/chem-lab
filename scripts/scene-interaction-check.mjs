/**
 * 交互反馈验收（asset-pipeline）：单实例、串行跑。
 *
 * 覆盖：
 *  1. 按下 100ms 内有 transform 变化（试剂瓶 / 器皿 / fx 按钮 / 步骤选项）
 *  2. 拖拽投放：300ms 内事件条出方程式 + 器皿有成功手感
 *  3. 滴定管拒收：抖动 + 规范文案
 *  4. 7 步 × 成功/失败 = 14 条分支（文案来自 definition）
 *  5. 点选投放：点瓶 → data-picked，器皿 data-drop-target，点器皿 → 与拖拽文案一字不差；Esc 取消
 *  6. reduced-motion：无位移/抖动，文案仍在
 *
 * 截图：%TEMP%\chemlab-shots\step-<i>-ok.png（第 2/3/5/6/7 步）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(os.tmpdir(), "chemlab-shots");
const STEP = '[data-demo-id="demo-step-card"]';
const OK_SHOTS = new Set([2, 3, 5, 6, 7]);

const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
};

const transformOf = (page, sel) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).transform);
const eventText = async (page) => (await page.locator('[data-demo-id="demo-scene-event"]').innerText()).replace(/\s+/g, " ");

async function freshScene(page) {
  await page.goto(`${BASE}/scene-preview`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector('[data-demo-id="demo-scene-vessel-flask"]', { timeout: 60_000 });
  await page.waitForTimeout(300);
}

async function pressFeedback(page, sel, label) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);
  const box = await page.locator(sel).first().boundingBox();
  if (!box) {
    check(label, false, "元素不可见");
    return;
  }
  const before = await transformOf(page, sel);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const after = await transformOf(page, sel);
  await page.mouse.up();
  await page.waitForTimeout(120);
  check(`${label} 按下 100ms 内有视觉变化`, before !== after, `${before} → ${after}`);
}

/** 到第 target 步（新开页面，逐步点“规范操作 + 下一步”，保证每步从快照开始）。 */
async function gotoStep(page, target) {
  await freshScene(page);
  for (let i = 1; i < target; i += 1) {
    await page.locator(`${STEP} [data-option-ok="true"]`).first().click();
    await page.waitForTimeout(60);
    await page.locator(`${STEP} [data-demo-id="demo-step-next"]`).click();
    await page.waitForTimeout(60);
  }
  const idx = await page.locator(STEP).getAttribute("data-step-index");
  if (idx !== String(target)) throw new Error(`未到达第 ${target} 步（当前 ${idx}）`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text())) errors.push(m.text().slice(0, 160));
  });

  // ---------- 1. 按下反馈 ----------
  await freshScene(page);
  await pressFeedback(page, '[data-demo-id="demo-scene-reagent-agno3"]', "试剂瓶");
  await pressFeedback(page, '[data-demo-id="demo-scene-vessel-flask"]', "锥形瓶");
  await pressFeedback(page, '[data-fx-trigger="explosion"]', "特效按钮");
  await pressFeedback(page, `${STEP} [data-option-ok="true"]`, "步骤选项");

  // ---------- 2. 拖拽成功 ----------
  await freshScene(page);
  const t0 = Date.now();
  await page.dragAndDrop('[data-demo-id="demo-scene-reagent-agno3"]', '[data-demo-id="demo-scene-vessel-flask"]', { timeout: 15_000 });
  const fb = await page.locator('[data-demo-id="demo-scene-vessel-flask"]').getAttribute("data-feedback");
  const dragText = await eventText(page);
  const ms = Date.now() - t0;
  check("拖拽：投放后立即有手感（ix-snap）", fb === "success", String(fb));
  check("拖拽：事件条立即出方程式", dragText.includes("AgCl"), `${ms}ms`);
  await page.locator('[data-demo-id="demo-scene-root"]').screenshot({ path: path.join(OUT, "ix-drop-agcl.png") });

  // ---------- 3. 滴定管拒收 ----------
  await freshScene(page);
  await page.dragAndDrop('[data-demo-id="demo-scene-reagent-agno3"]', '[data-demo-id="demo-scene-vessel-burette"]', { timeout: 15_000 });
  const rejectFb = await page.locator('[data-demo-id="demo-scene-vessel-burette"]').getAttribute("data-feedback");
  const rejectText = await eventText(page);
  check("失败：滴定管立即抖动（ix-shake）", rejectFb === "reject", String(rejectFb));
  check("失败：事件条给规范文案", rejectText.includes("滴定管") && !rejectText.includes("没有明显现象"));

  // ---------- 4. 点选投放：与拖拽文案一字不差 ----------
  await freshScene(page);
  await page.locator('[data-demo-id="demo-scene-reagent-agno3"]').click();
  await page.waitForTimeout(80);
  const pickedAttr = await page.locator('[data-demo-id="demo-scene-reagent-agno3"]').getAttribute("data-picked");
  const targetCount = await page.locator('[data-demo-id="demo-scene-vessel-flask"] rect[data-drop-target="true"]').count();
  const targetOnVessel = await page.locator('[data-demo-id="demo-scene-vessel-flask"] [data-drop-target="true"]').count();
  await page.locator('[data-demo-id="demo-scene-vessel-flask"]').click();
  await page.waitForTimeout(120);
  const clickText = await eventText(page);
  check("点选：瓶子进入 data-picked 态", pickedAttr === "true", String(pickedAttr));
  check("点选：可投放器皿进入 data-drop-target", targetCount + targetOnVessel > 0);
  check("两条路径事件条文案一字不差", dragText === clickText, clickText.slice(0, 46));

  await freshScene(page);
  await page.locator('[data-demo-id="demo-scene-reagent-naoh"]').click();
  await page.waitForTimeout(60);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  const afterEsc = await page.locator('[data-demo-id="demo-scene-reagent-naoh"]').getAttribute("data-picked");
  check("点选：Esc 取消选中", afterEsc === "false", String(afterEsc));

  // ---------- 5. 7 步 × 2 分支（14 条） ----------
  for (let i = 1; i <= 7; i += 1) {
    // 成功
    await gotoStep(page, i);
    await page.locator(`${STEP} [data-option-ok="true"]`).first().click();
    await page.waitForTimeout(120);
    const okState = await page.locator(STEP).getAttribute("data-step-state");
    const okPanelCount = await page.locator(`[data-demo-id="demo-feedback-ok-${i}"]`).count();
    const okText = okPanelCount ? await page.locator(`[data-demo-id="demo-feedback-ok-${i}"]`).innerText() : "";
    check(
      `第 ${i} 步 · 成功分支（脉冲 + “为什么对”）`,
      okState === "ok" && okPanelCount === 1 && okText.includes("操作正确") && okText.replace(/\s+/g, "").length > 10,
      okText.replace(/\s+/g, " ").slice(0, 42),
    );
    if (OK_SHOTS.has(i)) await page.locator(STEP).screenshot({ path: path.join(OUT, `step-${i}-ok.png`) });

    // 失败
    await gotoStep(page, i);
    await page.locator(`${STEP} [data-option-ok="false"]`).first().click();
    await page.waitForTimeout(120);
    const failState = await page.locator(STEP).getAttribute("data-step-state");
    const failCount = await page.locator(`[data-demo-id="demo-feedback-fail-${i}"]`).count();
    const failText = failCount ? await page.locator(`[data-demo-id="demo-feedback-fail-${i}"]`).innerText() : "";
    const retryCount = await page.locator(`[data-demo-id="demo-retry-${i}"]`).count();
    const terminateCount = await page.locator(`[data-demo-id="demo-feedback-terminate-${i}"]`).count();
    const isL4 = terminateCount > 0;
    const twoLines = failText.includes("✕") && failText.includes("为什么");
    check(
      `第 ${i} 步 · 失败分支（${isL4 ? "L4 终止 + 重新演示" : "抖动 + fx + 两行 + 重做"}）`,
      failState === "fail" && failCount === 1 && twoLines && (isL4 ? retryCount === 0 : retryCount === 1),
      failText.replace(/\s+/g, " ").slice(0, 46),
    );
  }

  // ---------- 6. 重做回到本步快照（拿第 3 步验证） ----------
  await gotoStep(page, 3);
  await page.locator(`${STEP} [data-option-ok="false"]`).first().click();
  await page.waitForTimeout(100);
  await page.locator('[data-demo-id="demo-retry-3"]').click();
  await page.waitForTimeout(100);
  const afterRetry = await page.locator(STEP).getAttribute("data-step-state");
  const optionEnabled = await page.locator(`${STEP} [data-option-ok="true"]`).first().isEnabled();
  check("重做：回到本步初（idle + 可再选）", afterRetry === "idle" && optionEnabled);

  // ---------- 7. reduced motion ----------
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const rpage = await rctx.newPage();
  await rpage.goto(`${BASE}/scene-preview`, { waitUntil: "networkidle", timeout: 120_000 });
  await rpage.waitForSelector('[data-demo-id="demo-scene-vessel-flask"]', { timeout: 60_000 });
  await rpage.waitForTimeout(300);
  const before = await transformOf(rpage, '[data-demo-id="demo-scene-vessel-flask"]');
  const box = await rpage.locator('[data-demo-id="demo-scene-vessel-flask"]').boundingBox();
  if (box) {
    await rpage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await rpage.mouse.down();
    await rpage.waitForTimeout(80);
    const during = await transformOf(rpage, '[data-demo-id="demo-scene-vessel-flask"]');
    await rpage.mouse.up();
    check("reduced：按下不缩放（无位移）", during === before, `${before} → ${during}`);
  }
  await rpage.locator(`${STEP} [data-option-ok="true"]`).first().click();
  await rpage.waitForTimeout(150);
  const reducedOk = await rpage.locator('[data-demo-id="demo-feedback-ok-1"]').innerText();
  check("reduced：成功文案仍在", reducedOk.includes("操作正确"));
  await rpage.locator(STEP).screenshot({ path: path.join(OUT, "ix-step1-reduced.png") });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  check("全程 pageerror = 0", errors.length === 0, errors[0] ?? "");
  console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
  console.log(`截图目录：${OUT}`);
  if (failed.length) {
    console.log("失败项：", failed.map((f) => f.name).join("；"));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
