/**
 * 场景缩放诊断：量 SVG 实际渲染尺寸、容器尺寸、铭牌字号。
 * 用法：node scripts/diag-scene.mjs exp01
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

const info = await page.evaluate(() => {
  const pick = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.left),
      y: Math.round(r.top),
      maxHeight: cs.maxHeight,
      cssHeight: cs.height,
      cssWidth: cs.width,
    };
  };
  const out = {};
  out.stage = pick(document.querySelector("[class*='apparatusWrap']"));
  out.wrap = pick(document.querySelector("[data-bench]"));
  out.benchReuse = pick(document.querySelector("[class*='benchReuse']"));
  const svg = document.querySelector("[class*='benchReuse'] svg");
  out.svg = pick(svg);
  if (svg) {
    out.viewBox = svg.getAttribute("viewBox");
    out.preserve = svg.getAttribute("preserveAspectRatio");
    out.svgStyle = { width: getComputedStyle(svg).width, height: getComputedStyle(svg).height };
    const texts = [...svg.querySelectorAll("text")];
    out.texts = texts.slice(0, 4).map((t) => {
      const tr = t.getBoundingClientRect();
      return {
        content: (t.textContent ?? "").trim().slice(0, 16),
        fontSize: getComputedStyle(t).fontSize,
        renderedH: Math.round(tr.height * 100) / 100,
      };
    });
    const benchLine = svg.querySelector("line[y1='340']");
    if (benchLine) out.benchLineWidth = Math.round(benchLine.getBoundingClientRect().width);
  }
  return out;
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: `public/shots-prod/fix-scene/diag-${expId}.png` });
await browser.close();
