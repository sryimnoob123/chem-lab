/**
 * 第 4 轮验收：Dev Dock 热区高度 + exp09 第 7 步引导文案 + 末步自动交卷。
 * 用法：node scripts/audit-round4.mjs
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
await loginStudent(page, { base: BASE });

// ---- 1) Dev Dock 热区 ----
await page.goto(`${BASE}/experiments`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
const toggle = page.locator("[data-dev='dock-toggle']");
if (await toggle.count()) {
  await toggle.first().click().catch(() => undefined);
  await page.waitForTimeout(1200);
}
const hits = await page.evaluate(() => {
  const links = [...document.querySelectorAll("[data-dev='dock-oneclick-demo']")];
  const sizes = links.map((el) => {
    const b = el.getBoundingClientRect();
    return { exp: el.getAttribute("data-exp"), h: Math.round(b.height), w: Math.round(b.width) };
  });
  return {
    count: links.length,
    minHeight: sizes.length ? Math.min(...sizes.map((s) => s.h)) : 0,
    sample: sizes.slice(0, 3),
    allAtLeast32: sizes.every((s) => s.h >= 32),
  };
});

// ---- 2) exp09 一键演示：抓第 7 步引导文案 + 是否自动落报告 ----
const link = page.locator("[data-dev='dock-oneclick-demo'][data-exp='exp09']").first();
const before = { hasLink: await link.count() };
let step7 = null;
let flow = null;
if (before.hasLink) {
  await link.click();
  const t0 = Date.now();
  let captured = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const snap = await page.evaluate(() => {
      const body = document.body.innerText;
      const m = body.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*0?(\d+)\s*步/);
      if (!m) return null;
      // 引导文案：看板进度行 + 建议动作卡
      const progress = body.match(/第\s*\d+\/\d+\s*步\s*·\s*现在该[^\n]{0,12}/);
      const card = document.querySelector("[data-demo-id^='demo-op-']");
      const nextCard = document.querySelector("[data-demo-id='demo-next-action'], [class*='nextAction']");
      return {
        step: Number(m[1]),
        total: Number(m[2]),
        progress: progress ? progress[0] : null,
        firstOp: card ? (card.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) : null,
        nextText: nextCard ? (nextCard.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) : null,
        hasFlaskHint: /把试剂拖到锥形瓶|拖到锥形瓶/.test(body),
      };
    });
    if (!snap) continue;
    if (snap.step >= snap.total && !captured) captured = snap;
  }
  step7 = captured;
  for (let i = 0; i < 20; i++) {
    if (page.url().includes("/report")) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2000);
  flow = await page.evaluate(() => {
    const body = document.body.innerText.replace(/\s+/g, " ");
    return {
      url: location.href,
      total: (body.match(/总分\s*(\d+)\s*\/\s*100/) ?? [])[1] ?? null,
      badge: body.includes("零事故"),
      post: (body.match(/后测（\d+ 题）\s*(\d+)\s*\/\s*100/) ?? [])[1] ?? null,
    };
  });
  flow.reachedReport = page.url().includes("/report");
  flow.seconds = Math.round((Date.now() - t0) / 1000);
}

console.log(JSON.stringify({ hits, exp09: { before, step7, flow }, errors }, null, 2));
await browser.close();
