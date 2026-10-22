import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const b = await chromium.launch({ executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = ctx.pages()[0] ?? (await ctx.newPage());
await p.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
for (const url of ["/dev", "/experiments", "/exp/exp09?force=1"]) {
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({
    devAttrs: [...document.querySelectorAll("[data-dev]")].map((e) => e.getAttribute("data-dev")).slice(0, 30),
    dockets: [...document.querySelectorAll("[class*=dock], [data-dock]")].map((e) => (e.className || "").toString().slice(0, 60)).slice(0, 10),
    links: [...document.querySelectorAll('a[href*="autodemo"]')].map((a) => a.getAttribute("href")).slice(0, 12),
  }));
  console.log(url, JSON.stringify(info, null, 1).slice(0, 900));
}
await b.close();
