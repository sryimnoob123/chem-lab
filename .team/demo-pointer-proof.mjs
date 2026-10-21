/**
 * 确认演示路径（/demo?autoplay=1 的 iframe 内）确实派发 pointer 事件链。
 * 同时收集 console（看是否有「[demo] 拖拽缺少落点」这类跳过）。
 * 用法：node .team/demo-pointer-proof.mjs
 */
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const logs = [];
page.on("console", (m) => {
  const t = m.text();
  if (t.includes("[demo]") || m.type() === "error") logs.push(`${m.type()}: ${t.slice(0, 160)}`);
});

await page.addInitScript(() => {
  window.__ptr = { down: 0, move: 0, up: 0, drag: 0 };
  for (const type of ["pointerdown", "pointermove", "pointerup"]) {
    document.addEventListener(
      type,
      () => {
        const key = type.replace("pointer", "");
        window.__ptr[key] = (window.__ptr[key] ?? 0) + 1;
      },
      true,
    );
  }
  document.addEventListener("dragstart", () => (window.__ptr.drag += 1), true);
});

await page.goto(`${BASE}/demo?autoplay=1`, { waitUntil: "domcontentloaded" });

// 等演示走过第 2 步的拖拽（约 30~50s），给足 100s
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(10000);
  const frames = page.frames();
  let moves = 0;
  for (const f of frames) {
    try {
      const c = await f.evaluate(() => window.__ptr ?? null);
      moves += c?.move ?? 0;
    } catch {
      /* 跨域跳过 */
    }
  }
  if (i === 4 && moves === 0) console.log("[40s] pointermove 还是 0，继续观察…");
  if (moves > 20) break;
}

const counts = [];
for (const frame of page.frames()) {
  try {
    const c = await frame.evaluate(() => window.__ptr ?? null);
    if (c) counts.push({ url: frame.url().slice(-44), ...c });
  } catch {
    /* 跨域跳过 */
  }
}

await browser.close();
console.log("各 frame 的 pointer 计数：");
for (const c of counts) console.log(JSON.stringify(c));
console.log("\nconsole:", logs.slice(0, 6));

const downs = counts.reduce((a, c) => a + (c.down ?? 0), 0);
const moves = counts.reduce((a, c) => a + (c.move ?? 0), 0);
const ups = counts.reduce((a, c) => a + (c.up ?? 0), 0);
console.log(`\n合计 pointerdown=${downs} pointermove=${moves} pointerup=${ups}`);
const ok = downs > 0 && moves > 0 && ups > 0;
console.log(ok ? "✅ 演示走的是 pointer 事件链（down→move→up）" : "❌ 没看到完整 pointer 链");
process.exit(ok ? 0 : 1);
