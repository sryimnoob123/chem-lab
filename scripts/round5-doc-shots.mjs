/**
 * 第五轮 · 验收说明书配图（1440×900）
 *   shots/01-experiments.png  实验列表
 *   shots/02-bench.png        实验台（exp01 第 1 步）
 *   shots/03-plan.png         /plan 选主题 + 4 段拆解
 *   shots/04-theater.png      /plan 底部「危险」剧场演完
 *   shots/05-tutor.png        实验台右下角 AI 助教抽屉（无 key，本地话术）
 *
 * 用法：node scripts/round5-doc-shots.mjs [--base http://127.0.0.1:3000] [--out evidence/2026-10-24-final/shots]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const argOf = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;
const BASE = (argOf("--base", "http://127.0.0.1:3000")).replace(/\/$/, "");
const OUT = path.resolve(argOf("--out", "evidence/2026-10-24-final/shots"));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STUDENT = { studentNo: "20250101", name: "周若曦" };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

const shot = async (name, note) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${name}.png  ${note ?? ""}`);
};

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }).catch(() => null);
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: STUDENT });

// 01 实验列表
await page.goto(`${BASE}/experiments`, { waitUntil: "load" });
await page.waitForSelector('[data-demo-id="demo-catalog-exp01"]', { timeout: 60000 });
await sleep(600);
await shot("01-experiments", "实验列表：必做实验按 1/2/3 顺序解锁");

// 02 实验台（第 1 步）
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "load", timeout: 120000 });
await page.waitForSelector('[data-demo-id="demo-scene-vessel-volumetric"]', { timeout: 90000 });
await sleep(1600);
await shot("02-bench", "实验台：左引导卡 / 中间台面 / 右任务+错误演示");

// 03 /plan：选主题 → 4 段拆解
await page.goto(`${BASE}/plan`, { waitUntil: "load" });
await sleep(1200);
await page.locator('[data-demo-id="demo-topic-topic-hcl-standard"]').first().click().catch(() => null);
await page.waitForSelector('[data-demo-id="demo-plan-phases"]', { timeout: 60000 }).catch(() => null);
await sleep(1200);
await shot("03-plan", "/plan：选主题后 AI 拆成 4 段（称量干燥 / 溶解定容 / 滴定终点 / 读数处理）");

// 04 开始设计方案 → 右栏三种结果剧场 → 点「危险」演一遍
await page.locator('[data-demo-id="demo-plan-start"]').first().click().catch(() => null);
await page.waitForSelector('[data-demo-id="demo-result-theater"]', { timeout: 60000 }).catch(() => null);
await sleep(1200);
await page.locator('[data-demo-id="demo-result-theater"]').first().scrollIntoViewIfNeeded().catch(() => null);
await sleep(400);
await shot("04-plan-theater", "设计态右栏：三种结果对照（可行 / 故障 / 危险）");
await page.locator('[data-demo-id="demo-scenario-danger"]').first().click().catch(() => null);
// 危险那条路线有 17 拍，回放比 15s 长：等「正在演」消失（最多 75s）
for (let i = 0; i < 75; i++) {
  const running = await page.evaluate(() => document.body.innerText.includes("正在演「危险」"));
  if (!running) break;
  await sleep(1000);
}
await sleep(800);
await page.locator('[data-demo-id="demo-result-theater"]').first().scrollIntoViewIfNeeded().catch(() => null);
await sleep(500);
await shot("05-plan-danger", "点「危险」演完一遍：结论 = 这一步不可行 + 为什么");

// 05 AI 助教（无 key → 本地话术）
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "load", timeout: 120000 });
await page.waitForSelector('[data-demo-id="demo-ai-button"]', { timeout: 90000 });
await sleep(1200);
await page.locator('[data-demo-id="demo-ai-button"]').first().click();
await sleep(500);
const input = page.locator('[data-demo-id="demo-ai-input"]').first();
if (await input.count()) {
  await input.fill("移液管怎么润洗？");
  await page.locator('[data-demo-id="demo-ai-send"]').first().click().catch(() => null);
  await sleep(2500);
}
await shot("06-tutor", "AI 助教抽屉：没有 key 时回落本地话术");

console.log("errors:", JSON.stringify(errors));
await browser.close();
