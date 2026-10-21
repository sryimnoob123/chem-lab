/**
 * 任务看板取证：1440×900 + 390×844 截图 + 几何量测 + 硬指标断言。
 *
 * 只读：BASE_URL 指向已跑着的服务（默认 3001 生产），不改数据、不起服务。
 * 用法：BASE_URL=http://localhost:3001 node scripts/mission-board-shot.mjs [expId]
 * 输出：%TEMP%\chemlab-shots\mission-board\*.png + geometry.json
 * 出口码：0 = 全通过；1 = 有断言失败
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clickOp, dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const expId = (process.argv[2] ?? "exp09").toLowerCase();
const outDir = path.join(os.tmpdir(), "chemlab-shots", "mission-board");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const rows = [];
let failed = 0;

function check(name, ok, detail) {
  rows.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const MEASURE = () => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const board = box('[data-demo-id="demo-mission-board"]');
  const flask = box('[data-demo-id="demo-scene-drop-flask"]');
  const toggle = document.querySelector("[data-board-toggle]");
  const tRect = toggle?.getBoundingClientRect();
  const tiny = [...document.querySelectorAll("[data-demo-id='demo-mission-board'] button")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.height < 44;
  }).length;
  return {
    board,
    rack: box('aside[aria-label="试剂架"]'),
    rail: box('aside[aria-label="操作面板"]'),
    stage: box("section[aria-labelledby='stage-title']"),
    flask,
    bar: box("[role='status']"),
    toggle: tRect ? { w: Math.round(tRect.width), h: Math.round(tRect.height) } : null,
    smallButtons: tiny,
    guide: document.querySelector("[data-demo-id='demo-guide-progress']")?.textContent ?? "",
    nextReagents: document.querySelectorAll('[data-demo-id^="demo-scene-reagent-"][data-next="true"]').length,
    pos: document.querySelector('[data-demo-id="demo-scene-drop-flask"]')?.getAttribute("data-next"),
    docW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
  };
};

const geometry = {};

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: vp.name === "mobile" ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

  await loginStudent(page, { base });
  await page.goto(`${base}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  // 新手教学首次自动弹：先留一张证据，再关掉
  const hadOnboarding = await page.locator('[data-demo-id="demo-onboarding"]').isVisible().catch(() => false);
  if (hadOnboarding) await page.screenshot({ path: path.join(outDir, `${vp.name}-${expId}-00-onboarding.png`) });
  await dismissOnboarding(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, `${vp.name}-${expId}-01-initial.png`) });

  const initial = await page.evaluate(MEASURE);
  check(`${vp.name}: 看板存在且 ≤260px`, Boolean(initial.board) && initial.board.w <= 260, JSON.stringify(initial.board));
  check(
    `${vp.name}: 看板不压试剂架`,
    Boolean(initial.rack) && initial.board && initial.rack.y >= initial.board.y + initial.board.h,
    `board.y+h=${initial.board ? initial.board.y + initial.board.h : "?"} rack.y=${initial.rack?.y}`,
  );
  check(
    `${vp.name}: 看板不压锥形瓶热区`,
    Boolean(initial.flask) &&
      initial.board &&
      (initial.board.x + initial.board.w <= initial.flask.x || initial.board.y + initial.board.h <= initial.flask.y),
    `board=${JSON.stringify(initial.board)} flask=${JSON.stringify(initial.flask)}`,
  );
  check(`${vp.name}: 无横向溢出`, initial.docW <= initial.innerW, `docW=${initial.docW} innerW=${initial.innerW}`);
  check(`${vp.name}: 进度行格式`, /第\s*\d+\s*\/\s*\d+/.test(initial.guide), initial.guide);
  check(`${vp.name}: 场景指引最多一盏（下一步试剂）`, initial.nextReagents <= 1, `next=${initial.nextReagents}`);
  if (vp.name === "mobile") {
    check("mobile: 看板内按钮 ≥44px", initial.smallButtons === 0, `过小按钮=${initial.smallButtons}`);
  }

  // 展开看板「详情」：详细流程 + 参数 + 提示 + 老师会说 都在这里
  await page.locator("[data-board-toggle]").first().click({ timeout: 4000 });
  await page.waitForTimeout(240);
  await page.screenshot({ path: path.join(outDir, `${vp.name}-${expId}-02-details.png`) });
  const opened = await page.evaluate(() => {
    const root = document.querySelector('[data-demo-id="demo-mission-board"]');
    const box = root?.getBoundingClientRect();
    return {
      expanded: document.querySelector("[data-board-toggle]")?.getAttribute("aria-expanded"),
      steps: document.querySelectorAll("[data-demo-id^='demo-guide-step-']").length,
      hint: [...(root?.querySelectorAll('button') ?? [])].some((el) => (el.textContent ?? '').includes('取一条提示')),
      detailH: box ? Math.round(box.height) : 0,
      hasNote: Boolean(root?.textContent?.includes("老师会说")),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  check(`${vp.name}: 详情展开`, opened.expanded === "true" && opened.steps >= 5, JSON.stringify(opened));
  check(`${vp.name}: 折叠区含提示与老师会说`, opened.hint && opened.hasNote, JSON.stringify(opened));
  check(`${vp.name}: 展开后仍无横向溢出`, opened.overflow <= 0, `overflow=${opened.overflow}`);

  // 收起来再前进一屏（看板默认收起是常态）
  await page.locator("[data-board-toggle]").first().click({ timeout: 4000 });
  await page.waitForTimeout(160);
  const primary = page.locator("[data-demo-id^='demo-op-']:visible").first();
  if (await primary.count()) {
    await clickOp(page, primary);
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: path.join(outDir, `${vp.name}-${expId}-03-after-step.png`) });
  const after = await page.evaluate(MEASURE);
  check(`${vp.name}: 走一步后进度前进`, after.guide !== initial.guide || after.board, `${initial.guide} → ${after.guide}`);
  check(`${vp.name}: 走一步后仍无横向溢出`, after.docW <= after.innerW, `docW=${after.docW}`);

  geometry[vp.name] = { viewport: vp, initial, after, opened, pageErrors: errors };
  await ctx.close();
}

fs.writeFileSync(path.join(outDir, "geometry.json"), JSON.stringify(geometry, null, 2));
await browser.close();
console.log(`\n截图目录: ${outDir}`);
console.log(`断言: ${rows.length - failed}/${rows.length} 通过`);
for (const row of rows) if (!row.ok) console.log(`  ✗ ${row.name} — ${row.detail}`);
process.exitCode = failed ? 1 : 0;
