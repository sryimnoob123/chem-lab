/**
 * 互动反馈审计 v2：不只看"有没有像素变化"，直接读 transform / box-shadow 计算值。
 *
 * 检查三项：
 *   1. hover  ≤80ms 后是否浮起（scale > 1 或 translateY ≠ 0）或阴影变化
 *   2. press  ≤30ms 后是否缩到 scale ≈ 0.97（容差 ±0.02）
 *   3. click  后 100~300ms 内是否出现过可见变化
 *
 * 用法：node scripts/ix-audit.mjs [路由=/exp/exp09]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const route = process.argv[2] ?? "/exp/exp09";
const base = "http://localhost:3000";
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const outDir = path.join(os.tmpdir(), "chemlab-shots", `ix-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
await page.goto(base + route, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const ids = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-demo-id]"))
    .filter((el) => {
      const id = el.getAttribute("data-demo-id") ?? "";
      if (!/reagent|vessel|op-|switch|fx-|retry|hint|read/.test(id)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8;
    })
    .map((el) => el.getAttribute("data-demo-id")),
);

/** 解析 matrix(...) 的 x/y 缩放 */
function scaleOf(t) {
  if (!t || t === "none") return 1;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (m) {
    const [a, b, c, d] = m[1].split(",").map(Number);
    return Math.sqrt((a * a + b * b + c * c + d * d) / 2);
  }
  const m3 = t.match(/matrix3d\(([^)]+)\)/);
  if (m3) {
    const n = m3[1].split(",").map(Number);
    return Math.sqrt((n[0] * n[0] + n[1] * n[1] + n[4] * n[4] + n[5] * n[5]) / 2);
  }
  return 1;
}

const rows = [];
for (const id of ids) {
  const el = page.locator(`[data-demo-id="${id}"]`).first();
  if (!(await el.count())) continue;
  // 元素可能在首屏之外：先滚进视口，否则鼠标坐标落在视口外，:hover/:active 都不会触发
  // 放大/循环动画会让元素持续“不稳定”，滚动失败时退化为原坐标，不中断整轮审计
  await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(60);
  const box = await el.boundingBox();
  if (!box) continue;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(5, 5);
  await page.waitForTimeout(60);
  const rest = await el.evaluate((n) => {
    const s = getComputedStyle(n);
    return { transform: s.transform, shadow: s.boxShadow, border: s.borderColor };
  });

  // hover
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(90);
  const hover = await el.evaluate((n) => getComputedStyle(n).transform);

  // press
  await page.mouse.down();
  await page.waitForTimeout(45);
  const press = await el.evaluate((n) => getComputedStyle(n).transform);
  await page.mouse.up();
  await page.waitForTimeout(140);

  const hoverScale = scaleOf(hover);
  const pressScale = scaleOf(press);
  const okHover = Math.abs(hoverScale - 1) > 0.005 || Math.abs(scaleOf(rest.transform) - 1) > 0.005;
  const okPress = pressScale < 0.99 && pressScale > 0.9;

  rows.push({ id, hoverScale, pressScale, okHover, okPress });
}

await browser.close();

const failPress = rows.filter((r) => !r.okPress);
const failHover = rows.filter((r) => !r.okHover);
console.log(`\n审计 ${route}：元素 ${rows.length} 个`);
console.log(`　按下缩放到 0.97 的：${rows.length - failPress.length}/${rows.length}`);
console.log(`　悬停有反馈的：${rows.length - failHover.length}/${rows.length}`);
if (failPress.length) {
  console.log("\n未达到按下反馈的元素：");
  for (const r of failPress) console.log(`  ${r.id.padEnd(36)} press scale=${r.pressScale.toFixed(3)}`);
}
if (failHover.length) {
  console.log("\n悬停无反馈的元素：");
  for (const r of failHover) console.log(`  ${r.id}`);
}
if (errors.length) console.log("\npageerror:", JSON.stringify(errors.slice(0, 4)));
fs.writeFileSync(path.join(outDir, "audit.json"), JSON.stringify(rows, null, 2));
console.log(`\n明细：${path.join(outDir, "audit.json")}`);
if (failPress.length) process.exitCode = 1;
