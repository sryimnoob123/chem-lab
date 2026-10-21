/**
 * 第 2 轮红队：把四件事全用 DOM 量出来，不靠肉眼。
 * 1) 报告页总分与文案
 * 2) 工作台的三个步骤口径（顶栏 / 卡片 / 副标题）
 * 3) exp09 第 2 步器皿集 + exp01 标签是否重叠
 * 4) 右侧模式按钮热区尺寸
 *
 * 用法：node scripts/redteam-audit2.mjs
 */
import { chromium } from "@playwright/test";
import { clickOpById, dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });

const out = {};

// ---------- 1) 工作台 exp01 ----------
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await dismissOnboarding(page, { waitMs: 900 });

out.exp01 = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent ?? "").replace(/\s+/g, " ").trim() : null);
  // 顶栏步骤
  const topStep = (document.body.innerText.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/) ?? [null, null, null]).slice(1);
  // 卡片步骤（看板里的 "第 1 / 4 步" 这种）
  const cardStepMatch = document.body.innerText.match(/第\s*(\d+)\s*\/\s*(\d+)\s*步/);
  // 看板副标题 / 提示行
  const board = document.querySelector("[class*='missionBoard'], [class*='board']");
  // 右侧模式按钮热区
  const modeBtns = [...document.querySelectorAll("[data-demo-id^='demo-mode'], [class*='modeBtn'], [class*='mode']")]
    .map((el) => {
      const b = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-demo-id"),
        text: (el.textContent ?? "").trim().slice(0, 6),
        w: Math.round(b.width),
        h: Math.round(b.height),
      };
    })
    .filter((x) => x.w > 0 && x.h > 0 && x.w < 200);

  // 器皿标签重叠：同名器皿的 name / contents 文本相交
  const svg = document.querySelector("[class*='benchReuse'] svg");
  const overlaps = [];
  if (svg) {
    const texts = [...svg.querySelectorAll("text")];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].getBoundingClientRect();
        const b = texts[j].getBoundingClientRect();
        const inter = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (inter > 2 && Math.abs(a.left - b.left) < 60) {
          overlaps.push({
            a: texts[i].textContent?.trim().slice(0, 14),
            b: texts[j].textContent?.trim().slice(0, 14),
            overlapPx: Math.round(inter),
          });
        }
      }
    }
  }

  return {
    topStep,
    cardStep: cardStepMatch ? [cardStepMatch[1], cardStepMatch[2]] : null,
    boardText: txt(board)?.slice(0, 60) ?? null,
    modeBtns,
    labelOverlaps: overlaps.slice(0, 6),
  };
});

// ---------- 2) exp09 第 2 步 ----------
await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await dismissOnboarding(page, { waitMs: 800 });

const readStep = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/第\s*0?(\d+)\s*步/);
    return m ? Number(m[1]) : null;
  });

for (const op of [
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
]) {
  if ((await readStep()) === 2) break;
  await clickOpById(page, op, { timeout: 2200 });
  await page.waitForTimeout(800);
}

out.exp09Step2 = await page.evaluate(() => {
  const vessels = [...document.querySelectorAll("[data-demo-id^='demo-scene-vessel']")].map((el) => ({
    id: el.getAttribute("data-demo-id"),
  }));
  const svg = document.querySelector("[class*='benchReuse'] svg");
  const texts = svg ? [...svg.querySelectorAll("text")].map((t) => t.textContent?.trim().slice(0, 14)) : [];
  const bb = svg ? svg.getBoundingClientRect() : null;
  return {
    step: (document.body.innerText.match(/第\s*0?(\d+)\s*步/) ?? [])[1],
    vesselIds: vessels.map((v) => v.id),
    hasBalance: Boolean(document.querySelector("[data-demo-id='demo-scene-instrument-balance']")),
    hasPhMeter: Boolean(document.querySelector("[data-demo-id='demo-scene-instrument-ph']")),
    benchTexts: texts.filter((t) => t && t.length < 16).slice(0, 12),
    svgBox: bb ? { x: Math.round(bb.left), w: Math.round(bb.width) } : null,
  };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
