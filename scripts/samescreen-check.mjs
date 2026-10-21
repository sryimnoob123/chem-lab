/**
 * 同屏体验验收：前测 → 全对 → 操作台（不整页刷新）→ 打开预习抽屉 → 重做前测
 * 用法：BASE_URL=http://localhost:3001 node scripts/samescreen-check.mjs [expId]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { countVisibleOps } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "samescreen");
fs.mkdirSync(outDir, { recursive: true });

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
  await page.waitForTimeout(350);
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
await page.waitForTimeout(1000);

// 前测页：问卷 + 下方占位应同屏
const hasPlaceholder = await page.locator("[data-demo-id='bopbps-lab-locked']").count();
if (hasPlaceholder) ok("问卷与操作台占位同屏", "下方虚线占位可见");
else bad("同屏占位", "没找到 bopbps-lab-locked");
await shot(`01-${expId}-pre-with-placeholder`);

// 记录 URL，验证解锁过程中不跳转
const urlBefore = page.url();

for (const q of c.pre) {
  await page.locator(`[data-demo-id='bopbps-op-${q.id}-${q.answer}']`).click().catch(() => {});
}
await page.locator("[data-demo-id='bopbps-pre-submit']").click();
await page.waitForTimeout(1600);

const ops = await countVisibleOps(page);
if (ops > 0) ok("解锁后进入操作台", `${ops} 个动作`);
else bad("进入操作台", "没有动作按钮");
const urlAfter = page.url();
if (urlBefore === urlAfter) ok("解锁过程无页面跳转", urlAfter.replace(base, ""));
else bad("发生跳转", `${urlBefore} → ${urlAfter}`);
await shot(`02-${expId}-workbench`);

// 操作台内抽屉
const toggle = page.locator("[data-demo-id='bopbps-drawer-toggle']");
if (await toggle.count()) {
  const label = (await toggle.innerText()).trim();
  ok("操作台内有预习入口", label);
  await toggle.click();
  await page.waitForTimeout(500);
  const drawer = page.locator("[data-demo-id='bopbps-drawer']");
  if (await drawer.count()) {
    const txt = (await drawer.innerText()).replace(/\s+/g, " ");
    if (/导入/.test(txt) && /前测回顾/.test(txt)) ok("抽屉可展开并含导入/前测回顾", txt.slice(0, 40));
    else bad("抽屉内容", txt.slice(0, 60));
    await shot(`03-${expId}-drawer`);
  } else bad("抽屉", "点了没展开");
} else bad("预习入口", "操作台里没有 bopbps-drawer-toggle");

await b.close();
const failed = steps.filter((s) => !s.ok).length;
console.log(`\n截图 ${n} 张 · pageerror ${errors.length} · 失败 ${failed}`);
if (errors.length) console.log(errors.slice(0, 3).join(" | "));
console.log("目录:", outDir);
process.exitCode = failed || errors.length ? 1 : 0;
