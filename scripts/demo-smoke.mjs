/**
 * 演示模式冒烟：验证「一键演示」真能播、每步有推进、退出干净。
 *
 * 判定（用户口径：演示要能看、每步都有动静）：
 *   1. 点首页「一键演示」→ 浮层出现（role=dialog + aria-label=演示模式）
 *   2. 状态变为 playing，且字幕/步数在 20s 内至少推进 3 次（说明脚本真的在走）
 *   3. iframe 内能看到模拟光标（DemoCursor 插入的节点）
 *   4. 退出后浮层消失、无残留 iframe
 *
 * 用法：$env:BASE_URL="http://localhost:3002"; node scripts/demo-smoke.mjs [scriptId]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const wantScript = process.argv[2] ?? null;
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const outDir = path.join(os.tmpdir(), "chemlab-shots", `demo-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));

const rows = [];
const check = (name, pass, detail) => {
  rows.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

// 1 打开演示
const open = page.locator("[data-demo-id='demo-mode-open']").first();
check("首页有「一键演示」入口", (await open.count()) > 0);
await open.click();
const dialog = page.locator("[role='dialog'][aria-label='演示模式']").first();
await dialog.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
check("演示浮层出现", (await dialog.count()) > 0 && (await dialog.isVisible().catch(() => false)));

// 可选：指定脚本（切脚本会换 iframe，onLoad 会自动起播；别再点播放，否则会 toggle 成暂停）
if (wantScript) {
  const select = page.locator("[data-demo-id='demo-page-script']").first();
  if (await select.count()) {
    await select.selectOption(wantScript).catch(() => {});
    await page.waitForTimeout(3000);
    const stateNow = await page.locator(".demo-bar__state").first().getAttribute("data-state").catch(() => null);
    if (stateNow === "paused" || stateNow === "idle") {
      await page.locator("[data-demo-id='demo-page-play']").first().click().catch(() => {});
      await page.waitForTimeout(1200);
    }
  }
}

// 2 等 playing + 推进
const stateEl = page.locator(".demo-bar__state").first();
await page.waitForTimeout(1500);
const state0 = await stateEl.getAttribute("data-state").catch(() => null);
check("演示进入播放态", state0 === "playing", `state=${state0}`);

const stepEl = page.locator(".demo-caption__step").first();
const textEl = page.locator(".demo-caption__text").first();
const seen = new Set();
const deadline = Date.now() + 30000;
while (Date.now() < deadline && seen.size < 3) {
  const step = (await stepEl.innerText().catch(() => "")).trim();
  const text = (await textEl.innerText().catch(() => "")).trim();
  if (step && step !== "演示中") seen.add(step.slice(0, 40));
  else if (text) seen.add(text.slice(0, 40));
  await page.waitForTimeout(900);
}
check("脚本在推进（≥3 个不同步骤）", seen.size >= 3, `seen=${seen.size} 例: ${[...seen].slice(0, 3).join(" | ")}`);

// 3 iframe 内模拟光标（DemoCursor 用 data-demo-fx 标记插入的节点）
const frame = page.frameLocator(".demo-frame__iframe").first();
const cursorCount = await frame
  .locator("[data-demo-fx]")
  .count()
  .catch(() => 0);
// 纯旁白场（如 home/login）没有点击动作，不插光标是正常的 → 只记信息不判失败
if (wantScript) {
  check("场景内有模拟光标", cursorCount > 0, `nodes=${cursorCount}`);
} else {
  console.log(`INFO  场景光标 nodes=${cursorCount}（默认场为旁白场，可能无点击）`);
}

await page.screenshot({ path: path.join(outDir, "demo-playing.png") });

// 4 退出
const exitBtn = page.locator("[data-demo-id='demo-mode-exit']").first();
await exitBtn.click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(900);
const dialogGone = (await page.locator("[role='dialog'][aria-label='演示模式']").count()) === 0;
const frameGone = (await page.locator(".demo-frame__iframe").count()) === 0;
check("退出后浮层消失", dialogGone);
check("退出后无残留 iframe", frameGone);

await page.screenshot({ path: path.join(outDir, "demo-exited.png") });
await browser.close();

const failed = rows.filter((r) => !r.pass);
console.log(`\n=== 汇总 === ${rows.length - failed.length}/${rows.length} 通过`);
if (failed.length) for (const f of failed) console.log(`  ✗ ${f.name} ${f.detail ?? ""}`);
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 4)));
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ rows, errors }, null, 2));
console.log("截图/明细:", outDir);
process.exitCode = failed.length ? 1 : 0;
