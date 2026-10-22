import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await page.goto(`${BASE}/exp/exp03?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(600);

// 拖到烧杯中心
const src = await page.locator('[data-demo-id="demo-scene-reagent-water"]').first().boundingBox();
const beaker = await page.locator('[data-demo-id="demo-scene-vessel-beaker"]').first().boundingBox();
const sx = src.x + src.width / 2, sy = src.y + src.height / 2;
const tx = beaker.x + beaker.width / 2, ty = beaker.y + beaker.height / 2;
await page.mouse.move(sx, sy);
await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12); await page.waitForTimeout(25); }
await page.waitForTimeout(200);
const over = await page.evaluate(() => ({
  over: document.querySelector('[data-demo-id="demo-scene-drop-flask"]')?.getAttribute("data-over"),
  beakerDragOver: document.querySelector('[data-demo-id="demo-scene-vessel-beaker"]')?.getAttribute("data-drag-over"),
}));
await page.mouse.up();
await page.waitForTimeout(1800);
const after = await page.evaluate(() => ({
  step: document.querySelector('[data-demo-id="demo-guide-card"]')?.textContent?.slice(0, 40),
  beakerText: document.querySelector('[data-demo-id="demo-scene-vessel-beaker"]')?.textContent?.slice(0, 30),
  caption: document.querySelector('[data-demo-id="demo-scene-event"]')?.textContent?.slice(0, 60),
  eventBar: document.body.innerText.match(/给水|加水|不合适|这一步/g)?.slice(0, 4),
}));
console.log("拖动中:", JSON.stringify(over));
console.log("拖放后:", JSON.stringify(after));
await page.screenshot({ path: "C:\\Users\\14681\\AppData\\Local\\Temp\\chemlab-shots\\preview-3d\\drop-on-beaker.png" });
await browser.close();
