/**
 * 字号 / 命中区实测（D1 / D5 的证据脚本）
 *
 * 量三件事：
 *   1. 器皿名、工具标签、任务卡正文字号在 1920×1080 / 1440×900 / 1024×768 下到底多少 px（D1 投影可读性）；
 *   2. 390×844 移动端：天平整台热区、每只器皿热区、工具按钮的命中尺寸（D5 硬线 44px）；
 *   3. 有没有横向溢出（scrollWidth > clientWidth）。
 *
 * 用法：BASE_URL=http://localhost:3001 node scripts/ui-metrics.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const URL = BASE + "/exp/exp01?force=1";

const DESKTOPS = [
  { w: 1920, h: 1080, label: "1920x1080（投影）" },
  { w: 1440, h: 900, label: "1440x900" },
  { w: 1024, h: 768, label: "1024x768" },
];
const MOBILE = { w: 390, h: 844, label: "390x844" };

const browser = await chromium.launch();

async function open(viewport, dpr = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      Boolean(document.querySelector("[data-demo-id='demo-scene-instrument-balance']")) &&
      Boolean(document.querySelector("[data-demo-id='demo-finish']")),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(600);
  return { ctx, page };
}

const out = [];

for (const vp of DESKTOPS) {
  const { ctx, page } = await open({ width: vp.w, height: vp.h });
  const m = await page.evaluate(() => {
    const fs = (el) => (el ? Number.parseFloat(getComputedStyle(el).fontSize) : null);
    const label = document.querySelector("text[class*='vesselName']");
    const toolLabel = document.querySelector("text[class*='toolLabel']");
    const taskBody =
      document.querySelector("[data-demo-id='demo-step-title']") ??
      document.querySelector("[data-demo-id='demo-task'] h2") ??
      document.querySelector("[data-demo-id='demo-task']");
    return {
      vesselLabel: label?.textContent ?? null,
      vesselLabelPx: fs(label),
      toolLabel: toolLabel?.textContent ?? null,
      toolLabelPx: fs(toolLabel),
      taskBodyPx: fs(taskBody),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  out.push({ viewport: vp.label, ...m });
  await ctx.close();
}

{
  const { ctx, page } = await open({ width: MOBILE.w, height: MOBILE.h }, 2);
  const m = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    };
    const balanceHit = document.querySelector("[data-balance-hit]");
    let balanceBox = null;
    if (balanceHit) {
      const r = balanceHit.getBoundingClientRect();
      balanceBox = { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    }
    const vessels = [...document.querySelectorAll("[data-demo-id^='demo-scene-vessel-']")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-demo-id"),
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
      };
    });
    const tools = [...document.querySelectorAll("[data-tool-id]")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-tool-id"),
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
      };
    });
    return {
      balanceBox,
      vessels,
      tools,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  out.push({ viewport: MOBILE.label, ...m });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
