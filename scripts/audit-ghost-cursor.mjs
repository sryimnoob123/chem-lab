/**
 * 一键演示真人化：中途抓光标 / 按下涟漪。
 * 用法：node scripts/audit-ghost-cursor.mjs [exp01]
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
await loginStudent(page, { base: BASE });

await page.goto(`${BASE}/exp/${expId}?force=1&autodemo=1`, { waitUntil: "domcontentloaded" });

const samples = [];
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(120);
  const s = await page.evaluate(() => {
    const el = document.querySelector("[class*='stage'][data-visible]");
    const rect = el ? el.getBoundingClientRect() : null;
    const pressed = el?.getAttribute("data-pressed") === "true";
    const hasRipple = !!document.querySelector("[class*='ripple']");
    return {
      url: location.pathname,
      cursorVisible: el?.getAttribute("data-visible") === "true",
      x: rect ? Math.round(rect.left) : null,
      y: rect ? Math.round(rect.top) : null,
      pressed,
      hasRipple,
    };
  });
  samples.push(s);
  if (s.url.includes("/report")) break;
}
await page.screenshot({ path: `public/shots-prod/redteam/ghost-${expId}.png` });
const visible = samples.filter((s) => s.cursorVisible);
const pressed = samples.filter((s) => s.pressed);
console.log(
  JSON.stringify(
    {
      samples: samples.length,
      cursorVisibleFrames: visible.length,
      pressedFrames: pressed.length,
      movedPositions: [...new Set(visible.map((s) => `${s.x},${s.y}`))].length,
      first: visible[0] ?? null,
      last: visible[visible.length - 1] ?? null,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
