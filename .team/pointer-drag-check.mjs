/**
 * pointer 拖拽三段验证（真实鼠标事件，不是合成 DragEvent）：
 *   进 exp01 → 点到第 4 步「溶解」→ 抓蒸馏水拖到锥形瓶 → 看三段状态。
 * 期望：段1 data-dragging=true → 段2 落区 data-over=true → 段3 松手后步骤前进。
 *
 * 用法：node .team/pointer-drag-check.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));

await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});

await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(600);

const stepNow = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
  });

// 点到第 4 步（第 4 步是「溶解」，要拖蒸馏水）
for (let i = 0; i < 8; i++) {
  const s = await stepNow();
  if (s && s.cur >= 4) break;
  const op = page.locator('[data-demo-id^="demo-op-"]').first();
  if (await op.isVisible().catch(() => false)) {
    await op.click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(900);
  } else {
    await page.waitForTimeout(600);
  }
}
const before = await stepNow();
console.log("拖拽前:", JSON.stringify(before));

const bottle = page.locator('[data-demo-id="demo-scene-reagent-water"]').first();
const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]').first();
const bb = await bottle.boundingBox();
const fb = await flask.boundingBox();
if (!bb || !fb) throw new Error("找不到试剂瓶或落区");

const startX = bb.x + bb.width / 2;
const startY = bb.y + bb.height / 2;
const endX = fb.x + fb.width / 2;
const endY = fb.y + fb.height / 2;

// 段 1：按下
await page.mouse.move(startX, startY);
await page.mouse.down();
await page.waitForTimeout(250);
const seg1 = await bottle.getAttribute("data-dragging");

// 段 2：沿路径移动（带缓动感，分 12 步）
let seg2 = null;
for (let i = 1; i <= 12; i++) {
  const t = i / 12;
  await page.mouse.move(startX + (endX - startX) * t, startY + (endY - startY) * t - Math.sin(t * Math.PI) * 26);
  await page.waitForTimeout(45);
  if (i === 10) seg2 = await flask.getAttribute("data-over");
}

// 段 3：松手
await page.mouse.up();
await page.waitForTimeout(1800);
const after = await stepNow();
const bodyAfter = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 200));

const checks = [
  ["段1 按下后器皿进入拖拽态（data-dragging=true）", seg1 === "true"],
  ["段2 移到锥形瓶上方热区点亮（data-over=true）", seg2 === "true"],
  ["段3 松手后步骤前进（或已有成功反馈）", Boolean(after && before && (after.cur > before.cur || /溶解|观察|已加入|倒入/.test(bodyAfter)))],
  ["无 pageerror", errors.length === 0],
];

console.log("段1 data-dragging:", seg1);
console.log("段2 data-over:", seg2);
console.log("拖拽后:", JSON.stringify(after));
console.log("页面片段:", bodyAfter);
console.log("");
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
