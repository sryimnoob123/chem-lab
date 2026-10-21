/**
 * 点"自动"后每 2 秒采样一次步骤，看它停在哪儿。
 * 用法：node scripts/audit-autorun-progress.mjs [exp01]
 */
import { chromium } from "@playwright/test";
import { dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await dismissOnboarding(page, { waitMs: 800 });

await page.locator("[data-demo-id='demo-mode-auto']").click();

const timeline = [];
const t0 = Date.now();
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  const s = await page.evaluate(() => {
    const body = document.body.innerText;
    const m = body.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*0?(\d+)\s*步/);
    const done = /已完成|查看报告|这次实验结束/.test(body);
    const bar = document.querySelector("[class*='resultBar']");
    return {
      step: m ? Number(m[1]) : null,
      total: m ? Number(m[2]) : null,
      done,
      bar: bar ? (bar.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50) : null,
      hasFinish: Boolean(document.querySelector("[data-demo-id='demo-finish']")),
    };
  });
  timeline.push({ t: Math.round((Date.now() - t0) / 1000), ...s });
  if (s.done || (s.step === s.total && s.hasFinish)) break;
}

console.log(JSON.stringify(timeline, null, 2));

// 如果没跑完，看当前步骤有哪些 choice
const choices = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("[data-demo-id^='demo-op-']")].map((el) => ({
    id: el.getAttribute("data-demo-id"),
    text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24),
    disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
  }));
  return nodes.slice(0, 14);
});
console.log("当前步骤可选动作:", JSON.stringify(choices, null, 2));
await page.screenshot({ path: "public/shots-prod/redteam/r6-autorun-stuck.png" });
await browser.close();
