/**
 * 四级事故系统：L4 终止路径端到端（exp10 的活塞硬拧）
 * 用法：BASE_URL=http://localhost:3001 node scripts/l4-check.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "l4");
fs.mkdirSync(outDir, { recursive: true });

const expId = "exp10";
const l4Id = "demo-op-step2-piston-force";
const mod = await import(`../lib/pedagogy/curriculum/${expId}.ts`);
const c = mod[`${expId}Curriculum`];

const steps = [];
const errors = [];
let n = 0;
const ok = (k, d) => {
  steps.push({ k, ok: true });
  console.log(`[OK] ${k} · ${d}`);
};
const bad = (k, d) => {
  steps.push({ k, ok: false });
  console.log(`[X ] ${k} · ${d}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
const shot = async (slug) => {
  await page.waitForTimeout(400);
  const name = `${String(++n).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
};

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 15000 });

await page.evaluate(() => window.localStorage.clear());
await page.goto(`${base}/exp/${expId}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

// 过前测（门禁）
for (const q of c.pre) {
  await page.locator(`[data-demo-id='bopbps-op-${q.id}-${q.answer}']`).click().catch(() => {});
}
await page.locator("[data-demo-id='bopbps-pre-submit']").click();
await page.waitForTimeout(1600);

// 走到第 2 步：逐个尝试第 1 步的动作，直到出现第 2 步选项（点错 trap 就重做再试）
for (let attempt = 0; attempt < 8; attempt++) {
  if (await page.locator("[data-demo-id^='demo-op-step2-']").count()) break;
  const ids = await page
    .locator("[data-demo-id^='demo-op-step1-']")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-demo-id")));
  const next = ids[attempt % Math.max(1, ids.length)];
  if (!next) break;
  await page.locator(`[data-demo-id='${next}']`).click().catch(() => {});
  await page.waitForTimeout(1100);
  const retry = page.locator("[data-demo-id^='demo-retry-']").first();
  if (await retry.count()) {
    await retry.click().catch(() => {});
    await page.waitForTimeout(700);
  }
}
const l4 = page.locator(`[data-demo-id='${l4Id}']`);
if (!(await l4.count())) {
  bad("L4 选项可见", "第 2 步没找到 " + l4Id);
} else {
  await l4.click();
  await page.waitForTimeout(1600);
  const txt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const terminated = /终止|事故|无法继续|实验结束/.test(txt);
  if (terminated) ok("L4 终止提示", txt.match(/[^ ]{0,24}(终止|事故)[^ ]{0,24}/)?.[0] ?? "已出现");
  else bad("L4 终止", txt.slice(0, 80));
  await shot("l4-terminated");

  // 交卷看报告
  const fin = page.locator("[data-demo-id='demo-finish']").first();
  if (await fin.count()) {
    await fin.click();
    await page.waitForTimeout(2500);
    await shot("l4-report");
    const rt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const hasIncident = /事故\s*\d|事故清单|事故数/.test(rt);
    if (hasIncident) ok("报告含事故记录", rt.match(/事故[^ ]{0,16}/)?.[0] ?? "有");
    else bad("报告事故记录", rt.slice(0, 80));
  } else bad("交卷", "没找到交卷按钮");
}

await b.close();
const failed = steps.filter((s) => !s.ok).length;
console.log(`\n截图 ${n} 张 · pageerror ${errors.length} · 失败 ${failed}`);
console.log("目录:", outDir);
process.exitCode = failed || errors.length ? 1 : 0;
