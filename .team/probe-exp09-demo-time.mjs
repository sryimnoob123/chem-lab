import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const stateOf = () => page.locator(".demo-bar__state").first().getAttribute("data-state").catch(() => null);
await page.goto(`${BASE}/demo?autoplay=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await page.selectOption('[data-demo-id="demo-page-script"]', "exp09").catch(() => {});
await page.waitForTimeout(1500);
await page.locator('[data-demo-id="demo-page-play"]').click().catch(() => {});
const t0 = Date.now();
let last = "";
for (let i = 0; i < 210; i++) {
  await page.waitForTimeout(1000);
  const s = await stateOf();
  if (s !== last) { console.log(`t=${Math.round((Date.now()-t0)/1000)}s state=${s}`); last = s; }
  if (s === "done") { console.log(`✅ exp09 用时 ${Math.round((Date.now()-t0)/1000)}s`); break; }
  const caption = await page.locator(".demo-bar__caption, [data-demo-id='demo-page-caption']").first().innerText().catch(() => "");
  if (i % 15 === 0 && caption) console.log(`   [${i}s] ${caption.slice(0, 50)}`);
}
await browser.close();
