/**
 * 验一键演示结束后 localStorage 的 chem-lab:input-mode 是否被清掉。
 * 用法：node scripts/audit-input-mode-reset.mjs [exp01]
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
await page.waitForTimeout(1600);
await dismissOnboarding(page, { waitMs: 800 });

await page.locator("[data-demo-id='demo-mode-auto']").click();
const afterClick = await page.evaluate(() => localStorage.getItem("chem-lab:input-mode"));

for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(1000);
  if (page.url().includes("/report")) break;
}
const onReport = page.url().includes("/report");
const afterFinish = await page.evaluate(() => localStorage.getItem("chem-lab:input-mode"));

// 再开一次工作台，看默认模式
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await dismissOnboarding(page, { waitMs: 800 });
const reopened = await page.evaluate(() => ({
  inputMode: document.querySelector("[data-input-mode]")?.getAttribute("data-input-mode") ?? null,
  activeMode: document.querySelector("[data-demo-id='demo-mode-auto']")?.getAttribute("data-current") ?? null,
  ls: localStorage.getItem("chem-lab:input-mode"),
}));

console.log(JSON.stringify({ afterClick, onReport, afterFinish, reopened }, null, 2));
await browser.close();
