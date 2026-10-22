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

const sel = '[data-demo-id="demo-scene-reagent-water"]';
const b0 = await page.locator(sel).first().boundingBox();
console.log("按下前 瓶子位置:", JSON.stringify({ x: Math.round(b0.x), y: Math.round(b0.y), w: Math.round(b0.width) }));

const sx = b0.x + b0.width / 2, sy = b0.y + b0.height / 2;
await page.mouse.move(sx, sy);
await page.mouse.down();
await page.waitForTimeout(100);
await page.mouse.move(sx + 150, sy + 120, { steps: 8 });
await page.waitForTimeout(200);
const b1 = await page.locator(sel).first().boundingBox();
const dragState = await page.evaluate((s) => {
  const el = document.querySelector(s);
  const cs = el ? getComputedStyle(el) : null;
  return { dragging: el?.getAttribute("data-dragging"), transform: cs?.transform, position: cs?.position, zIndex: cs?.zIndex, opacity: cs?.opacity };
}, sel);
console.log("拖动中 瓶子位置:", JSON.stringify({ x: Math.round(b1.x), y: Math.round(b1.y) }));
console.log("拖动中 状态:", JSON.stringify(dragState));
console.log("位移:", Math.round(b1.x - b0.x), Math.round(b1.y - b0.y), "（鼠标移了 150,120）");
await page.mouse.up();
await browser.close();
