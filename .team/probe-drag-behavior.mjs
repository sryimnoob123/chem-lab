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

const box = async (sel) => await page.locator(sel).first().boundingBox().catch(() => null);

// --- 测试 A：试剂按钮 -> 容量瓶（真实 pointer 三段）---
const src = await box('[data-demo-id="demo-scene-reagent-water"]');
const dst = await box('[data-demo-id="demo-scene-vessel-volumetric"]');
console.log("A 起点:", JSON.stringify(src), "落点:", JSON.stringify(dst));
if (src && dst) {
  const sx = src.x + src.width / 2, sy = src.y + src.height / 2;
  const dx = dst.x + dst.width / 2, dy = dst.y + dst.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + ((dx - sx) * i) / steps, sy + ((dy - sy) * i) / steps);
    await page.waitForTimeout(25);
  }
  const overState = await page.evaluate(() => ({
    flaskOver: document.querySelector('[data-demo-id="demo-scene-drop-flask"]')?.getAttribute("data-over"),
    dragOver: document.querySelector('[data-demo-id="demo-scene-vessel-volumetric"]')?.getAttribute("data-drag-over"),
    dragging: document.querySelector('[data-dragging="true"]')?.getAttribute("data-demo-id"),
  }));
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    dataOver: document.querySelector('[data-demo-id="demo-scene-drop-flask"]')?.getAttribute("data-over"),
    vesselFeedback: document.querySelector('[data-feedback]')?.getAttribute("data-demo-id"),
    volumetricText: document.querySelector('[data-demo-id="demo-scene-vessel-volumetric"]')?.textContent?.slice(0, 40),
  }));
  console.log("A 拖动中:", JSON.stringify(overState));
  console.log("A 松手后:", JSON.stringify(after));
}

// --- 测试 B：器皿本身能不能被拖动（按下烧杯横向移 200px）---
const beaker = await box('[data-demo-id="demo-scene-vessel-beaker"]');
if (beaker) {
  const bx = beaker.x + beaker.width / 2, by = beaker.y + beaker.height / 2;
  const before = await page.locator('[data-demo-id="demo-scene-vessel-beaker"]').first().boundingBox();
  await page.mouse.move(bx, by);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(bx + 20 * i, by);
    await page.waitForTimeout(25);
  }
  const midDrag = await page.evaluate(() => ({
    pressed: document.querySelector('[data-demo-id="demo-scene-vessel-beaker"]')?.getAttribute("data-pressed"),
    dragging: document.querySelector('[data-dragging="true"]')?.getAttribute("data-demo-id") ?? null,
  }));
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await page.locator('[data-demo-id="demo-scene-vessel-beaker"]').first().boundingBox();
  console.log("B 器皿按下时:", JSON.stringify(midDrag));
  console.log("B 器皿位置 前:", before && Math.round(before.x), "后:", after && Math.round(after.x), "位移:", before && after ? Math.round(after.x - before.x) : "n/a");
}
await page.screenshot({ path: "C:\\Users\\14681\\AppData\\Local\\Temp\\chemlab-shots\\preview-3d\\after-drag-test.png" });
await browser.close();
