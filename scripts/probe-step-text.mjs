/**
 * 复现「步骤推进了，但结果条还是上一步文案」。
 * 用法：node scripts/probe-step-text.mjs exp01
 */
import { chromium } from "@playwright/test";
import { clickOpById, dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await dismissOnboarding(page, { waitMs: 900 });

const readState = () =>
  page.evaluate(() => {
    const bar = document.querySelector("[class*='resultBar']");
    const barText = bar ? (bar.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90) : null;
    // 当前步骤标题：看左上角看板
    const h = document.querySelector("[class*='stepTitle'], [class*='missionTitle'], h2, h3");
    const stepLabel = document.body.innerText.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return {
      step: stepLabel ? `${stepLabel[1]}/${stepLabel[2]}` : null,
      barText,
      title: h ? (h.textContent ?? "").trim().slice(0, 40) : null,
    };
  });

const log = [];
log.push({ phase: "initial", ...(await readState()) });

// 依次点 step1 的动作，直到步骤推进
const ops = [
  "demo-op-step1-check",
  "demo-op-step1-wash",
  "demo-op-step1-dry",
  "demo-op-step1-rinse",
  "demo-op-step1-wipe",
];

for (const op of ops) {
  const ok = await clickOpById(page, op, { timeout: 3000 });
  if (!ok) continue;
  await page.waitForTimeout(1300);
  const st = await readState();
  log.push({ phase: `after ${op}`, ...st });
  if (st.step && st.step.startsWith("2")) break;
}

// 如果已到第 2 步，再点一个 step2 的动作，看文案是否跟上
if (log.at(-1)?.step?.startsWith("2")) {
  log.push({ phase: "step2-before-op", ...(await readState()) });
  const ops2 = ["demo-op-step2-calibrate", "demo-op-step2-zero", "demo-op-step2-touch"];
  for (const op of ops2) {
    const ok = await clickOpById(page, op, { timeout: 3000 });
    if (!ok) continue;
    await page.waitForTimeout(1500);
    log.push({ phase: `after ${op}`, ...(await readState()) });
    break;
  }
}

console.log(JSON.stringify(log, null, 2));
await page.screenshot({ path: "public/shots-prod/redteam/probe-step-text.png" });
await browser.close();
