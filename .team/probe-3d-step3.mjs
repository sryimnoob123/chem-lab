import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push("ERR " + String(e.message).slice(0, 160)));
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
// 直接进 exp09 第 3 步（滴定区），带 scene=3d
await page.goto(`${BASE}/exp/exp09?force=1&scene=3d&step=3`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  has3dWrap: !!document.querySelector('[data-demo-id="demo-scene-3d-wrap"]'),
  hasLoading: !!document.querySelector('[data-demo-id="demo-scene-3d-loading"]'),
  canvases: document.querySelectorAll("canvas").length,
  canvasSize: (() => { const c = document.querySelector("canvas"); return c ? { w: c.width, h: c.height } : null; })(),
}));
console.log(JSON.stringify(state));
console.log("errors:", logs.slice(0, 3).join(" | "));
await page.screenshot({ path: "C:\\Users\\14681\\AppData\\Local\\Temp\\chemlab-shots\\preview-3d\\exp09-3d-step3.png" });
await browser.close();
