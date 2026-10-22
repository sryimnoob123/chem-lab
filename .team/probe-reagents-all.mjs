import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
for (const exp of ["exp01", "exp03", "exp09"]) {
  await page.goto(`${BASE}/exp/${exp}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  const inv = await page.evaluate(() => ({
    reagents: [...document.querySelectorAll('[data-demo-id^="demo-scene-reagent"]')].map((el) => el.getAttribute("data-demo-id")),
    guide: document.querySelector("[data-demo-id='demo-guide-card']")?.textContent?.slice(0, 40),
  }));
  console.log(exp, "| 试剂:", JSON.stringify(inv.reagents), "| 步骤:", inv.guide);
}
await browser.close();
