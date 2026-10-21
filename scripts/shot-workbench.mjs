/**
 * 操作台视觉取证：拖拽三段式（跟手 → 吸附 → 倒入/拒收）+ UI 精简效果。
 *
 * 用法：$env:BASE_URL="http://localhost:3002"; node scripts/shot-workbench.mjs [expId]
 * 输出：%TEMP%\chemlab-shots\workbench-<stamp>\*.png
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clickOp, loginStudent } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const expId = (process.argv[2] ?? "exp01").toLowerCase();
/** --advance=N：拖拽前先按建议动作推进 N 步（找一步真正接受试剂的，才能看到倒入动画） */
const advanceArg = process.argv.find((a) => a.startsWith("--advance="));
const advance = advanceArg ? Number(advanceArg.split("=")[1]) || 0 : 0;
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const outDir = path.join(os.tmpdir(), "chemlab-shots", `workbench-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));

await loginStudent(page, { base });
await page.goto(`${base}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const shot = async (name) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log("shot:", name);
};

await shot("01-initial");

// 可选：先推进 N 步，落到"接受试剂"的那一步
for (let i = 0; i < advance; i += 1) {
  const next = page.locator("[data-demo-id^='demo-op-']:visible").first();
  if (!(await next.count())) break;
  const clicked = await clickOp(page, next);
  if (!clicked) break;
  await page.waitForTimeout(700);
  console.log(`推进 ${i + 1}/${advance}`);
}
if (advance) await shot("01b-advanced");

// ---- 拖拽三段式 ----
const reagent = page.locator("[data-demo-id^='demo-scene-reagent-']").first();
const flask = page.locator("[data-demo-id='demo-scene-drop-flask']").first();
const hasDrag = (await reagent.count()) > 0 && (await flask.count()) > 0;

if (hasDrag) {
  const rb = await reagent.boundingBox();
  const fb = await flask.boundingBox();
  if (rb && fb) {
    // 段 1：按下并拖到热区上方（跟手 + 热区高亮）
    await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
    await page.mouse.down();
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2, { steps: 12 });
    await page.waitForTimeout(120);
    await shot("02-dragging"); // 热区高亮 + 跟手
    // 段 2/3：松手 → 吸附 160ms → 倒入 700ms
    await page.mouse.up();
    await page.waitForTimeout(180);
    await shot("03-snap-pour"); // 吸附瞬间 / 倒入中
    await page.waitForTimeout(900);
    await shot("04-pour-done"); // 倒入完成 + 正反馈
  }
} else {
  console.log("（该实验无拖拽控件，跳过拖拽取证）");
}

// ---- 成功一档 ----
const okOp = page.locator("[data-demo-id^='demo-op-']:visible").first();
if (await okOp.count()) {
  await clickOp(page, okOp);
  await page.waitForTimeout(420);
  await shot("05-success");
}

// ---- 失败一档（拒收/事故）----
await page.waitForTimeout(600);
const trap = page.locator("[data-demo-id^='demo-op-']").nth(1);
if ((await trap.count()) > 0) {
  const before = page.url();
  await clickOp(page, trap);
  await page.waitForTimeout(500);
  await shot("06-fail");
  if (page.url() !== before) console.log("注意：失败操作后发生了跳转");
}

await shot("07-final");
await browser.close();
console.log(`\n输出目录：${outDir}`);
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 4)));
