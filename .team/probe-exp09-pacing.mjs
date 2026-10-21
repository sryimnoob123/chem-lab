import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/demo`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.selectOption('[data-demo-id="demo-page-script"]', "exp09").catch(() => {});
await page.waitForTimeout(1200);
await page.locator('[data-demo-id="demo-page-play"]').click().catch(() => {});
const t0 = Date.now();
let lastStep = "";
for (let i = 0; i < 200; i++) {
  await page.waitForTimeout(1000);
  const s = await page.locator(".demo-bar__state").first().getAttribute("data-state").catch(() => null);
  const step = await page.evaluate(() => {
    const el = document.querySelector(".demo-bar__step, [data-demo-id='demo-page-step']");
    return el ? el.textContent : "";
  });
  if (step !== lastStep) { console.log(`t=${Math.round((Date.now()-t0)/1000)}s state=${s} step=${step}`); lastStep = step; }
  if (s === "done") { console.log(`RESULT exp09=${Math.round((Date.now()-t0)/1000)}s`); break; }
  if (i === 190) console.log(`TIMEOUT at 190s, last state=${s}`);
}
await browser.close();
