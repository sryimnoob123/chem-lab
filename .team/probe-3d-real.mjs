import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(400);

// 用键盘推进 3 步
for (let i = 0; i < 3; i++) {
  const g = await page.evaluate(() => document.querySelector("[data-demo-id='demo-guide-card']")?.textContent ?? "");
  const k = g.match(/按\s*(\d)/)?.[1] ?? "1";
  await page.keyboard.press(k);
  await page.waitForTimeout(1600);
  const stepNo = await page.evaluate(() => document.body.innerText.match(/第 (\d+) \/ (\d+) 步/)?.[1]);
  console.log(`推进 ${i + 1} -> 第 ${stepNo} 步`);
}
// 带 scene=3d 重新加载（看进度是否保留）
await page.goto(`${BASE}/exp/exp09?force=1&scene=3d`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  step: document.body.innerText.match(/第 (\d+) \/ (\d+) 步/)?.[0],
  has3d: !!document.querySelector('[data-demo-id="demo-scene-3d-wrap"]'),
  has3dCanvas: !!document.querySelector('[data-demo-id="demo-scene-3d"] canvas'),
  canvases: document.querySelectorAll("canvas").length,
}));
console.log(JSON.stringify(state));
if (state.has3dCanvas) await page.screenshot({ path: "C:\\Users\\14681\\AppData\\Local\\Temp\\chemlab-shots\\preview-3d\\exp09-real-3d.png" });
console.log("errors:", errs.slice(0, 3));
await browser.close();
