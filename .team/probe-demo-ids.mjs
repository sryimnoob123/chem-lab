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
const all = await page.evaluate(() => ({
  demoIds: [...document.querySelectorAll("[data-demo-id]")].map((el) => el.getAttribute("data-demo-id")).slice(0, 40),
  reagentLike: [...document.querySelectorAll("button")].map((el) => ({ id: el.getAttribute("data-demo-id"), t: el.textContent?.trim().slice(0, 16) })).filter((x) => x.id && /reagent|瓶|液|水|酸|碱/i.test((x.id ?? "") + (x.t ?? ""))).slice(0, 15),
}));
console.log("前 40 个 demo-id:", JSON.stringify(all.demoIds));
console.log("像试剂的按钮:", JSON.stringify(all.reagentLike));
await browser.close();
