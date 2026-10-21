/**
 * 10 个实验的全链路自测：进实验 → 一键演示 → 报告，逐条记录状态与报错。
 * 用法：node scripts/audit-all-experiments.mjs
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const IDS = ["exp01", "exp02", "exp03", "exp04", "exp05", "exp06", "exp07", "exp08", "exp09", "exp10"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  errors.push(`console: ${t.slice(0, 120)}`);
});

await loginStudent(page, { base: BASE });

const results = [];
for (const id of IDS) {
  errors.length = 0;
  const row = { id };
  const resp = await page.goto(`${BASE}/exp/${id}?force=1`, { waitUntil: "domcontentloaded" });
  row.status = resp?.status() ?? null;
  await page.waitForTimeout(2200);
  // 关新手教学
  const skip = page.locator("button:has-text('跳过，直接开始')");
  if (await skip.count()) {
    await skip.first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
  const pageInfo = await page.evaluate(() => {
    const body = document.body.innerText.replace(/\s+/g, " ").trim();
    return {
      textLen: body.length,
      blank: body.length < 40,
      hasWorkbench: !!document.querySelector("[data-demo-id='demo-key-hint']"),
      stepText: (body.match(/第\s*(\d+)\s*\/\s*(\d+)\s*步/) ?? []).slice(1).join("/"),
      disabledNotice: /即将开放|暂未开放|敬请期待/.test(body),
    };
  });
  Object.assign(row, pageInfo);
  // 尝试一键演示（有没有 autodemo 入口）
  const demo = await page.evaluate(() => {
    const a = document.querySelector("[data-dev='dock-oneclick-demo'], a[href*='autodemo=1']");
    return a ? a.getAttribute("href") : null;
  });
  row.demoEntry = demo;
  if (pageInfo.hasWorkbench) {
    const t0 = Date.now();
    await page.goto(`${BASE}/exp/${id}?force=1&autodemo=1`, { waitUntil: "domcontentloaded" });
    let reached = false;
    for (let i = 0; i < 110; i++) {
      await page.waitForTimeout(1000);
      if (page.url().includes("/report")) {
        reached = true;
        break;
      }
    }
    await page.waitForTimeout(1500);
    row.reachedReport = reached;
    row.seconds = Math.round((Date.now() - t0) / 1000);
    if (reached) {
      row.report = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, " ");
        return {
          total: (body.match(/总分\s*(\d+)\s*\/\s*100/) ?? [])[1] ?? null,
          textLen: body.length,
        };
      });
    }
  }
  row.errors = [...errors];
  results.push(row);
  console.log(JSON.stringify(row));
}

console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(results, null, 2));
await browser.close();
