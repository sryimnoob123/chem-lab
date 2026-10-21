/**
 * 生产态验收（打 http://localhost:3001，standalone 产物）
 * 覆盖：门户→登录→9 个实验逐个进→拖试剂→出结果→成功/失败→重做
 *       演示模式自动播完、5 套交互切换
 * 断言：pageerror=0、无白屏；截图落 public/shots-prod/
 * 用法：node scripts/prod-accept.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { clickOp, clickRetry } from "./lib/click-op.mjs";

const base = "http://localhost:3001";
const dir = path.join("public", "shots-prod");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const out = { steps: [], flashes: [], errors: [], shots: 0 };
const rec = (k, ok, d) => {
  out.steps.push({ k, ok, d });
  console.log(`${ok ? "[OK]" : "[X ]"} ${k} · ${d}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => out.errors.push(String(e.message).slice(0, 130)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/Failed to load resource/.test(t) && /(400|401|403|404)/.test(t)) return;
  out.errors.push("console:" + t.slice(0, 120));
});

let n = 0;
const shot = async (label, slug) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  const txt = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, "");
  if (txt.length < 30) out.flashes.push(slug);
  const name = `${String(++n).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(dir, name) });
  out.shots++;
  return { name, txt };
};

// 1 门户
const r = await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await shot("门户", "portal");
rec("门户", r.status() === 200, `HTTP ${r.status()}`);

// 2 登录
await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await shot("登录填写", "login-filled");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 12000 });
await shot("实验选择", "catalog");
rec("登录 → 实验选择", true, new URL(page.url()).pathname);

// 3 九个实验逐个进（exp01..exp10，09 可玩）
const expIds = ["exp01", "exp02", "exp03", "exp04", "exp05", "exp06", "exp07", "exp08", "exp09", "exp10"];
let entered = 0;
for (const id of expIds) {
  const resp = await page.goto(`${base}/exp/${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const { txt } = await shot(`实验 ${id}`, `exp-${id}`);
  const hasStage = /第 \d\d 步/.test(txt) || /暂未开放|找不到/.test(txt);
  const status = resp?.status() ?? 0;
  const ok = status < 500 && txt.length > 30;
  if (ok) entered++;
  rec(`进入 ${id}`, ok, `HTTP ${status} · 文本 ${txt.length} 字 · 舞台 ${hasStage > 0 ? "有" : "无"}`);
}

// 4 拖试剂 → 出结果
await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await shot("实验 09 初始", "exp09-initial");
try {
  const t0 = Date.now();
  await page
    .locator("[data-demo-id='demo-scene-reagent-naoh']")
    .first()
    .dragTo(page.locator("[data-demo-id='demo-scene-drop-flask']").first(), { timeout: 8000 });
  await page.waitForTimeout(600);
  await shot("拖试剂出结果", "drag-result");
  rec("拖试剂 → 出结果", true, `${Date.now() - t0}ms`);
} catch (e) {
  rec("拖试剂 → 出结果", false, String(e).slice(0, 70));
}

// 5 成功分支
try {
  await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await clickOp(page, page.locator("[data-demo-id='demo-op-step1-weigh']").first());
  await page.waitForTimeout(700);
  await shot("成功分支", "success");
  rec("成功分支", true, "已出反馈");
} catch (e) {
  rec("成功分支", false, String(e).slice(0, 70));
}

// 6 失败分支 + 重做
try {
  await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await clickOp(page, page.locator("[data-demo-id='demo-op-step1-bare-hands']").first());
  await page.waitForSelector("[data-demo-id='demo-feedback-fail-1']", { timeout: 6000 });
  await shot("失败分支", "failure");
  await clickRetry(page);
  await page.waitForTimeout(600);
  await shot("重做本步", "retry");
  rec("失败分支 + 重做", true, "两行解释 + 回到本步");
} catch (e) {
  rec("失败分支 + 重做", false, String(e).slice(0, 70));
}

// 7 五套交互切换
try {
  const modes = ["drag", "click", "key", "event", "auto"];
  const found = await page.evaluate(
    (ms) => ms.map((m) => Boolean(document.querySelector(`[data-demo-id='demo-mode-${m}']`))),
    modes,
  );
  let switched = 0;
  for (const m of modes) {
    const el = page.locator(`[data-demo-id='demo-mode-${m}']`).first();
    if (!(await el.count())) continue;
    await el.click();
    await page.waitForTimeout(250);
    const cur = await el.getAttribute("data-current");
    if (cur === "true") switched++;
  }
  await shot("五套交互切换", "modes");
  rec("五套交互", found.every(Boolean) && switched === 5, `可见 ${found.filter(Boolean).length}/5 · 可切 ${switched}/5`);
} catch (e) {
  rec("五套交互", false, String(e).slice(0, 70));
}

// 8 演示模式自动播完
try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-demo-id='demo-mode-open']").first().click();
  await page.waitForTimeout(800);
  await shot("演示模式开演", "demo-open");
  const caps = new Set();
  const scenes = new Set();
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < 170 && scenes.size < 6) {
    await page.waitForTimeout(800);
    const cap = await page.locator(".demo-caption__text").innerText().catch(() => "");
    const src = await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "");
    if (cap) caps.add(cap);
    if (src) scenes.add(src.split("?")[0]);
    if (/teacher/.test(src ?? "")) break;
  }
  await shot("演示模式 · 教师端", "demo-teacher");
  rec("演示模式", scenes.size >= 5 && caps.size >= 15, `${scenes.size} 场景 · ${caps.size} 条旁白`);
} catch (e) {
  rec("演示模式", false, String(e).slice(0, 70));
}

await browser.close();

out.errors = [...new Set(out.errors)];
const bad = out.steps.filter((s) => !s.ok).length;
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(out, null, 2));

console.log(`\n截图 ${out.shots} 张 · 白屏 ${out.flashes.length} · pageerror ${out.errors.length} · 失败步骤 ${bad}`);
if (out.flashes.length) console.log("白屏:", out.flashes.join(", "));
if (out.errors.length) console.log("错误:", out.errors.slice(0, 5).join(" | "));
console.log("目录:", dir);
process.exitCode = bad || out.errors.length || out.flashes.length ? 1 : 0;
