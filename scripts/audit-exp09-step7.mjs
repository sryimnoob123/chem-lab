/**
 * 走到 exp09 第 7 步，抓"引导弹窗 + 箭头 + 建议动作"的真实文案，并截图。
 * 用法：node scripts/audit-exp09-step7.mjs
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
await loginStudent(page, { base: BASE });

await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
// 关掉新手教学弹窗（它会挡住建议卡）
for (const sel of ["[data-demo-id='demo-onboarding-skip']", "button:has-text('跳过，直接开始')", "[class*='onboarding'] button[class*='close']"]) {
  const el = page.locator(sel);
  if (await el.count()) {
    await el.first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
    break;
  }
}
await page.waitForTimeout(500);
// 切到点选模式，稳定点建议卡
const clickMode = page.locator("[data-demo-id='demo-input-click']");
if (await clickMode.count()) {
  await clickMode.first().click().catch(() => undefined);
  await page.waitForTimeout(400);
}

const trace = [];
for (let i = 0; i < 30; i++) {
  const snap = await page.evaluate(() => {
    const body = document.body.innerText.replace(/\s+/g, " ");
    const stepM = body.match(/第\s*(\d+)\s*\/\s*(\d+)\s*步/);
    const next = document.querySelector("[data-guide='next']");
    const nameEl = next?.querySelector("[class*='nextName']");
    const whyEl = next?.querySelector("[class*='nextWhy']");
    const arrows = [...document.querySelectorAll("[class*='arrow'], [data-guide-arrow], [class*='pointer']")]
      .filter((n) => n.getBoundingClientRect().width > 0)
      .map((n) => ({ cls: String(n.className ?? "").slice(0, 40), text: (n.textContent ?? "").trim().slice(0, 30) }));
    return {
      step: stepM ? Number(stepM[1]) : null,
      total: stepM ? Number(stepM[2]) : null,
      cardName: nameEl ? (nameEl.textContent ?? "").trim() : null,
      cardWhy: whyEl ? (whyEl.textContent ?? "").trim() : null,
      nextDemoId: next?.getAttribute("data-demo-id") ?? null,
      arrows,
      hasCard: !!document.querySelector("[data-demo-id='demo-guide-card']"),
      bodyHasFlask: /拖到锥形瓶|把试剂拖到/.test(body),
    };
  });
  trace.push(snap);
  if (snap.step !== null && snap.step >= (snap.total ?? 7)) break;
  const btn = page.locator("[data-guide='next']");
  if (!(await btn.count())) break;
  await btn.first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

const final = await page.evaluate(() => {
  const body = document.body.innerText.replace(/\s+/g, " ");
  const card = document.querySelector("[data-demo-id='demo-guide-card']");
  const next = document.querySelector("[data-guide='next']");
  return {
    step: (body.match(/第\s*(\d+)\s*\/\s*(\d+)\s*步/) ?? [])[1] ?? null,
    cardName: next?.querySelector("[class*='nextName']")?.textContent?.trim() ?? null,
    cardWhy: next?.querySelector("[class*='nextWhy']")?.textContent?.trim() ?? null,
    nextDemoId: next?.getAttribute("data-demo-id") ?? null,
    hasCard: !!card,
    bodyHasFlask: /拖到锥形瓶|把试剂拖到/.test(body),
    actions: [...document.querySelectorAll("[data-demo-id^='demo-op-']")].map((n) => n.getAttribute("data-demo-id")),
  };
});

await page.screenshot({ path: "public/shots-prod/redteam/exp09-step7.png", fullPage: false });
// 第 7 步的真实场景：看板上写了什么、指导卡指向哪
const scene = await page.evaluate(() => {
  const txt = (sel) => (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const bench = document.querySelector("[class*='benchReuse']");
  const svg = bench?.querySelector("svg");
  const svgLabels = svg ? [...svg.querySelectorAll("text")].map((t) => (t.textContent ?? "").trim()).filter(Boolean).slice(0, 14) : [];
  return {
    boardHint: txt("[class*='boardHint'], [class*='missionBoard'] p"),
    boardBody: txt("[class*='missionBoard']"),
    resultLine: txt("[class*='resultLine']"),
    dockHint: txt("[class*='dockHint'], [class*='statusBar']"),
    benchSvgTexts: svgLabels,
    hasOnboarding: !!document.querySelector("[class*='onboarding'], [class*='backdrop'] [class*='dialog']"),
    onboardingText: txt("[class*='onboarding']"),
    otherActions: [...document.querySelectorAll("[data-demo-id^='demo-op-']")].map((n) => ({
      id: n.getAttribute("data-demo-id"),
      label: (n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 34),
    })),
  };
});
console.log(JSON.stringify({ trace, final, scene, errors }, null, 2));
// 第 7 步点亮：连点建议卡，看数据台逐块填充
const lit = [];
for (let i = 0; i < 3; i++) {
  const btn = page.locator("[data-guide='next']");
  if (!(await btn.count())) break;
  await btn.first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(1300);
  const s = await page.evaluate(() => {
    const b = document.querySelector("[data-demo-id='demo-compute-bench']");
    const body = document.body.innerText.replace(/\s+/g, " ");
    return {
      bench: b ? (b.textContent ?? "").replace(/\s+/g, " ").slice(0, 240) : null,
      step: (body.match(/第\s*(\d+)\s*\/\s*(\d+)\s*步/) ?? [])[1] ?? null,
      done: /实验完成|交卷/.test(body),
    };
  });
  lit.push(s);
  if (s.done) break;
}
console.log(JSON.stringify({ lit }, null, 2));
await page.screenshot({ path: "public/shots-prod/redteam/exp09-step7-lit.png" });
await browser.close();
