#!/usr/bin/env node
/**
 * 场景验收截图（asset-pipeline 独占）
 *
 * 产出（%TEMP%\chemlab-shots\）：
 *   scene-desktop-initial.png     拖拽前
 *   scene-desktop-dragging.png    拖起试剂瓶（缩放 1.04 + 阴影）时
 *   scene-desktop-reacting.png    拖放后动画中（白色 AgCl 沉淀正在生成）
 *   scene-desktop-reaction.png    动画结束 + 事件条给出方程式
 *   scene-mobile-tap.png          390×844 触屏路径：点试剂 → 点器皿
 *   fx-<name>.png                 8 个事故特效各一张（播到峰值时截舞台）
 *   fx-explosion-reduced.png      prefers-reduced-motion 下的静态终态
 *
 * 用法：node scripts/scene-shot.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = "http://localhost:3000"; // 必须用 localhost：Next 16 dev 把 127.0.0.1 视为跨源，会拦 HMR 导致不 hydrate
const OUT = path.join(os.tmpdir(), "chemlab-shots");
const ROUTE = "/scene-preview";
const SCENE_ROOT = '[data-demo-id="demo-scene-root"]';

/** 每个特效的"峰值"截图时刻（ms）：太早看不出，太晚已淡出。 */
const FX_PEAK = {
  explosion: 240,
  toxicGas: 800,
  fire: 620,
  boilOver: 1250,
  burn: 480,
  glassBreak: 560,
  heavyMetal: 1400,
  deviceAccident: 420,
};

async function waitForServer(timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(BASE, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function ensureDev() {
  if (await waitForServer(1500)) return;
  console.log("dev 未运行，启动中…");
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
    shell: process.platform === "win32",
  });
  child.unref();
  if (!(await waitForServer())) throw new Error("dev server 120s 内没起来");
}

const shot = async (page, name, selector) => {
  const dest = path.join(OUT, name);
  if (selector) await page.locator(selector).screenshot({ path: dest });
  else await page.screenshot({ path: dest, fullPage: true });
  console.log("shot", path.basename(dest));
};

async function openPreview(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector('[data-demo-id="demo-scene-vessel-flask"]', { timeout: 60_000 });
  await page.waitForTimeout(600);
  return page;
}

const REACTIONS_ONLY = process.argv.includes("--reactions-only");

async function main() {
  await ensureDev();
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const consoleErrors = [];

  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await openPreview(desktopCtx);
  page.on("console", (m) => {
    if (m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text())) consoleErrors.push(m.text().slice(0, 200));
  });
  await shot(page, "scene-desktop-initial.png", SCENE_ROOT);

  const reagent = '[data-demo-id="demo-scene-reagent-agno3"]';
  const flask = '[data-demo-id="demo-scene-vessel-flask"]';

  // 正式拖放：AgNO₃ → 锥形瓶（内含 NaCl）
  await page.dragAndDrop(reagent, flask, { timeout: 15_000 });
  await page.waitForTimeout(650);
  await shot(page, "scene-desktop-reacting.png", SCENE_ROOT);
  await page.waitForTimeout(1100);
  const eventText = await page.locator('[data-demo-id="demo-scene-event"]').innerText();
  console.log("事件条：", eventText.replace(/\s+/g, " ").slice(0, 120));
  await shot(page, "scene-desktop-reaction.png", SCENE_ROOT);

  // 拖起瞬间（新开一页，避免上一轮拖拽残留状态）
  const dragPage = await openPreview(desktopCtx);
  const box = await dragPage.locator(reagent).boundingBox();
  if (box) {
    await dragPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await dragPage.mouse.down();
    await dragPage.mouse.move(box.x + box.width / 2 + 36, box.y + box.height / 2 + 24, { steps: 6 });
    await dragPage.waitForTimeout(180);
    await shot(dragPage, "scene-desktop-dragging.png", SCENE_ROOT);
    await dragPage.mouse.up();
  }

  // ---------- 四条标准现象（每次重载，串行复用同一 page） ----------
  const cases = [
    { name: "scene-reaction-agcl.png", reagent: "agno3", vessel: "flask", expect: "AgCl", peak: 900 },
    { name: "scene-reaction-cuoh2.png", reagent: "cuso4", vessel: "beaker", expect: "Cu(OH)₂", peak: 900 },
    { name: "scene-reaction-co2.png", reagent: "na2co3", vessel: "tube-a", expect: "CO₂↑", peak: 450 },
    { name: "scene-reaction-burette.png", reagent: "agno3", vessel: "burette", expect: "滴定管", peak: 500 },
  ];
  for (const c of cases) {
    await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForSelector(flask, { timeout: 60_000 });
    await page.waitForTimeout(400);
    await page.dragAndDrop(`[data-demo-id="demo-scene-reagent-${c.reagent}"]`, `[data-demo-id="demo-scene-vessel-${c.vessel}"]`, {
      timeout: 15_000,
    });
    await page.waitForTimeout(c.peak);
    await shot(page, c.name, SCENE_ROOT); // 先抓现象峰值（气泡/沉淀正在生成）
    await page.waitForTimeout(1400);
    const text = (await page.locator('[data-demo-id="demo-scene-event"]').innerText()).replace(/\s+/g, " ");
    const okText = text.includes(c.expect);
    console.log(`${c.name}：${okText ? "OK" : "文案不含预期"} · ${text.slice(0, 90)}`);
    if (!okText) consoleErrors.push(`${c.name} 期望含「${c.expect}」，实际：${text.slice(0, 120)}`);
  }

  if (REACTIONS_ONLY) {
    await browser.close();
    console.log("\\n仅跑四条反应截图（--reactions-only）");
    return;
  }

  // ---------- 移动端：点选路径 ----------
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mPage = await openPreview(mobileCtx);
  await mPage.locator(reagent).click();
  await mPage.locator(flask).click();
  await mPage.waitForTimeout(1700);
  const mobileEvent = await mPage.locator('[data-demo-id="demo-scene-event"]').innerText();
  console.log("移动端事件条：", mobileEvent.replace(/\s+/g, " ").slice(0, 120));
  await shot(mPage, "scene-mobile-tap.png", SCENE_ROOT);

  // ---------- 8 个事故特效 ----------
  const stage = '[data-demo-id="demo-fx-stage"]';
  await page.locator(stage).scrollIntoViewIfNeeded();
  for (const [key, wait] of Object.entries(FX_PEAK)) {
    await page.locator(`[data-fx-trigger="${key}"]`).click();
    await page.waitForTimeout(wait);
    await shot(page, `fx-${key}.png`, stage);
    await page.waitForTimeout(1500);
  }

  // ---------- 降级：reduced motion 静态终态 ----------
  const reducedCtx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const rPage = await reducedCtx.newPage();
  await rPage.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle", timeout: 90_000 });
  await rPage.locator(stage).scrollIntoViewIfNeeded();
  await rPage.locator('[data-fx-trigger="explosion"]').click();
  await rPage.waitForTimeout(260);
  await shot(rPage, "fx-explosion-reduced.png", stage);

  await browser.close();

  if (consoleErrors.length) {
    console.log(`\n注意：${consoleErrors.length} 条 console error，首条：${consoleErrors[0]}`);
    process.exitCode = 1;
  } else {
    console.log("\n无 console error");
  }
  console.log(`\n截图目录：${OUT}`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
