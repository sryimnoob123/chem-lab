import { chromium } from "@playwright/test";
const BASE = "https://smnh6y8fgh.coze.site";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
const resp = await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "commit" });
const ssr = await resp.text();
await page.waitForTimeout(2500);
const csr = await page.content();
// 只比较 body 的直接子节点序列 + 每个子节点的 tag/class 前 60 字符
const shape = (html) => {
  const body = html.slice(html.indexOf("<body"));
  return [...body.matchAll(/<(div|section|main|header|aside|nav|footer|p|h1|h2|ul|ol|button)[^>]*class="([^"]{0,60})"/g)]
    .slice(0, 40)
    .map((m) => `${m[1]}.${m[2].split(" ")[0]}`);
};
const a = shape(ssr), b = shape(csr);
console.log("SSR 前 20 个节点:", JSON.stringify(a.slice(0, 20)));
console.log("CSR 前 20 个节点:", JSON.stringify(b.slice(0, 20)));
let firstDiff = -1;
for (let i = 0; i < Math.min(a.length, b.length); i++) { if (a[i] !== b[i]) { firstDiff = i; break; } }
console.log("首个差异位置:", firstDiff, firstDiff >= 0 ? `SSR=${a[firstDiff]} CSR=${b[firstDiff]}` : "无");
await browser.close();
