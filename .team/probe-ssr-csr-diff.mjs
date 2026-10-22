import { chromium } from "@playwright/test";
const BASE = "https://smnh6y8fgh.coze.site";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
const resp = await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
const ssr = await resp.text();
await page.waitForTimeout(3500);
const csr = await page.content();
// 比较 <html> 与 <body> 的开标签
const pick = (html) => {
  const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "";
  const bodyTag = html.match(/<body[^>]*>/)?.[0] ?? "";
  return { htmlTag, bodyTag };
};
console.log("SSR:", JSON.stringify(pick(ssr)));
console.log("CSR:", JSON.stringify(pick(csr)));
// 找 SSR 里出现但 CSR 里没有的 data-demo-id
const idsOf = (h) => new Set([...h.matchAll(/data-demo-id="([^"]+)"/g)].map((m) => m[1]));
const ssrIds = idsOf(ssr);
const csrIds = idsOf(csr);
const onlySsr = [...ssrIds].filter((i) => !csrIds.has(i));
const onlyCsr = [...csrIds].filter((i) => !ssrIds.has(i));
console.log("仅 SSR 有:", JSON.stringify(onlySsr.slice(0, 10)));
console.log("仅 CSR 有:", JSON.stringify(onlyCsr.slice(0, 10)));
await browser.close();
