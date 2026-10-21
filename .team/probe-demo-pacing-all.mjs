import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
for (const id of ["exp01", "exp03", "exp09"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.selectOption('[data-demo-id="demo-page-script"]', id).catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator('[data-demo-id="demo-page-play"]').click().catch(() => {});
  const t0 = Date.now();
  let done = false;
  for (let i = 0; i < 150; i++) {
    await page.waitForTimeout(1000);
    const s = await page.locator(".demo-bar__state").first().getAttribute("data-state").catch(() => null);
    if (s === "done") { done = true; break; }
  }
  const sec = Math.round((Date.now() - t0) / 1000);
  console.log(`${id}\t${done ? "✅" : "❌"} ${sec}s\t${sec >= 40 && sec <= 90 && done ? "PASS" : "FAIL"}`);
  await ctx.close();
}
await browser.close();
