/** 诊断：exp01 点击为何无效（谁挡住了按钮）。 */
import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 200)); });
await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const btn = document.querySelector('[data-demo-id="demo-op-step1-check"]');
  if (!btn) return { none: true };
  btn.scrollIntoView({ block: "center" });
  const r = btn.getBoundingClientRect();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((el) => {
    const cls = typeof el.className === "string" ? el.className : "";
    return `${el.tagName}.${cls.split(" ")[0]} demo=${el.getAttribute?.("data-demo-id") ?? ""}`;
  });
  return {
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    disabled: btn.disabled,
    pointerEvents: getComputedStyle(btn).pointerEvents,
    stack,
    bodyOverflow: getComputedStyle(document.body).overflow,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.locator('[data-demo-id="demo-op-step1-check"]').click({ timeout: 5000 }).then(
  () => console.log("click ok"),
  (e) => console.log("click err:", e.message.split("\n").slice(0, 4).join(" | ")),
);
await page.waitForTimeout(1500);
console.log("after step:", await page.evaluate(() => document.querySelector("[data-demo-id='demo-guide-card']")?.getAttribute("data-demo-id") ?? "?"));
await browser.close();
