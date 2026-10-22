/** 诊断2：点一次 check 之后，状态到底变了没有。 */
import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
const reqs = [];
page.on("request", (r) => { if (r.url().includes("/api/")) reqs.push(r.method() + " " + r.url().replace(BASE, "")); });
page.on("response", async (r) => {
  if (r.url().includes("/api/") && r.status() >= 400) console.log("FAIL", r.status(), r.url().replace(BASE, ""));
});
await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
const snap = () => page.evaluate(() => ({
  step: document.querySelector("[data-demo-id='demo-mission-board']")?.textContent?.replace(/\s+/g, " ").slice(0, 90),
  nextName: document.querySelector("[data-guide='next'] [class*='nextName']")?.textContent,
  obs: [...document.querySelectorAll("[class*='ledgerRow'],[class*='observation']")].length,
  toast: document.querySelector("[class*='notice'],[class*='eventLine']")?.textContent?.slice(0, 60),
}));
console.log("before:", JSON.stringify(await snap(), null, 1));
await page.locator('[data-demo-id="demo-op-step1-check"]').click({ timeout: 5000 });
await page.waitForTimeout(2000);
console.log("after :", JSON.stringify(await snap(), null, 1));
console.log("api:", reqs.join(" | "));
await browser.close();
