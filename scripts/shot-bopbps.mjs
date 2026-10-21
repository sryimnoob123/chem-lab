/**
 * BOPPPS 六段视觉验收：前测页 → 全对解锁操作台 → 后测页
 * 截图落 %TEMP%\chemlab-shots\bopbps\
 * 用法：BASE_URL=http://localhost:3001 node scripts/shot-bopbps.mjs [expId]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "bopbps");
fs.mkdirSync(outDir, { recursive: true });

// node 的 TS 类型剥离：直接按带扩展名的路径 import 单个实验数据（避开 index.ts 的无扩展名再导出）
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
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  errors.push("console:" + t.slice(0, 100));
});

const shot = async (slug) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  const name = `${String(++n).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
  return name;
};

// 登录
await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 15000 });

// 1. 前测页
await page.goto(`${base}/exp/${expId}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const hasPre = await page.locator("[data-demo-id='bopbps-pre-submit']").count();
if (hasPre) ok("前测页出现", "含导入/目标/3 题");
else bad("前测页", "没有找到提交按钮，可能直接进了操作台");
await shot("prelab");

// 2. 先故意答错
if (c) {
  const wrong = c.pre[0].options.find((o) => o.key !== c.pre[0].answer);
  if (wrong) {
    await page.locator(`[data-demo-id='bopbps-op-${c.pre[0].id}-${wrong.key}']`).click();
    for (const q of c.pre.slice(1)) {
      await page.locator(`[data-demo-id='bopbps-op-${q.id}-${q.answer}']`).click();
    }
    await page.locator("[data-demo-id='bopbps-pre-submit']").click();
    await page.waitForTimeout(600);
    const txt = await page.locator("body").innerText();
    if (/答案\s*[A-D]/.test(txt)) ok("错题给解析", "答案+解析可见");
    else bad("错题解析", "没看到答案/解析");
    await shot("prelab-wrong");
    // 重新作答，避免已判定的正确项被禁用导致点不动
    const reset = page.locator("[data-demo-id='bopbps-pre-reset']");
    if (await reset.count()) {
      await reset.click();
      await page.waitForTimeout(400);
    }
  }

  // 3. 改正 → 全部答对 → 解锁
  for (const q of c.pre) {
    await page.locator(`[data-demo-id='bopbps-op-${q.id}-${q.answer}']`).click();
  }
  await page.locator("[data-demo-id='bopbps-pre-submit']").click();
  await page.waitForTimeout(1500);
  const unlocked = await page.locator("[data-demo-id^='demo-op-']").count();
  if (unlocked > 0) ok("全对后解锁操作台", `${unlocked} 个动作`);
  else bad("解锁", "操作台没出来");
  await shot("unlocked-workbench");
}

// 4. 报告页后测
await page.goto(`${base}/exp/${expId}/report`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const hasPost = await page.locator("[data-demo-id='bopbps-post-submit']").count();
if (hasPost) {
  ok("后测页出现", "报告页顶部 3 题");
  if (c) {
    for (const q of c.post) {
      await page.locator(`[data-demo-id='bopbps-post-${q.id}-${q.answer}']`).click();
    }
    await page.locator("[data-demo-id='bopbps-post-submit']").click();
    await page.waitForTimeout(600);
    const t2 = await page.locator("body").innerText();
    if (/100\s*\/\s*100|后测完成/.test(t2)) ok("后测提交出分", "100/100");
    else bad("后测出分", t2.slice(0, 80));
    await shot("postlab-done");
  }
} else bad("后测页", "报告页顶部没找到后测");

await b.close();
const failed = steps.filter((s) => !s.ok).length;
console.log(`\n截图 ${n} 张 · pageerror ${errors.length} · 失败 ${failed}`);
if (errors.length) console.log(errors.slice(0, 3).join(" | "));
console.log("目录:", outDir);
process.exitCode = failed || errors.length ? 1 : 0;
