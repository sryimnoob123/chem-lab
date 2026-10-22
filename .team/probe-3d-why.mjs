import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(m.type() + ": " + m.text().slice(0, 200)));
page.on("pageerror", (e) => logs.push("pageerror: " + String(e.message).slice(0, 200)));
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await page.goto(`${BASE}/exp/exp09?force=1&scene=3d`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const state = await page.evaluate(() => ({
  url: location.href,
  has3dWrap: !!document.querySelector('[data-demo-id="demo-scene-3d-wrap"]'),
  hasLoading: !!document.querySelector('[data-demo-id="demo-scene-3d-loading"]'),
  hasBench: !!document.querySelector('[data-demo-id="exp09-bench-scene"]'),
  canvases: document.querySelectorAll("canvas").length,
  sceneStageHtml: document.querySelector('[class*="sceneStage"]')?.innerHTML.slice(0, 300),
}));
console.log(JSON.stringify(state, null, 1));
console.log("--- 控制台 ---");
console.log(logs.slice(0, 8).join("\n"));
await browser.close();
