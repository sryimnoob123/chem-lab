
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const OUT = process.env.OUT || "evidence/2026-10-24-round2";
const VPS = [["1440", 1440, 900], ["1152", 1152, 900], ["1024", 1024, 768], ["390", 390, 844]];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const out = [];

const probe = () => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { top: Math.round(b.top + scrollY), h: Math.round(b.height), w: Math.round(b.width),
             bottom: Math.round(b.bottom + scrollY), scrollH: el.scrollHeight, clientH: el.clientHeight };
  };
  const tabs = [...document.querySelectorAll("[data-demo-id^='demo-scenario-']")]
    .filter((n) => n.getAttribute("data-demo-id") !== "demo-scenario-verdict")
    .map((n) => { const b = n.getBoundingClientRect(); const cs = getComputedStyle(n);
      return { id: n.getAttribute("data-demo-id"), w: Math.round(b.width), h: Math.round(b.height),
               left: cs.borderLeftColor, pressed: n.getAttribute("aria-pressed"), bg: cs.backgroundColor }; });
  return {
    viewportH: innerHeight,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    docH: document.documentElement.scrollHeight,
    cols: r("[class*='cols']"), library: r("[class*='groups']"), planList: r("[class*='planList']"),
    params: r("[class*='params']"), theater: r("[data-demo-id='demo-result-theater']"),
    tabs, sticky: [...document.querySelectorAll("[class*='groupHead']")].map((n) => getComputedStyle(n).position),
  };
};

for (const [label, width, height] of VPS) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.locator("[data-demo-id='demo-login-submit']").click();
  await page.waitForURL("**/experiments", { timeout: 20000 }).catch(() => {});
  await page.goto(BASE + "/plan", { waitUntil: "networkidle" });
  if (!(await page.locator("[data-demo-id='demo-plan-start']").count())) {
    await page.locator("[data-demo-id^='demo-topic-topic-']").first().click();
    await page.waitForTimeout(400);
  }
  await page.locator("[data-demo-id='demo-plan-start']").click();
  await page.waitForTimeout(900);

  const empty = await page.evaluate(probe);
  await page.screenshot({ path: `${OUT}/plan-${label}.png` });

  // 满载：载入参考方案（21 项）
  await page.locator("[data-demo-id='demo-design-reference']").click();
  await page.waitForTimeout(600);
  const loaded = await page.evaluate(probe);
  await page.screenshot({ path: `${OUT}/plan-${label}-loaded.png` });

  // 剧场：点「危险」，看选中态
  await page.locator("[data-demo-id='demo-scenario-danger']").click();
  await page.waitForTimeout(700);
  const tone = await page.evaluate(() => {
    const n = document.querySelector("[data-demo-id='demo-scenario-danger']");
    const cs = getComputedStyle(n);
    const b = n.getBoundingClientRect();
    return { pressed: n.getAttribute("aria-pressed"), dataActive: n.getAttribute("data-active"),
             bg: cs.backgroundColor, border: cs.borderTopColor, color: cs.color, w: Math.round(b.width) };
  });
  await page.screenshot({ path: `${OUT}/plan-${label}-theater.png` });
  out.push({ label, width, height, empty, loaded, tone, errors });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
