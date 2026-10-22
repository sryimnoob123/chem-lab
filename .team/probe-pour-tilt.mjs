/** 精确验证倒入动画：只采「倾倒窗口」，断言液柱从瓶口竖直流到液面。 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = "http://localhost:3000";
const OUT = join(tmpdir(), "chemlab-shots", "pour-tilt");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));

await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector('[data-demo-id="demo-guide-card"]', { timeout: 30000 });
await page.waitForTimeout(400);

for (let i = 0; i < 6; i++) {
  const more = await page.evaluate(() => {
    const b = document.querySelector("[data-demo-id='demo-onboarding-next']");
    if (!b) return false;
    b.click();
    return true;
  });
  await page.waitForTimeout(220);
  if (!more) break;
}

const state = () =>
  page.evaluate(() => ({
    ops: [...document.querySelectorAll('[data-demo-id^="demo-op-"]')].map((b) => b.getAttribute("data-demo-id")),
    next: document.querySelector("[data-guide='next']")?.getAttribute("data-demo-id") ?? null,
  }));
const clickOp = (id) =>
  page.evaluate((domId) => {
    const b = document.querySelector(`[data-demo-id="${domId}"]`);
    if (b instanceof HTMLElement) b.click();
  }, id);

for (let i = 0; i < 16; i++) {
  const s = await state();
  if (s.next && /dissolve|dilute|water/.test(s.next)) break;
  const pick = s.next ?? s.ops.find((id) => /check|rinse|dry/.test(id));
  if (!pick) break;
  await clickOp(pick);
  await page.waitForTimeout(1400);
}

const geom = await page.evaluate(() => {
  const water = [...document.querySelectorAll('[data-demo-id^="demo-scene-reagent"]')].find((n) => /水/.test(n.textContent ?? ""));
  const flask = document.querySelector('[data-demo-id="demo-scene-drop-flask"]');
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  return { water: box(water), flask: box(flask) };
});

await page.evaluate(() => {
  window.__pour = [];
  const t0 = performance.now();
  const sample = () => {
    const bottle = document.querySelector("[data-pour-bottle]");
    const stream = document.querySelector("[data-pour-stream]");
    if (bottle && stream) {
      const b = bottle.getBoundingClientRect();
      const neckEl = bottle.querySelector("[class*='pourBottleNeck']");
      const n = neckEl?.getBoundingClientRect();
      const s = stream.getBoundingClientRect();
      const drops = [...document.querySelectorAll("[data-pour-drop]")].map((d) => {
        const r = d.getBoundingClientRect();
        return { cx: r.x + r.width / 2, top: r.y, bottom: r.y + r.height, o: Number(getComputedStyle(d).opacity) };
      });
      window.__pour.push({
        t: Math.round(performance.now() - t0),
        body: { top: b.y, bottom: b.y + b.height },
        neck: n ? { cx: n.x + n.width / 2, top: n.y, bottom: n.y + n.height } : null,
        stream: { cx: s.x + s.width / 2, top: s.y, bottom: s.y + s.height, h: s.height, o: Number(getComputedStyle(stream).opacity) },
        drops,
      });
    }
    if (performance.now() - t0 < 1500) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});

const sx = geom.water.x + geom.water.w / 2;
const sy = geom.water.y + geom.water.h / 2;
const tx = geom.flask.x + geom.flask.w / 2;
const ty = geom.flask.y + geom.flask.h / 2;
await page.mouse.move(sx, sy);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(sx + ((tx - sx) * i) / 10, sy + ((ty - sy) * i) / 10);
  await page.waitForTimeout(18);
}
await page.mouse.up();

// 300ms 飞到位；420ms 倾转完成；520ms 液柱生长；700ms 液柱最长
for (const [wait, tag] of [[300, "1-fly"], [150, "2-tilt"], [140, "3-stream"], [140, "4-stream-full"]]) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(OUT, `shot-${tag}.png`) });
}
await page.waitForTimeout(1600);

const samples = await page.evaluate(() => window.__pour);
const pouring = samples.filter((s) => s.stream.o > 0.35 && s.t > 300);
console.log("总帧:", samples.length, "液柱可见帧:", pouring.length);
if (pouring.length) {
  const first = pouring[0];
  const last = pouring[pouring.length - 1];
  const neckCx = first.neck.cx;
  const streamOff = pouring.map((s) => Math.abs(s.stream.cx - s.neck.cx));
  const dropOff = pouring.flatMap((s) => s.drops.filter((d) => d.o > 0.2).map((d) => Math.abs(d.cx - s.neck.cx)));
  const streamHeights = pouring.map((s) => s.stream.h);
  const neckAboveStreamTop = pouring.filter((s) => s.neck.bottom > s.stream.top + 4).length;
  const streamGaps = pouring.filter((s) => s.stream.h < 20).length;
  const neckAboveBody = pouring.filter((s) => s.neck.bottom < s.body.top + (s.body.bottom - s.body.top) * 0.5).length;

  console.log("瓶口 x:", neckCx.toFixed(1));
  console.log("液柱与瓶口最大水平偏差:", Math.max(...streamOff).toFixed(1), "px");
  console.log("液滴与瓶口最大水平偏差:", dropOff.length ? Math.max(...dropOff).toFixed(1) : "-", "px");
  console.log("液柱高度范围:", Math.min(...streamHeights).toFixed(0), "~", Math.max(...streamHeights).toFixed(0), "px");
  console.log("液柱过短(<20px)帧:", streamGaps);
  console.log("瓶口在瓶身下半区帧:", pouring.length - neckAboveBody, "/", pouring.length);
  console.log("液柱起止:", first.stream.top.toFixed(0), "->", last.stream.bottom.toFixed(0), "| 瓶口:", first.neck.bottom.toFixed(0));
  console.log("窗口:", first.t, "~", last.t, "ms");
}
console.log("errors:", errors);
console.log("shots:", OUT);
await browser.close();
