/**
 * 二轮四视口实拍（2026-10-24）
 * 覆盖：实验台（exp01，第 1 步）/ 拼接实验 / 教师端 / 报告页
 * 用法：BASE=http://127.0.0.1:3000 node .team/shots-round2.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const OUT = process.env.OUT || "evidence/2026-10-24-round2";
const VPS = [["1440", 1440, 900], ["1152", 1152, 900], ["1024", 1024, 768], ["390", 390, 844]];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const log = [];

async function pageFor(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript(() => {
    try { window.localStorage.setItem("bopbps:v1:exp01:pre", "pass"); } catch {}
  });
  const res = await page.goto(BASE + "/api/session", { waitUntil: "load" }).catch(() => null);
  return { ctx, page, errors };
}

for (const [label, width, height] of VPS) {
  const { ctx, page, errors } = await pageFor(width, height);
  // 实验台
  await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(2500);
  const bench = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    dock: Boolean(document.querySelector("[data-demo-id='demo-mobile-dock']")),
  }));
  await page.screenshot({ path: `${OUT}/bench-${label}.png` });
  // 拼接实验设计区
  await page.goto(`${BASE}/plan`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1200);
  if (!(await page.locator("[data-demo-id='demo-plan-start']").count())) {
    await page.locator("[data-demo-id^='demo-topic-topic-']").first().click();
    await page.waitForTimeout(400);
  }
  await page.locator("[data-demo-id='demo-plan-start']").click();
  await page.waitForTimeout(900);
  const plan = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  await page.screenshot({ path: `${OUT}/plan-${label}.png` });
  log.push({ label, width, height, bench, plan, errors });
  await ctx.close();
}

// 561~900 区间（平板/窄笔电）：试剂架不该被窄屏控件带抬高（workbench.module.css 的二轮修复）
{
  const { ctx, page, errors } = await pageFor(800, 700);
  await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(2000);
  const band = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { bottom: Math.round(b.bottom), top: Math.round(b.top), h: Math.round(b.height) };
    };
    const dock = document.querySelector("[data-demo-id='demo-mobile-dock']");
    const dockStyle = dock ? getComputedStyle(dock) : null;
    return {
      rack: box("[class*='rack']"),
      stage: box("[class*='stage']"),
      dockDisplay: dockStyle?.display ?? "absent",
      dockBox: box("[data-demo-id='demo-mobile-dock']"),
    };
  });
  await page.screenshot({ path: `${OUT}/bench-800x700.png` });
  log.push({ label: "800x700", band, errors });
  await ctx.close();
}

// exp09 与报告页（审查点名的证据覆盖缺口：这两处共用 token，上一轮没拍）
{
  const { ctx, page, errors } = await pageFor(1440, 900);
  await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/bench-exp09-1440.png` });
  await page.goto(`${BASE}/exp/exp01/report`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1800);
  const report = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    total: document.querySelector("[data-demo-id='demo-report-total']")?.textContent?.trim() ?? null,
  }));
  await page.screenshot({ path: `${OUT}/report-1440.png` });
  log.push({ label: "exp09+report", report, errors });
  await ctx.close();
}

// 教师端 + 报告页（桌面 + 手机各一张）
for (const [label, width, height] of [["1440", 1440, 900], ["390", 390, 844]]) {
  const { ctx, page, errors } = await pageFor(width, height);
  await page.goto(`${BASE}/teacher`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(2200);
  const teacher = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  await page.screenshot({ path: `${OUT}/teacher-${label}.png` });
  log.push({ label: `teacher-${label}`, teacher, errors });
  await ctx.close();
}

console.log(JSON.stringify(log, null, 1));
await browser.close();
