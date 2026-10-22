/**
 * 事故 L1~L4 视觉分级预览：四级各截一张全屏 + 一张只截事故条的放大图，
 * 再加一张「抖动中间帧」证明幅度递增。
 * 产物：%TEMP%\chemlab-shots\preview-incident-levels\
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const OUT = join(tmpdir(), "chemlab-shots", "preview-incident-levels");
mkdirSync(OUT, { recursive: true });

const TRAPS = [
  { exp: "exp01", op: "demo-op-step1-wipe", level: "L1", name: "纸巾擦容量瓶内壁" },
  { exp: "exp01", op: "demo-op-step1-oven", level: "L2", name: "容量瓶进 105℃ 烘箱" },
  { exp: "exp09", op: "demo-op-step1-bare-hands", level: "L3", name: "徒手抓 NaOH" },
  { exp: "exp03", op: "demo-op-step1-open", level: "L4", name: "敞口量冰醋酸并加水" },
];

const browser = await chromium.launch();
const report = [];

for (const t of TRAPS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
  await page.goto(`${BASE}/exp/${t.exp}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  const other = page.locator('[data-demo-id="demo-other-ways"]').first();
  if (await other.isVisible().catch(() => false)) {
    await other.click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
  const trap = page.locator(`[data-demo-id="${t.op}"]`).first();
  if (await trap.isVisible().catch(() => false)) {
    await trap.click({ timeout: 4000 }).catch(() => undefined);
  }

  // 动画中间帧：入場后 ~180ms 抓一帧，此时位移最大
  await page.waitForTimeout(180);
  const midFrame = await page.evaluate(() => {
    const b = document.querySelector("[data-level]");
    if (!b) return null;
    const m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
    return { level: b.getAttribute("data-level"), translateX: Math.round(m.m41 * 10) / 10 };
  });
  // 等动画结束再截正式图
  await page.waitForTimeout(1400);

  const info = await page.evaluate(() => {
    const b = document.querySelector("[data-level]");
    if (!b) return null;
    const s = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const icon = b.querySelector("[data-icon]");
    return {
      level: b.getAttribute("data-level"),
      height: Math.round(r.height),
      bg: s.backgroundColor,
      borderLeft: s.borderLeftColor,
      animName: s.animationName,
      animDur: s.animationDuration,
      iconText: icon ? (icon.textContent ?? "").trim() : "无",
      iconSize: icon ? Math.round(icon.getBoundingClientRect().width) : 0,
    };
  });

  const full = join(OUT, `${t.level}-full.png`);
  await page.screenshot({ path: full });
  const box = await page.locator("[data-level]").first().boundingBox().catch(() => null);
  let strip = null;
  if (box) {
    strip = join(OUT, `${t.level}-strip.png`);
    await page.screenshot({
      path: strip,
      clip: { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: Math.min(1440, box.width + 24), height: Math.min(900, box.height + 24) },
    });
  }
  report.push({ ...t, ...info, midFrame, full, strip });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
