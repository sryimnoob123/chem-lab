/**
 * 第四轮 · 互动细节走查（交付四）
 *   1) 可跳过：动作播放中点「跳过动作」，测到终态的耗时 + 状态是否推进
 *   2) 拖动期间不动画：拖器皿 / 拖试剂瓶的移动过程中，动作层与 WAAPI 动画必须为 0
 *   3) 命中区：390 / 1024 / 1440 下天平、器皿、底部控件带的可点尺寸
 *   4) 错误演示 4 条：点右侧卡片每一条，是否播事故、是否回写文案（不改实验状态）
 *   5) 提示阶梯 H0~H4：连点提示按钮，看等级是否逐级上升
 *
 * 用法：node scripts/round4-interaction.mjs [--base http://127.0.0.1:3000]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const argOf = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;
const BASE = (argOf("--base", process.env.BASE ?? "http://127.0.0.1:3000")).replace(/\/$/, "");
const OUT = path.resolve(argOf("--out", "evidence/2026-10-24-round4-anim"));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const report = { skip: null, dragSuppress: null, hitAreas: [], incidents: [], hints: [], errors: [] };

async function openPage(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.errors.push(String(e.message).slice(0, 160)));
  await page.goto(`${BASE}/api/session`).catch(() => null);
  await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector('[data-demo-id="demo-scene-vessel-volumetric"]', { timeout: 90000 });
  await sleep(1600);
  return { ctx, page };
}

/** 等台面彻底安静（动作层/倾倒层卸载、WAAPI 无 running）—— 否则「拖动期间」会混进上一条动作 */
async function waitQuiet(page, timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const busy = await page.evaluate(() => ({
      n: document.querySelectorAll("[data-action-layer],[data-bench-pour]").length,
      run: (document.getAnimations?.() ?? []).filter((a) => a.playState === "running").length,
    }));
    if (busy.n === 0 && busy.run === 0) return true;
    await sleep(150);
  }
  return false;
}

async function drag(page, fromSel, toSel, midHook) {
  const a = await page.locator(fromSel).first().boundingBox();
  const b = await page.locator(toSel).first().boundingBox();
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2;
  const ex = b.x + b.width / 2, ey = b.y + b.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(sx + ((ex - sx) * i) / 12, sy + ((ey - sy) * i) / 12, { steps: 2 });
    await sleep(20);
    if (i === 6 && midHook) await midHook();
  }
  await sleep(60);
  await page.mouse.up();
}

/* ---------------------------------------------------------------- 1) 可跳过 */
{
  const { ctx, page } = await openPage(1440, 900);
  await drag(page, '[data-demo-id="demo-scene-vessel-volumetric"]', '[data-demo-id="demo-scene-sink"]');
  await sleep(600); // 已经进入洗涤本体
  const before = await page.evaluate(() => ({
    skip: Boolean(document.querySelector('[data-demo-id="demo-action-skip"]')),
    step: Number(/第\s*0*(\d+)\s*步/.exec(document.body.innerText)?.[1] ?? 0),
  }));
  const t0 = Date.now();
  await page.locator('[data-demo-id="demo-action-skip"]').first().click({ timeout: 3000 }).catch(() => undefined);
  let tEnd = null;
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(() => document.querySelectorAll("[data-action-layer],[data-bench-pour]").length);
    if (n === 0) { tEnd = Date.now(); break; }
    await sleep(25);
  }
  await sleep(500);
  const after = await page.evaluate(() => ({
    skip: Boolean(document.querySelector('[data-demo-id="demo-action-skip"]')),
    step: Number(/第\s*0*(\d+)\s*步/.exec(document.body.innerText)?.[1] ?? 0),
    body: document.body.innerText.slice(0, 1200),
  }));
  report.skip = {
    skipButtonPresent: before.skip,
    stepBefore: before.step,
    stepAfter: after.step,
    skipGoneMs: tEnd ? tEnd - t0 : null,
    skippedToNextStep: after.step > before.step,
    noteAfter: /已倒置晾干|冲洗完成|洗涤完成/.test(after.body),
  };
  await ctx.close();
}

/* ---------------------------------------------------------------- 2) 拖动期间不动画 */
{
  const { ctx, page } = await openPage(1440, 900);
  const probe = () =>
    page.evaluate(() => ({
      action: document.querySelectorAll("[data-action-layer]").length,
      pour: document.querySelectorAll("[data-bench-pour]").length,
      running: (document.getAnimations?.() ?? []).filter((a) => a.playState === "running").length,
      actionAnims: (document.getAnimations?.() ?? []).filter(
        (a) => a.playState === "running" && a.effect?.target?.closest?.("[data-action-layer],[data-bench-pour]"),
      ).length,
    }));
  await waitQuiet(page);
  const duringVessel = [];
  await drag(page, '[data-demo-id="demo-scene-vessel-volumetric"]', '[data-demo-id="demo-scene-sink"]', async () => {
    duringVessel.push(await probe());
  });
  // 松开后动作才开始播；先让它播完再测下一段拖动
  await waitQuiet(page);
  const duringReagent = [];
  await drag(page, '[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-volumetric"]', async () => {
    duringReagent.push(await probe());
  });
  await waitQuiet(page);
  // 拖动试剂瓶的「移动中」：再拖一次，只按不放、移动到位前采样
  const a = await page.locator('[data-demo-id="demo-scene-reagent-water"]').first().boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(a.x + 30 * i, a.y + 20 * i, { steps: 2 }); await sleep(30); }
  const moving = await probe();
  await page.mouse.up();
  report.dragSuppress = {
    duringVesselDrag: duringVessel,
    duringReagentDrag: duringReagent,
    reagentMovingNoAction: moving,
    ok:
      duringVessel.every((x) => x.action === 0 && x.actionAnims === 0) &&
      duringReagent.every((x) => x.action === 0 && x.actionAnims === 0) &&
      moving.action === 0 && moving.pour === 0,
  };
  await ctx.close();
}

/* ---------------------------------------------------------------- 3) 命中区 */
for (const vp of [[1440, 900], [1024, 768], [390, 844]]) {
  const touch = vp[0] <= 560 ? { hasTouch: true, isMobile: true } : {};
  const { ctx, page } = await openPage(vp[0], vp[1], touch);
  const hit = await page.evaluate(() => {
    const balance = document.querySelector("[data-balance-hit]")?.getBoundingClientRect();
    const chips = [...document.querySelectorAll('[data-demo-id^="demo-dock-"]')].map((el) => {
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    });
    const vessels = [...document.querySelectorAll("[data-demo-id^='demo-scene-vessel-']")].map((el) => {
      const b = el.getBoundingClientRect();
      return { id: el.getAttribute("data-demo-id"), w: Math.round(b.width), h: Math.round(b.height) };
    });
    const tools = [...document.querySelectorAll("[data-tool-hit], [data-demo-id^='demo-tool-']")].map((el) => {
      const b = el.getBoundingClientRect();
      return { id: el.getAttribute("data-demo-id") ?? "tool", w: Math.round(b.width), h: Math.round(b.height) };
    });
    return {
      balance: balance ? { w: Math.round(balance.width), h: Math.round(balance.height) } : null,
      vessels: vessels.slice(0, 6),
      tools: tools.slice(0, 8),
      chips: chips.slice(0, 14),
      pointerCoarse: matchMedia("(pointer: coarse)").matches,
      dockPresent: Boolean(document.querySelector('[data-demo-id="demo-mobile-dock"]')),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  report.hitAreas.push({ viewport: vp.join("x"), ...hit });
  await ctx.close();
}

/* ---------------------------------------------------------------- 4) 错误演示 4 条 */
{
  const { ctx, page } = await openPage(1440, 900);
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('[data-demo-id^="demo-trap-"]')]
      .filter((el) => el.getAttribute("data-demo-id") !== "demo-trap-panel")
      .map((el) => ({
        id: el.getAttribute("data-demo-id"),
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
      })),
  );
  for (const card of cards.slice(0, 4)) {
    const before = await page.evaluate(() => ({
      step: Number(/第\s*0*(\d+)\s*步/.exec(document.body.innerText)?.[1] ?? 0),
      incidents: document.querySelectorAll("[data-incident-banner],[data-demo-id='demo-incident-banner']").length,
    }));
    await page.locator(`[data-demo-id="${card.id}"]`).first().click({ timeout: 5000 }).catch(() => undefined);
    let sawAnim = false;
    let sawBanner = false;
    for (let i = 0; i < 60; i++) {
      const s = await page.evaluate(() => ({
        layer: document.querySelectorAll("[data-action-layer],svg [data-a='fx'], [data-fx-key]").length,
        banner: Boolean(document.querySelector('[data-demo-id="demo-trap-incident"]')) || /事故|扣分|违规|作废/.test(document.body.innerText),
      }));
      if (s.layer > 0) sawAnim = true;
      if (s.banner) sawBanner = true;
      if (sawAnim && sawBanner) break;
      await sleep(120);
    }
    await sleep(400);
    const after = await page.evaluate(() => ({
      step: Number(/第\s*0*(\d+)\s*步/.exec(document.body.innerText)?.[1] ?? 0),
      text: document.body.innerText.replace(/\s+/g, " ").slice(0, 220),
    }));
    report.incidents.push({
      id: card.id,
      text: card.text,
      playedAnimation: sawAnim,
      showedConsequence: sawBanner,
      stepBefore: before.step,
      stepAfter: after.step,
      stateUnchanged: before.step === after.step,
    });
    await sleep(1200);
  }
  await ctx.close();
}

/* ---------------------------------------------------------------- 5) 提示阶梯 H0~H4 */
{
  const { ctx, page } = await openPage(1440, 900);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    await page.locator('[data-demo-id="demo-hint-button"]').first().click({ timeout: 4000 }).catch(() => undefined);
    await sleep(650);
    const s = await page.evaluate(() => {
      const text = document.body.innerText;
      const m = /提示\s*(\d)\s*\/\s*(\d)/.exec(text);
      const hint = /H\s*([0-4])/.exec(text);
      const bubble = [...document.querySelectorAll("[data-demo-id*='hint'], [class*='hint']")]
        .map((el) => (el.textContent ?? "").trim())
        .filter((t) => t.length > 6 && t.length < 120)
        .slice(0, 2);
      return { counter: m ? `${m[1]}/${m[2]}` : null, level: hint ? hint[1] : null, bubble };
    });
    seen.push(s);
  }
  report.hints = seen;
  await ctx.close();
}

fs.writeFileSync(`${OUT}/interaction.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2).slice(0, 4000));
await browser.close();
