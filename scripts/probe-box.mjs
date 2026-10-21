/**
 * 探测画面里的元素：给几个坐标，打印命中的 DOM 元素与它的边框/背景。
 * 用法：node scripts/probe-box.mjs exp01
 */
import { chromium } from "@playwright/test";
import { dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await dismissOnboarding(page, { waitMs: 900 });

const points = [
  [320, 360],
  [700, 360],
  [1090, 610],
  [700, 615],
  [1060, 500],
];

const hits = await page.evaluate((pts) => {
  return pts.map(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return { x, y, none: true };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      x,
      y,
      tag: el.tagName,
      cls: typeof el.className === "string" ? el.className.slice(0, 60) : el.getAttribute("class") ?? "",
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      bg: cs.backgroundColor,
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    };
  });
}, points);

console.log(JSON.stringify(hits, null, 2));
await browser.close();
