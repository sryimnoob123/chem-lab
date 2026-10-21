/**
 * 自动演示验收（asset-pipeline）：单 Playwright、串行。
 *  1. 证据：Playwright 的 `locator.dragTo` 能驱动 HTML5 拖拽，300ms 内事件条更新
 *  2. `?show=fx` 事故大秀：4 张截图（爆炸 / 毒雾 / 起火 / 总结帧）
 *  3. `?demo=1` 纯事件预设可直接把场景置为“已投入”
 *  4. reduced-motion 下大秀仍有静态终态
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = path.join(os.tmpdir(), "chemlab-shots");
const errors = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

const shot = async (page, name) => {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest });
  console.log("shot", dest);
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

  // ---------- 1. dragTo 驱动真实拖拽 ----------
  await page.goto(`${BASE}/scene-preview`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector('[data-demo-id="demo-scene-vessel-flask"]', { timeout: 60_000 });
  await page.waitForTimeout(300);
  const started = Date.now();
  await page
    .locator('[data-demo-id="demo-scene-reagent-agno3"]')
    .dragTo(page.locator('[data-demo-id="demo-scene-vessel-flask"]'), { timeout: 15_000 });
  await page.waitForTimeout(250);
  const text = (await page.locator('[data-demo-id="demo-scene-event"]').innerText()).replace(/\s+/g, " ");
  const elapsed = Date.now() - started;
  check("dragTo 驱动拖拽：250ms 内事件条出方程式", text.includes("AgCl"), `${elapsed}ms · ${text.slice(0, 46)}`);
  check("dragTo 后器皿可见（非隐藏元素）", await page.locator('[data-demo-id="demo-scene-vessel-flask"]').isVisible());

  // ---------- 2. 事件驱动预设（?demo=1） ----------
  await page.goto(`${BASE}/scene-preview?demo=1&reagent=cuso4&vessel=beaker`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector('[data-demo-id="demo-scene-vessel-beaker"]', { timeout: 60_000 });
  await page.waitForTimeout(400);
  const presetText = (await page.locator('[data-demo-id="demo-scene-event"]').innerText()).replace(/\s+/g, " ");
  check("?demo=1 无需真实拖拽即可置状态", presetText.includes("Cu(OH)₂"), presetText.slice(0, 40));
  const api = await page.evaluate(() => typeof window.__chemLabDemoScene);
  check("window.__chemLabDemoScene 已暴露", api === "object", api);

  // ---------- 3. 事故大秀 4 张截图 ----------
  await page.goto(`${BASE}/scene-preview?show=fx`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector('[data-demo-id="demo-fx-show"]', { timeout: 60_000 });
  await page.waitForTimeout(350); // 爆炸峰值（火球+碎片还在）
  const hint1 = await page.locator('[data-demo-id="demo-fx-show"]').getAttribute("data-show-index");
  await shot(page, "show-1-explosion.png");
  await page.waitForTimeout(3250); // 到第 2 个（毒雾）0.8s
  await shot(page, "show-2-toxic-gas.png");
  await page.waitForTimeout(2800); // 第 3 个（起火）0.8s
  await shot(page, "show-3-fire.png");
  await page.waitForTimeout(16000); // 走完剩余，停在总结帧
  const endIndex = await page.locator('[data-demo-id="demo-fx-show"]').getAttribute("data-show-index");
  const summaryVisible = await page.locator('[data-demo-id="demo-fx-summary"]').isVisible().catch(() => false);
  check("大秀自动推进并停在总结帧", summaryVisible && Number(endIndex) >= 8, `index=${hint1} → ${endIndex}`);
  await shot(page, "show-4-summary.png");

  // ---------- 4. reduced-motion ----------
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rpage = await rctx.newPage();
  await rpage.goto(`${BASE}/scene-preview?show=fx`, { waitUntil: "networkidle", timeout: 120_000 });
  await rpage.waitForSelector('[data-demo-id="demo-fx-show"]', { timeout: 60_000 });
  await rpage.waitForTimeout(1200);
  const hasSvg = await rpage.locator('[data-demo-id="demo-fx-show"] svg').count();
  check("reduced-motion 下大秀仍有静态帧", hasSvg > 0, `svg=${hasSvg}`);
  await shot(rpage, "show-5-reduced.png");

  await browser.close();
  check("全程 pageerror = 0", errors.length === 0, errors[0] ?? "");
  console.log(`\n截图目录：${OUT}`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
