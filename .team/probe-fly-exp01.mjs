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
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(500);

// 按 1 逐步推进到第 5 步（溶解/加蒸馏水）
for (let i = 0; i < 4; i++) {
  await page.keyboard.press("1");
  await page.waitForTimeout(1400);
  const g = await page.evaluate(() => document.querySelector("[data-demo-id='demo-guide-card']")?.textContent?.slice(0, 46));
  console.log(`推进 ${i + 1}:`, g);
}
const stepNo = await page.evaluate(() => document.body.innerText.match(/第 (\d+) \/ (\d+) 步/)?.[0]);
console.log("当前:", stepNo);

const src = await page.locator('[data-demo-id="demo-scene-reagent-water"]').first().boundingBox().catch(() => null);
const beaker = await page.locator('[data-demo-id="demo-scene-vessel-beaker"]').first().boundingBox().catch(() => null);
console.log("水试剂:", JSON.stringify(src), "烧杯:", JSON.stringify(beaker));
if (src && beaker) {
  const sx = src.x + src.width / 2, sy = src.y + src.height / 2;
  const tx = beaker.x + beaker.width / 2, ty = beaker.y + beaker.height / 2 - 20;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12); await page.waitForTimeout(25); }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const mid = await page.evaluate(() => {
    const fly = document.querySelector("[data-pour-bottle]");
    let box = null, transform = null, opacity = null;
    if (fly) {
      const r = fly.getBoundingClientRect();
      box = { x: Math.round(r.x), y: Math.round(r.y) };
      transform = getComputedStyle(fly).transform;
      opacity = getComputedStyle(fly).opacity;
    }
    return { hasFly: !!fly, box, transform, opacity, drops: document.querySelectorAll("[data-pour-drop]").length };
  });
  console.log("倾倒中:", JSON.stringify(mid));
  await page.screenshot({ path: join(OUT, "exp01-step5-pour-mid.png") });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "exp01-step5-pour-after.png") });
  const after = await page.evaluate(() => ({
    step: document.body.innerText.match(/第 (\d+) \/ (\d+) 步/)?.[0],
    caption: document.querySelector("[data-demo-id='demo-scene-event']")?.textContent?.slice(0, 60),
  }));
  console.log("倒完:", JSON.stringify(after));
  console.log("shots:", OUT);
}
await browser.close();
