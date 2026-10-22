import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const BASE = "http://127.0.0.1:3001";
const OUT = join(tmpdir(), "chemlab-shots", "fly-bottle");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${BASE}/api/session`, { headers: { "content-type": "application/json" }, data: { studentNo: "20250101", name: "周若曦" } });
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);
await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
await page.waitForTimeout(500);

async function guideText() {
  return await page.evaluate(() => document.querySelector("[data-demo-id='demo-guide-card']")?.textContent ?? "");
}
// 推进到含"蒸馏水/溶解"的步骤
for (let i = 0; i < 9; i++) {
  const g = await guideText();
  if (/蒸馏水|溶解|定容|稀释/.test(g)) { console.log("到达目标步:", g.slice(0, 60)); break; }
  const m = g.match(/按\s*(\d)/);
  const key = m ? m[1] : "1";
  await page.keyboard.press(key);
  await page.waitForTimeout(1500);
  const g2 = await guideText();
  if (g2 === g) {
    // 按键没推进，试点第一个可见的正确动作按钮
    const btn = page.locator('[data-demo-id^="demo-op-"]').first();
    if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}
const g = await guideText();
console.log("当前步骤:", g.slice(0, 70));
const inv = await page.evaluate(() => ({
  reagents: [...document.querySelectorAll('[data-demo-id^="demo-scene-reagent"]')].map((el) => el.getAttribute("data-demo-id")),
  vessels: [...document.querySelectorAll('[data-demo-id^="demo-scene-vessel"]')].map((el) => el.getAttribute("data-demo-id")),
}));
console.log("架:", JSON.stringify(inv));

const srcId = inv.reagents.find((r) => r.includes("water")) ?? inv.reagents[0];
const src = srcId ? await page.locator(`[data-demo-id="${srcId}"]`).first().boundingBox().catch(() => null) : null;
const vId = inv.vessels.find((v) => v.includes("beaker")) ?? inv.vessels[0];
const vessel = vId ? await page.locator(`[data-demo-id="${vId}"]`).first().boundingBox().catch(() => null) : null;
console.log("拖", srcId, "->", vId, JSON.stringify(src), JSON.stringify(vessel));

if (src && vessel) {
  const sx = src.x + src.width / 2, sy = src.y + src.height / 2;
  const tx = vessel.x + vessel.width / 2, ty = vessel.y + vessel.height / 2 - 20;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12); await page.waitForTimeout(25); }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(380);
  const mid = await page.evaluate(() => {
    const fly = document.querySelector("[data-pour-bottle]");
    let box = null, transform = null;
    if (fly) { const r = fly.getBoundingClientRect(); box = { x: Math.round(r.x), y: Math.round(r.y) }; transform = getComputedStyle(fly).transform; }
    return { hasFly: !!fly, box, transform, drops: document.querySelectorAll("[data-pour-drop]").length };
  });
  console.log("倾倒中:", JSON.stringify(mid));
  await page.screenshot({ path: join(OUT, "pour-mid.png") });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "pour-after.png") });
  const after = await guideText();
  console.log("倒完步骤:", after.slice(0, 70));
  console.log("shots:", OUT);
}
await browser.close();
