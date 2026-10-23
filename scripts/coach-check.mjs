/**
 * scripts/coach-check.mjs —— 演示模式引导（拖尾光带 + 虚拟手指 + 气泡）实测。
 *
 * 两个入口都要能用（运营口径 2026-10-23）：
 *   1. 学生端 exp01：点「演示」按钮 → 光带 + 指尖 + 气泡出现，指尖真的在动，点「暂停」停住
 *   2. 教师端 /teacher →「课堂演示」→ 落到 exp01?teach=1，引导自动开、且不落库（演示只读）
 *
 * 用法：PLAYWRIGHT_BROWSERS_PATH=… BASE_URL=http://localhost:3001 node scripts/coach-check.mjs
 */

import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const EVID = "evidence/regression";
fs.mkdirSync(EVID, { recursive: true });

const results = [];
const rec = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "[OK]" : "[FAIL]"} ${name} · ${detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror:" + String(e.message).slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text().slice(0, 160));
});

const readCoach = () =>
  page.evaluate(() => {
    const bubble = document.querySelector('[data-demo-id="demo-coach-bubble"]');
    const ribbon = document.querySelector("svg [class*='ribbon']");
    const finger = document.querySelector("[class*='finger']");
    return {
      bubble: Boolean(bubble),
      bubbleText: (bubble?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
      ribbon: Boolean(ribbon),
      finger: Boolean(finger),
      fingerTransform: finger ? getComputedStyle(finger).transform : "",
      controls: Boolean(document.querySelector('[data-demo-id="demo-coach-controls"]')),
    };
  });

/* ---------- 1. 学生端 exp01 ---------- */
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-demo-id="demo-coach-open"]');
await sleep(800);

await page.locator('[data-demo-id="demo-coach-open"]').click();
await sleep(1200);
const first = await readCoach();
rec("exp01 演示：气泡出现", first.bubble && first.bubbleText.length > 0, first.bubbleText);
rec("exp01 演示：拖尾光带出现", first.ribbon, String(first.ribbon));
rec("exp01 演示：虚拟手指出现", first.finger, first.fingerTransform.slice(0, 40));
rec("exp01 演示：有暂停/重播控制", first.controls, String(first.controls));

await sleep(900);
const second = await readCoach();
rec("exp01 演示：指尖真的在动（transform 变了）", second.fingerTransform !== first.fingerTransform, `${first.fingerTransform.slice(0, 32)} → ${second.fingerTransform.slice(0, 32)}`);

await page.locator('[data-demo-id="demo-coach-pause"]').click();
await sleep(420);
const pausedA = await readCoach();
await sleep(900);
const pausedB = await readCoach();
rec("exp01 演示：暂停后指尖停住", pausedA.fingerTransform === pausedB.fingerTransform, pausedA.fingerTransform.slice(0, 40));

await page.screenshot({ path: `${EVID}/50-coach-exp01.png` });

/* ---------- 2. 教师端「课堂演示」 ---------- */
await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
await sleep(900);
const hasEntry = await page.locator('[data-demo-id="teacher-demo-open"]').count();
rec("教师端：有「课堂演示」入口", hasEntry > 0, `入口 ${hasEntry} 个`);
if (hasEntry > 0) {
  await page.locator('[data-demo-id="teacher-demo-open"]').click();
  await page.waitForURL(/exp\/exp01/, { timeout: 15000 }).catch(() => {});
  await sleep(1600);
  const coach = await readCoach();
  const url = page.url();
  rec("教师端：落到 exp01 且引导自动开", /exp01/.test(url) && coach.bubble, `${url.replace(BASE, "")} · ${coach.bubbleText}`);
  rec("教师端：光带 + 手指都在", coach.ribbon && coach.finger, `ribbon=${coach.ribbon} finger=${coach.finger}`);
  await page.screenshot({ path: `${EVID}/51-coach-teacher.png` });
}

rec("引导链路：console/pageerror 零 error", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.pass).length;
fs.writeFileSync(`${EVID}/coach-report.json`, JSON.stringify({ results, errors }, null, 2));
console.log(`\n演示引导：${results.length - failed}/${results.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
