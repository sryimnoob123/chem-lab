/**
 * 调试 exp09 第 2 步拖拽：拖完 dump 状态与文案，定位 accept 是否触发。
 * 用法：node .team/debug-exp09-drag.mjs
 */
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e.message).slice(0, 200)));

await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});

await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(600);

const stepNow = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
  });

// 走到第 2 步
for (let i = 0; i < 8; i++) {
  const s = await stepNow();
  if (s && s.cur >= 2) break;
  const op = page.locator('[data-demo-id^="demo-op-"]').first();
  if (await op.isVisible().catch(() => false)) {
    await op.click().catch(() => undefined);
    await page.waitForTimeout(900);
  } else await page.waitForTimeout(500);
}

console.log("到第 2 步:", JSON.stringify(await stepNow()));
const ids = await page.evaluate(() =>
  [...document.querySelectorAll("[data-demo-id]")].map((el) => el.getAttribute("data-demo-id")),
);
console.log("可用 demo-id:", JSON.stringify(ids.filter((i) => i?.startsWith("demo-op") || i?.includes("reagent") || i?.includes("drop"))));

const bottle = page.locator('[data-demo-id="demo-scene-reagent-hcl"]').first();
const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]').first();
const bb = await bottle.boundingBox();
const fb = await flask.boundingBox();
console.log("bottle:", JSON.stringify(bb), "flask:", JSON.stringify(fb));

const sx = bb.x + bb.width / 2;
const sy = bb.y + bb.height / 2;
const ex = fb.x + fb.width / 2;
const ey = fb.y + fb.height / 2;

await page.mouse.move(sx, sy);
await page.mouse.down();
await page.waitForTimeout(250);
console.log("按下后 dragging:", await bottle.getAttribute("data-dragging"));

for (let i = 1; i <= 12; i++) {
  const t = i / 12;
  await page.mouse.move(sx + (ex - sx) * t, sy + (ey - sy) * t - Math.sin(t * Math.PI) * 26);
  await page.waitForTimeout(45);
}
console.log("移到最后 over:", await flask.getAttribute("data-over"));
console.log("移到最后 dragging:", await bottle.getAttribute("data-dragging"));

await page.mouse.up();
await page.waitForTimeout(2000);

console.log("松手后步骤:", JSON.stringify(await stepNow()));
const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
console.log("松手后文案:", text.slice(0, 600));
await browser.close();
