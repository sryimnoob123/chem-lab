import { chromium } from "@playwright/test";
const BASE = "https://smnh6y8fgh.coze.site";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const info = await page.evaluate(() => ({
  hasBulb: !!document.querySelector("[data-demo-id='demo-hint-button']"),
  hasBoard: !!document.querySelector("[data-demo-id='demo-mission-board']"),
  hasFinish: !!document.querySelector("[data-demo-id='demo-finish']"),
  bodyLen: document.body.innerText.length,
  text: document.body.innerText.replace(/\s+/g, " ").slice(0, 200),
}));
console.log(JSON.stringify(info, null, 1));
await browser.close();
