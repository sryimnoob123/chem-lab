/**
 * 复现「新手引导淡出后整层没卸」：真实点击关闭 → 等 10 秒 → 量 DOM 与命中率。
 * 用法：node scripts/audit-onboarding-unmount.mjs [exp01]
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });

// 清掉"已看过"标记，保证引导会出现
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (/onboard/i.test(k)) localStorage.removeItem(k);
  }
});

await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const before = await page.evaluate(() => {
  const card = document.querySelector("[data-demo-id='demo-onboarding']");
  const backdrop = document.querySelector("[class*='backdrop']");
  const cs = backdrop ? getComputedStyle(backdrop) : null;
  return {
    cardExists: Boolean(card),
    backdropExists: Boolean(backdrop),
    backdropClass: backdrop?.className ?? null,
    backdropStyle: cs
      ? {
          position: cs.position,
          opacity: cs.opacity,
          pointerEvents: cs.pointerEvents,
          visibility: cs.visibility,
          zIndex: cs.zIndex,
          display: cs.display,
        }
      : null,
    backdropRect: backdrop
      ? (() => {
          const b = backdrop.getBoundingClientRect();
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        })()
      : null,
  };
});

// 真实点击关闭（跳过 / 开始 / 关闭）
const closers = [
  "button:has-text('跳过')",
  "button:has-text('开始')",
  "button:has-text('知道了')",
  "[data-demo-id='demo-onboarding-skip']",
  "[data-demo-id='demo-onboarding-start']",
];
let clicked = null;
for (const sel of closers) {
  const el = page.locator(sel).first();
  if (await el.count()) {
    await el.click({ timeout: 3000 }).catch(() => undefined);
    clicked = sel;
    break;
  }
}

// 等 10 秒（用户口径）
await page.waitForTimeout(10_000);

const after = await page.evaluate(() => {
  const card = document.querySelector("[data-demo-id='demo-onboarding']");
  const backdrop = document.querySelector("[class*='backdrop']");
  const cs = backdrop ? getComputedStyle(backdrop) : null;
  // 5 件器皿，每件取中心点
  const targets = [
    "[data-demo-id='demo-scene-vessel-beaker']",
    "[data-demo-id='demo-scene-vessel-volumetric']",
    "[data-demo-id='demo-scene-vessel-tube-a']",
    "[data-demo-id='demo-scene-vessel-tube-b']",
    "[data-demo-id='demo-scene-instrument-balance']",
  ];
  const hits = targets.map((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, exists: false };
    const b = el.getBoundingClientRect();
    const cx = Math.round(b.left + b.width / 2);
    const cy = Math.round(b.top + b.height / 2);
    const top = document.elementFromPoint(cx, cy);
    const hitSelf = Boolean(top && (top === el || el.contains(top) || top.closest(sel)));
    return {
      sel: sel.replace(/\[data-demo-id='|'\]/g, ""),
      exists: true,
      point: [cx, cy],
      topEl: top ? `${top.tagName}.${typeof top.className === "string" ? top.className.slice(0, 28) : ""}` : null,
      hit: hitSelf,
    };
  });
  return {
    cardExists: Boolean(card),
    backdropExists: Boolean(backdrop),
    backdropStyle: cs
      ? {
          position: cs.position,
          opacity: cs.opacity,
          pointerEvents: cs.pointerEvents,
          visibility: cs.visibility,
          zIndex: cs.zIndex,
        }
      : null,
    hits,
    hitRate: `${hits.filter((h) => h.hit).length}/${hits.length}`,
  };
});

console.log(JSON.stringify({ clicked, before, after }, null, 2));
await page.screenshot({ path: "public/shots-prod/redteam/r7-onboarding-after-close.png" });
await browser.close();
