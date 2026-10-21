/**
 * 截 exp09 第 2 步（配 500 mL 溶液）的场景，专门验"不落回 exp01 默认台"的回归。
 * 用法：node scripts/shot-exp09-step2.mjs
 */
import { chromium } from "@playwright/test";
import { clickOpById, dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const TAG = process.env.REDTEAM_TAG ?? "r5";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });
await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await dismissOnboarding(page, { waitMs: 1000 });

const readStep = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? Number(m[1]) : null;
  });

// 把第 1 步做完，直到步骤变成 2
const step1Ops = [
  "demo-op-step1-wear",
  "demo-op-step1-glove",
  "demo-op-step1-check",
  "demo-op-step1-weigh",
  "demo-op-step1-dissolve",
  "demo-op-step1-transfer",
  "demo-op-step1-rinse",
  "demo-op-step1-dilute",
  "demo-op-step1-mix",
  "demo-op-step1-label",
];
for (const op of step1Ops) {
  if ((await readStep()) === 2) break;
  await clickOpById(page, op, { timeout: 2500 });
  await page.waitForTimeout(900);
}

await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const svg = document.querySelector("[class*='benchReuse'] svg");
  const svgBox = svg ? svg.getBoundingClientRect() : null;
  const vessels = [...document.querySelectorAll("[data-demo-id^='demo-scene-vessel']")].map((el) => {
    const b = el.getBoundingClientRect();
    return {
      id: el.getAttribute("data-demo-id"),
      x: Math.round(b.left),
      w: Math.round(b.width),
      offscreen: b.right < 0 || b.left > window.innerWidth,
    };
  });
  return {
    step: (document.body.innerText.match(/第\s*0?(\d+)\s*步/) ?? [])[1],
    svg: svgBox ? { x: Math.round(svgBox.left), w: Math.round(svgBox.width) } : null,
    hasBalance: Boolean(document.querySelector("[data-demo-id='demo-scene-instrument-balance']")),
    vesselCount: vessels.length,
    offscreenVessels: vessels.filter((v) => v.offscreen),
    beakerLabel: [...document.querySelectorAll("text")].map((t) => t.textContent?.trim()).filter((t) => t && t.length < 18).slice(0, 10),
  };
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: `public/shots-prod/redteam/${TAG}-exp09-step2.png` });
await browser.close();
