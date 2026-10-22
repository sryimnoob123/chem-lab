import { chromium } from "@playwright/test";
const BASE = "https://smnh6y8fgh.coze.site";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
// 在 hydration 前记录 DOM 快照（React 水合时会读这份 HTML）
await page.addInitScript(() => {
  window.__ssrBody = document.body ? document.body.innerHTML.length : -1;
});
const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
const resp = await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "commit" });
const ssrHtml = await resp.text();
// 从 SSR HTML 里抽出 body 的 data-demo-id 集合
const bodyOf = (h) => h.slice(h.indexOf("<body"));
const ssrBody = bodyOf(ssrHtml);
const ssrIds = new Set([...ssrBody.matchAll(/data-demo-id="([^"]+)"/g)].map((m) => m[1]));
console.log("SSR body 里的 demo-id 数:", ssrIds.size);
console.log("SSR 有 demo-hint-button:", ssrIds.has("demo-hint-button"));
console.log("SSR 有 demo-onboarding:", ssrIds.has("demo-onboarding"));
console.log("SSR 是否有 workbench 主体:", ssrIds.has("demo-finish"));
await page.waitForTimeout(3000);
console.log("错误:", errs.length, JSON.stringify(errs.slice(0, 2)));
await browser.close();
