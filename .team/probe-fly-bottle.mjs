import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const BASE = "http://127.0.0.1:3001";
const OUT = join(tmpdir(), "chemlab-shots", "fly-bottle");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
// 第 1 步正确动作：通风橱内就位
for (const name of ["通风橱内就位", "组装", "就位"]) {
  const btn = page.locator('[data-demo-id="demo-op-step1-assemble"]').first();
  if (await btn.isVisible().catch(() => false)) { await btn.click({ timeout: 3000 }).catch(() => {}); break; }
}
await page.waitForTimeout(1500);
const stepNow = await page.evaluate(() => document.querySelector("[data-demo-id='demo-guide-card']")?.textContent?.slice(0, 50));
console.log("推进后步骤:", stepNow);

// 第 2 步：拖蒸馏水到烧杯
const src = await page.locator('[data-demo-id="demo-scene-reagent-water"]').first().boundingBox().catch(() => null);
const beaker = await page.locator('[data-demo-id="demo-scene-vessel-beaker"]').first().boundingBox().catch(() => null);
console.log("试剂:", JSON.stringify(src), "烧杯:", JSON.stringify(beaker));
if (src && beaker) {
  const sx = src.x + src.width / 2, sy = src.y + src.height / 2;
  const tx = beaker.x + beaker.width / 2, ty = beaker.y + beaker.height / 2 - 20;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12); await page.waitForTimeout(25); }
  await page.waitForTimeout(120);
  await page.mouse.up();
  // 抓倾倒中的帧
  await page.waitForTimeout(420);
  const mid = await page.evaluate(() => {
    const fly = document.querySelector("[data-pour-bottle]");
    const drops = document.querySelectorAll("[data-pour-drop]");
    let flyBox = null, opacity = null, transform = null;
    if (fly) {
      const r = fly.getBoundingClientRect();
      flyBox = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      const cs = getComputedStyle(fly);
      opacity = cs.opacity; transform = cs.transform;
    }
    return { hasFly: !!fly, flyBox, opacity, transform, dropCount: drops.length };
  });
  console.log("倾倒中:", JSON.stringify(mid));
  await page.screenshot({ path: join(OUT, "exp09-step2-pour-mid.png") });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: join(OUT, "exp09-step2-pour-done.png") });
  const after = await page.evaluate(() => ({
    step: document.querySelector("[data-demo-id='demo-guide-card']")?.textContent?.slice(0, 60),
    beakerText: document.querySelector("[data-demo-id='demo-scene-vessel-beaker']")?.textContent?.slice(0, 20),
  }));
  console.log("倒完:", JSON.stringify(after));
  console.log("shots:", OUT);
}
await browser.close();
