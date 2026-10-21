/** 调试 exp09 第 5 步（加酚酞）拖拽落区：打印该步落区 id 与命中元素。 */
import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
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

for (let i = 0; i < 20; i++) {
  const s = await stepNow();
  if (s && s.cur >= 5) break;
  const op = page.locator('[data-demo-id^="demo-op-"]').first();
  if (await op.isVisible().catch(() => false)) {
    await op.click().catch(() => undefined);
    await page.waitForTimeout(900);
  } else {
    const next = page.getByRole("button", { name: /下一步|观察/ }).first();
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => undefined);
    await page.waitForTimeout(600);
  }
}
console.log("步骤:", JSON.stringify(await stepNow()));
console.log(
  "落区 id:",
  JSON.stringify(
    await page.evaluate(() =>
      [...document.querySelectorAll("[data-demo-id*='drop']")].map((el) => ({
        id: el.getAttribute("data-demo-id"),
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
      })),
    ),
  ),
);
const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]').first();
const fb = await flask.boundingBox().catch(() => null);
console.log("flask box:", JSON.stringify(fb));
if (fb) {
  const cx = fb.x + fb.width / 2;
  const cy = fb.y + fb.height / 2;
  console.log(
    "中心点命中:",
    await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName}.${el.className?.toString().slice(0, 60)} [${el.getAttribute("data-demo-id")}]` : "null";
      },
      [cx, cy],
    ),
  );
}
const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
console.log("页面文案:", text.slice(0, 500));
await browser.close();
