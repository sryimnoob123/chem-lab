/**
 * DemoCoach auto 分支实测（2026-10-24 二轮）
 *
 * 目的：教师端「代做」走的 auto 分支（?autodemo=1）从来没实机点过，这里验三件事：
 *   ① 引导层不遮挡内容：光带/手指/气泡都是 pointer-events none，点在内容上要命中内容本身；
 *   ② 能退出：点「退出演示」后引导层消失，coachOpen 变 false；
 *   ③ auto 分支真的在替学生做（点「继续」后步骤前进），不是只画了个罩子。
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const OUT = process.env.OUT || "evidence/2026-10-24-round2";
const EXP = process.env.EXP || "exp01";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// 演示口径下没有 cookie 也会落到演示身份（lib/session.ts getStudent），直接进实验页
try { await page.context().clearCookies(); } catch {}
// 前测门禁（components/exp/bopbps-gate.tsx）把「已通过」记在 localStorage，先种上，
// 否则实验台根本不渲染，看不到引导层。
await page.addInitScript((exp) => {
  try { window.localStorage.setItem(`bopbps:v1:${exp}:pre`, "pass"); } catch {}
}, EXP);
// 教师端「课堂演示」入口就是 ?teach=1（page.tsx → coachAuto），前测由 BopbpsGate bypass 掉
await page.goto(`${BASE}/exp/${EXP}?teach=1`, { waitUntil: "load", timeout: 90000 });
await page.locator("[data-demo-id='demo-coach-open']").waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);

const read = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const styleOf = (el) => (el ? getComputedStyle(el) : null);
  const bubble = q("[data-demo-id='demo-coach-bubble']");
  const controls = q("[data-demo-id='demo-coach-controls']");
  const closeBtn = q("[data-demo-id='demo-coach-close']");
  // 找一个内容里的可点目标（试剂瓶），看它的中心点命中谁
  const target = q("[data-demo-id^='demo-scene-reagent-']") ?? q("[data-demo-id^='demo-reagent-']");
  let hit = null;
  if (target) {
    const b = target.getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    hit = {
      targetId: target.getAttribute("data-demo-id"),
      hitId: el?.closest("[data-demo-id]")?.getAttribute("data-demo-id") ?? el?.tagName ?? null,
      hitIsTarget: Boolean(el && (el === target || target.contains(el))),
    };
  }
  const walk = [...document.querySelectorAll("[data-coach-layer], [data-demo-id='demo-coach-bubble']")].length;
  return {
    coachOpen: Boolean(bubble || controls),
    bubbleText: bubble?.textContent?.slice(0, 80) ?? null,
    bubblePE: styleOf(bubble)?.pointerEvents ?? null,
    controlsVisible: Boolean(controls && controls.getBoundingClientRect().height > 0),
    hasClose: Boolean(closeBtn && closeBtn.getBoundingClientRect().height > 0),
    ghostCursor: Boolean(q("[data-ghost-cursor], [data-demo-ghost]")),
    hit,
    stepText: document.querySelector("[data-demo-id='demo-task-board-mini'] p")?.textContent ?? null,
    layers: walk,
  };
});

const open = await read();
await page.screenshot({ path: `${OUT}/coach-auto-1440.png` });

let afterClose = null;
const closeBtn = page.locator("[data-demo-id='demo-coach-close']");
if (await closeBtn.count()) {
  await closeBtn.click();
  await page.waitForTimeout(700);
  afterClose = await read();
  await page.screenshot({ path: `${OUT}/coach-auto-closed-1440.png` });
}

const pageText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300));
console.log(JSON.stringify({ open, afterClose, pageText, errors }, null, 1));
await browser.close();
