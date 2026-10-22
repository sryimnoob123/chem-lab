import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const b = await chromium.launch({ executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = ctx.pages()[0] ?? (await ctx.newPage());
await p.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await p.goto(`${BASE}/experiments`, { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(2000);
await p.click('[data-dev="dock-toggle"]');
await p.waitForTimeout(900);
const r = await p.evaluate(() => {
  const els = [...document.querySelectorAll('[data-dev="dock-oneclick-demo"]')];
  return {
    n: els.length,
    sizes: els.map((e) => { const b = e.getBoundingClientRect(); return { exp: e.getAttribute("data-exp"), w: Math.round(b.width), h: Math.round(b.height), vis: b.width > 0 }; }),
    dockItems: document.querySelectorAll('[data-dev="dock"] a, [data-dev="dock"] button').length,
  };
});
console.log(JSON.stringify(r, null, 1).slice(0, 1200));
await b.close();
