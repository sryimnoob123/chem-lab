import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = "http://127.0.0.1:3001";
const OUT = join(tmpdir(), "chemlab-shots", "demo-final");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});

const shot = async (name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
};

await page.goto(`${BASE}/experiments`, { waitUntil: "domcontentloaded" });
await shot("01-实验列表");

for (const [exp, label] of [["exp01", "02-exp01"], ["exp03", "04-exp03"], ["exp09", "06-exp09"]]) {
  await page.goto(`${BASE}/exp/${exp}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  for (let i = 0; i < 6; i++) {
    const more = await page.evaluate(() => {
      const b = document.querySelector("[data-demo-id='demo-onboarding-next']");
      if (!b) return false;
      b.click(); return true;
    });
    await page.waitForTimeout(200);
    if (!more) break;
  }
  await shot(label);
}

// exp09 倒入动画
await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
for (let i = 0; i < 6; i++) {
  const more = await page.evaluate(() => {
    const b = document.querySelector("[data-demo-id='demo-onboarding-next']");
    if (!b) return false;
    b.click(); return true;
  });
  await page.waitForTimeout(200);
  if (!more) break;
}
const geom = await page.evaluate(() => {
  const naoh = [...document.querySelectorAll('[data-demo-id^="demo-scene-reagent"]')].find((n) => /NaOH|氢氧化钠/.test(n.textContent ?? ""));
  const flask = document.querySelector('[data-demo-id="demo-scene-drop-flask"]');
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  return { naoh: box(naoh), flask: box(flask) };
});
if (geom.naoh && geom.flask) {
  const sx = geom.naoh.x + geom.naoh.w / 2, sy = geom.naoh.y + geom.naoh.h / 2;
  const tx = geom.flask.x + geom.flask.w / 2, ty = geom.flask.y + geom.flask.h / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(sx + ((tx - sx) * i) / 10, sy + ((ty - sy) * i) / 10); await page.waitForTimeout(18); }
  await page.mouse.up();
  await page.waitForTimeout(560);
  await page.screenshot({ path: join(OUT, "07-exp09-倒液.png") });
  await page.waitForTimeout(1600);
}

// 交卷 + 报告
await page.locator('[data-demo-id="demo-finish"]').first().click({ timeout: 5000 }).catch(() => undefined);
await page.waitForURL(/\/report/, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(1400);
await shot("08-报告页");

// 教师端
await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
await shot("09-教师后台");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await shot("10-首页");

await browser.close();
console.log("shots:", OUT);
