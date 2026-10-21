/**
 * 1920×1080（投影口径）逐页截图，用于红队对抗式自查。
 * 用法：node scripts/shot-1920.mjs [exp01]
 * 输出：public/shots-prod/redteam/
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { clickOpById, dismissOnboarding, loginStudent, waitForFeedback } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";
const OUT = path.join(process.cwd(), "public/shots-prod/redteam");
const TAG = process.env.REDTEAM_TAG ?? "before";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

async function shot(name) {
  const file = path.join(OUT, `${TAG}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

// 1) 登录 + 列表页
await loginStudent(page, { base: BASE });
await page.waitForTimeout(900);
await shot("01-catalog");

// 2) 进实验
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await dismissOnboarding(page, { waitMs: 1200 });
await shot("02-exp-initial");

// 3) 量一下台面与器皿的实际尺寸
const metrics = await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top) };
  };
  const svg = document.querySelector("[class*='benchReuse'] svg") ?? document.querySelector("svg");
  const vesselBox = (() => {
    if (!svg) return null;
    const gs = [...svg.querySelectorAll("g")].filter((g) => g.querySelector("path,rect,ellipse"));
    if (!gs.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const g of gs) {
      const b = g.getBoundingClientRect();
      if (b.width < 4 || b.height < 4) continue;
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.right);
      maxY = Math.max(maxY, b.bottom);
    }
    if (!Number.isFinite(minX)) return null;
    return { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
  })();
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    stage: r("[class*='apparatusWrap']"),
    benchReuse: r("[class*='benchReuse']"),
    svg: r("[class*='benchReuse'] svg"),
    vesselBox,
    feedback: r("[class*='feedback']"),
    feedbackColor: (() => {
      const el = document.querySelector("[data-demo-id^='demo-feedback']");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color, text: (el.textContent ?? "").slice(0, 40) };
    })(),
  };
});

// 4) 做一步操作，截反馈条
const firstOps = ["demo-op-step1-check", "demo-op-step1-wash", "demo-op-step1-dry"];
for (const op of firstOps) {
  const ok = await clickOpById(page, op, { timeout: 3500 });
  if (ok) {
    await waitForFeedback(page, "ok", { timeout: 5000 });
    await page.waitForTimeout(700);
    break;
  }
}
await shot("03-exp-step1-feedback");

const after = await page.evaluate(() => {
  const el = document.querySelector("[data-demo-id^='demo-feedback']");
  if (!el) return null;
  const cs = getComputedStyle(el);
  // 找它内部文字的实际颜色
  const txt = el.querySelector("strong, span, p") ?? el;
  return {
    boxBg: cs.backgroundColor,
    boxText: cs.color,
    innerColor: getComputedStyle(txt).color,
    text: (el.textContent ?? "").replace(/\s+/g, " ").slice(0, 60),
  };
});

console.log(JSON.stringify({ metrics, afterFeedback: after, errors }, null, 2));
await browser.close();
