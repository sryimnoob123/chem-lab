/**
 * 收尾回归：主链逐页截图 + 连点/切页/刷新/后退 + 堆增量
 * 产物：evidence/regress/NN-*.png、summary.json
 * 用法：node scripts/final-regression.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { clickOp, clickRetry } from "./lib/click-op.mjs";

const base = "http://localhost:3000";
const dir = path.join("evidence", "regress");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
const blanks = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/Failed to load resource/.test(t) && /(400|401|403|404)/.test(t)) return;
  errors.push("console:" + t.slice(0, 120));
});

const cdp = await ctx.newCDPSession(page);
const heap = async () => {
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return +(usedSize / 1024 / 1024).toFixed(1);
};

let i = 0;
const snap = async (label, slug) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(450);
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, "");
  if (text.length < 30) blanks.push(`${slug}(${text.length}字)`);
  const name = `${String(++i).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(dir, name) });
  console.log(`  ✓ ${name}  ${label}`);
};

const steps = [];
const mark = (name, ok, detail) => {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "[OK]" : "[X ]"} ${name} · ${detail}`);
};

// ---------- 1. 主链 ----------
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await snap("门户", "portal");
mark("门户", true, "已加载");

await page.locator("a[href='/login'], a[href*='login']").first().click();
await page.waitForURL(/\/login/);
await snap("登录页", "login");

await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await snap("登录已填写", "login-filled");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 10000 });
await snap("实验选择", "catalog");
mark("登录 → 实验选择", true, new URL(page.url()).pathname);

await page.locator("[data-demo-id='demo-catalog-exp09']").first().click();
await page.waitForURL(/\/exp\/exp09/, { timeout: 10000 });
await snap("实验页初始", "exp-initial");

// 拖试剂
try {
  const t0 = Date.now();
  await page
    .locator("[data-demo-id='demo-scene-reagent-naoh']")
    .first()
    .dragTo(page.locator("[data-demo-id='demo-scene-drop-flask']").first(), { timeout: 8000 });
  await page.waitForTimeout(500);
  await snap("拖试剂投放", "drag");
  mark("拖试剂", true, `${Date.now() - t0}ms`);
} catch (e) {
  mark("拖试剂", false, String(e).slice(0, 70));
}

// 成功分支
try {
  const t0 = Date.now();
  await clickOp(page, page.locator("[data-demo-id='demo-op-step1-weigh']").first());
  await page.waitForTimeout(700);
  await snap("成功分支", "success");
  mark("成功分支", true, `${Date.now() - t0}ms`);
} catch (e) {
  mark("成功分支", false, String(e).slice(0, 70));
}

// 失败分支（新开一页保证是第 1 步）
await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
try {
  const t0 = Date.now();
  await clickOp(page, page.locator("[data-demo-id='demo-op-step1-bare-hands']").first());
  await page.waitForSelector("[data-demo-id='demo-feedback-fail-1']", { timeout: 6000 });
  await snap("失败分支", "failure");
  mark("失败分支", true, `${Date.now() - t0}ms`);
} catch (e) {
  mark("失败分支", false, String(e).slice(0, 70));
}

// 重做
try {
  await clickRetry(page);
  await page.waitForTimeout(600);
  await snap("重做本步", "retry");
  mark("重做", true, "回到本步");
} catch (e) {
  mark("重做", false, String(e).slice(0, 70));
}

// 出结果
try {
  await page.goto(base + "/exp/exp09/report", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await snap("结果页", "report");
  mark("结果页", true, new URL(page.url()).pathname);
} catch (e) {
  mark("结果页", false, String(e).slice(0, 70));
}

// ---------- 2. 压力 ----------
const h0 = await heap();
const routes = ["/", "/login", "/experiments", "/exp/exp09"];
for (let k = 0; k < 40; k++) await page.mouse.click(300 + ((k * 97) % 900), 220 + ((k * 61) % 500));
for (let k = 0; k < 10; k++) await page.goto(base + routes[k % routes.length], { waitUntil: "domcontentloaded" });
for (let k = 0; k < 10; k++) {
  if (k % 2 === 0) await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  else await page.goForward({ waitUntil: "domcontentloaded" }).catch(() => {});
}
for (let k = 0; k < 10; k++) await page.reload({ waitUntil: "domcontentloaded" });
const h1 = await heap();
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await snap("压测后回门户", "after-stress");
mark("连点/切页/后退/刷新", true, `堆 ${h0} → ${h1} MB（Δ ${(h1 - h0).toFixed(1)}）`);

await b.close();

const summary = {
  steps,
  blanks,
  errors: [...new Set(errors)],
  heap: { before: h0, after: h1, delta: +(h1 - h0).toFixed(1) },
  shots: i,
};
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));

console.log(`\n截图 ${i} 张 · 白屏 ${blanks.length} · pageerror ${summary.errors.length} · 堆 Δ${summary.heap.delta}MB`);
if (blanks.length) console.log("白屏:", blanks.join(", "));
if (summary.errors.length) console.log("错误:", summary.errors.slice(0, 5).join(" | "));
console.log("目录:", dir);
const bad = steps.filter((s) => !s.ok).length + blanks.length + summary.errors.length;
process.exitCode = bad ? 1 : 0;
