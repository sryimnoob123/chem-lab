/**
 * 第 7 步浮层枚举：找出页面上所有 fixed/absolute 且像弹窗的块，输出文案与定位。
 * 用法：node scripts/audit-exp09-overlays.mjs
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });

await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const skip = page.locator("button:has-text('跳过，直接开始')");
if (await skip.count()) {
  await skip.first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(900);
}
const clickMode = page.locator("[data-demo-id='demo-input-click']");
if (await clickMode.count()) {
  await clickMode.first().click({ force: true }).catch(() => undefined);
}

for (let i = 0; i < 30; i++) {
  const st = await page.evaluate(() => {
    const m = (document.body.innerText.match(/第\s*(\d+)\s*\/\s*(\d+)\s*步/) ?? []);
    return { step: m[1] ? Number(m[1]) : null, total: m[2] ? Number(m[2]) : null };
  });
  if (st.step !== null && st.step >= (st.total ?? 7)) break;
  const btn = page.locator("[data-guide='next']");
  if (!(await btn.count())) break;
  await btn.first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(1400);
}

const overlays = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "absolute") continue;
    const b = el.getBoundingClientRect();
    if (b.width < 120 || b.height < 60) continue;
    if (b.width * b.height < 8000) continue;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className ?? "").slice(0, 46),
      demoId: el.getAttribute("data-demo-id"),
      pos: cs.position,
      z: cs.zIndex,
      box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
      text: text.slice(0, 110),
      aria: el.getAttribute("aria-label"),
    });
  }
  // 去重（同文案同位置只留一个）
  const seen = new Set();
  return out.filter((o) => {
    const k = `${o.box.join(",")}|${o.text.slice(0, 30)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
});
console.log(JSON.stringify({ overlays }, null, 2));
await browser.close();
