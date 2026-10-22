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

// 1) 有哪些试剂按钮、哪些器皿
const inv = await page.evaluate(() => ({
  reagentButtons: [...document.querySelectorAll('[data-demo-id^="demo-reagent"]')].map((el) => ({
    id: el.getAttribute("data-demo-id"), text: el.textContent?.trim().slice(0, 12), next: el.getAttribute("data-next"),
  })),
  vessels: [...document.querySelectorAll('[data-demo-id^="demo-scene-vessel"]')].map((el) => el.getAttribute("data-demo-id")),
  hasDraggableAttr: [...document.querySelectorAll("[draggable='true']")].map((el) => el.getAttribute("data-demo-id") ?? el.tagName).slice(0, 10),
}));
console.log("试剂按钮:", JSON.stringify(inv.reagentButtons));
console.log("器皿:", JSON.stringify(inv.vessels));
console.log("仍带 draggable 属性:", JSON.stringify(inv.hasDraggableAttr));
await browser.close();
