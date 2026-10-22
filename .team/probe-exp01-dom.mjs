/** dump exp01 页面的可推进按钮，弄清"观察步"怎么点。 */
import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /跳过|知道了|开始/ }).first().click().catch(() => {});
await page.waitForSelector('[data-demo-id="demo-guide-card"]', { timeout: 20000 }).catch(() => {});
const dump = await page.evaluate(() => {
  const card = document.querySelector('[data-demo-id="demo-guide-card"]');
  const btns = [...document.querySelectorAll("button")].map((b) => ({
    demo: b.getAttribute("data-demo-id"),
    text: (b.textContent ?? "").trim().slice(0, 28),
    vis: b.offsetParent !== null,
  }));
  return {
    cardText: (card?.textContent ?? "").replace(/\s+/g, " ").slice(0, 200),
    demoIds: btns.filter((b) => b.demo).map((b) => `${b.demo}|${b.text}|${b.vis}`),
  };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
