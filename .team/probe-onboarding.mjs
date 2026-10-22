/** 诊断 onboarding 模态：按钮、层级、能否用真实点击关掉。 */
import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
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
const dump = () => page.evaluate(() => {
  const modal = document.querySelector("[data-demo-id='demo-onboarding']");
  const next = document.querySelector("[data-demo-id='demo-onboarding-next']");
  const r = next?.getBoundingClientRect();
  const stack = r ? document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2).slice(0, 4)
    .map((el) => `${el.tagName}.${(typeof el.className === "string" ? el.className : "").split(" ")[0]}|${el.getAttribute?.("data-demo-id") ?? ""}`) : null;
  return {
    modalOpen: !!modal,
    nextVisible: !!next && r.width > 0,
    nextRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    stack,
    pageScrollY: Math.round(window.scrollY),
    modalPos: modal ? getComputedStyle(modal.parentElement).position : null,
  };
});
console.log("init:", JSON.stringify(await dump(), null, 1));
for (let i = 0; i < 5; i++) {
  const ok = await page.evaluate(() => {
    const b = document.querySelector("[data-demo-id='demo-onboarding-next']");
    if (!b) return false;
    b.click();
    return true;
  });
  await page.waitForTimeout(350);
  if (!ok) break;
}
console.log("after:", JSON.stringify(await dump(), null, 1));
await browser.close();
