import { chromium } from "@playwright/test";
const BASE = "https://smnh6y8fgh.coze.site";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const details = [];
page.on("console", async (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  details.push({ type: "console", text: t.slice(0, 400) });
});
page.on("pageerror", (e) => details.push({ type: "pageerror", text: String(e.message).slice(0, 400), stack: String(e.stack ?? "").slice(0, 600) }));
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
console.log("错误详情：");
for (const d of details) console.log(JSON.stringify(d, null, 1));
// 检查 HTML 结构非法嵌套：p/div 嵌套
const nest = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll("p div, p section, p ul, p ol, p table").forEach((el) => {
    bad.push(el.tagName + " inside " + el.parentElement?.tagName);
  });
  return bad.slice(0, 10);
});
console.log("非法嵌套:", JSON.stringify(nest));
await browser.close();
