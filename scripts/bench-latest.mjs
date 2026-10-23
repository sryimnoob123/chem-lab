/**
 * 台面整屏截图（给用户看进展的那一张）
 *
 * 固定 1440×900、exp01 第 1 步（?force=1 跳过前测），覆盖写到
 *   %TEMP%/chemlab-shots/bench-latest.png
 * 每次有明确的视觉/排版改动就重跑一次，别让用户看旧图。
 *
 * 用法：BASE_URL=http://localhost:3001 node scripts/bench-latest.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const out = process.env.OUT ?? path.join(os.tmpdir(), "chemlab-shots", "bench-latest.png");
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto(BASE + "/exp/exp01?force=1", { waitUntil: "networkidle" });
// 等水合 + 场景画完（天平/器皿组已经画出来，且交卷按钮被 React 接管）
await page.waitForFunction(
  () =>
    Boolean(document.querySelector("[data-demo-id='demo-scene-instrument-balance']")) &&
    Boolean(document.querySelector("[data-demo-id='demo-finish']")),
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(900);
await page.screenshot({ path: out });
console.log(out, fs.statSync(out).size, "bytes");
await browser.close();
