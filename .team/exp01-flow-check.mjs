/* demo-flow 自测：exp01 七步全流程（真实点选 + 第4/5步真实拖拽蒸馏水）→ 交卷 → 报告页。
   断言：每步 stepIndex 恰好 +1、无卡死、最终落到 /exp/exp01/report 且有分数。
   截图：第1步 / 倾倒动画帧 / 报告页 → %TEMP%\chemlab-shots\exp01-flow\ */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.CHEMLAB_BASE ?? "http://localhost:3001";
const OUT = path.join(process.env.TEMP, "chemlab-shots", "exp01-flow");
fs.mkdirSync(OUT, { recursive: true });

const STEP_RE = /第\s*(\d+)\s*步/;

async function snapshotState(page) {
  return page.evaluate(() => {
    const top = document.querySelector('[class*="topStep"]')?.textContent ?? "";
    const card = document.querySelector('[data-guide="next"]');
    const board = document.querySelector('[data-demo-id="demo-mission-board"]');
    return {
      top,
      suggestedId: card?.getAttribute("data-demo-id") ?? "",
      cardText: (card?.textContent ?? "").replace(/\s+/g, " ").trim(),
      boardText: (board?.textContent ?? "").replace(/\s+/g, " ").trim(),
      done: Boolean(document.querySelector('[data-demo-id="demo-finish"]')),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.text().slice(0, 120)} @ ${(m.location()?.url ?? "").slice(0, 120)}`);
  });

  await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-guide="next"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "step1.png") });

  const steps = [];
  let lastStepNo = 0;
  const checked = []; // { stepNo, title, card }
  let pourShot = "";
  let guard = 0;

  while (guard++ < 60) {
    const state = await snapshotState(page);
    const m = STEP_RE.exec(state.top);
    const stepNo = m ? Number(m[1]) : lastStepNo;
    if (stepNo !== lastStepNo) {
      lastStepNo = stepNo;
      const title = state.boardText.split(" ").slice(0, 2).join(" ");
      checked.push({ stepNo, title, card: state.cardText, suggestedId: state.suggestedId });
      steps.push({ stepNo, delta: checked.length > 1 ? stepNo - checked[checked.length - 2].stepNo : stepNo - 1 });
      console.log(`STEP ${stepNo} | 引导: ${state.cardText}`);
    }
    if (!state.suggestedId) {
      // 本步所有建议动作都做完、但还没进下一步（等渲染）
      await page.waitForTimeout(300);
      continue;
    }
    if (state.suggestedId === "demo-op-step4-dissolve" || state.suggestedId === "demo-op-step5-water") {
      // 真实拖拽：蒸馏水瓶 → 器皿热区
      await page.dragAndDrop(
        '[data-demo-id="demo-scene-reagent-water"]',
        '[data-demo-id="demo-scene-drop-flask"]',
        { timeout: 8000 },
      );
      await page.waitForTimeout(260); // 倒入动画（700ms）播放中
      if (!pourShot) {
        pourShot = path.join(OUT, "pour-during-drag.png");
        await page.screenshot({ path: pourShot });
      }
      await page.waitForTimeout(1200);
      continue;
    }
    // 交卷：最后一步完成后出现完成区
    const finishVisible = await page.locator('[data-demo-id="demo-finish"]').isVisible().catch(() => false);
    if (finishVisible && stepNo === 7) {
      const doneBlock = await page.locator('[class*="finish"]').count().catch(() => 0);
      if (doneBlock > 0) break;
    }
    await page.click('[data-guide="next"]', { timeout: 8000 });
    await page.waitForTimeout(700);
  }

  // 交卷
  await page.click('[data-demo-id="demo-finish"]');
  await page.waitForURL(/\/exp\/exp01\/report/, { timeout: 30000 });
  await page.waitForSelector('[data-demo-id="demo-report"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  const report = await page.evaluate(() => {
    const text = document.querySelector('[data-demo-id="demo-report"]')?.textContent ?? "";
    const clean = text.replace(/\s+/g, " ");
    const total = /总分\s*([0-9]+(?:\.[0-9]+)?)/.exec(clean)?.[1] ?? "";
    return { url: location.pathname + location.search, total, excerpt: clean.slice(0, 300) };
  });
  await page.screenshot({ path: path.join(OUT, "report.png") });

  const deltas = steps.map((s) => s.delta);
  const okSteps = steps.length >= 7 && deltas.every((d) => d === 1);
  const result = {
    url: page.url(),
    stepCount: steps.length,
    steps,
    deltas,
    eachStepPlusOne: okSteps,
    report,
    consoleErrors: errors.length,
    errors: errors.slice(0, 8),
    shots: {
      step1: path.join(OUT, "step1.png"),
      pour: pourShot,
      report: path.join(OUT, "report.png"),
    },
  };
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(result, null, 2));
  process.exit(okSteps && report.total !== "" ? 0 : 1);
}

main().catch((e) => {
  console.error("RUN FAILED", e);
  process.exit(2);
});
