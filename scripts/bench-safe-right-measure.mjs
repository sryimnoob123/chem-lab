/**
 * 右侧安全边 A/B 实测（2026-10-23）
 *
 * 为什么只能量：右栏（任务看板 / 错误演示）是浮在台面上的 HTML 卡（absolute + 固定 px 宽），
 * 台面是等比缩放的 SVG，两者之间没有布局关系。
 *
 * 改前/改后怎么来的（不做二次构建，在同一张页面上还原几何）：
 *   - 改后 = 直接量 DOM（[data-rail] 左沿、托盘右沿、最右器皿右沿）；
 *   - 改前 = 把**这一处改动施加的位移原样撤掉**：托盘回到 bench-layout.ts 的满宽 650，
 *            器皿右沿加上台面报告的 data-layout-dx（viewBox 单位）后换算回 px。
 *   两者都换算成「对右栏左沿的 px 差」，负值 = 留出净空。
 *
 * 用法：node scripts/bench-safe-right-measure.mjs [--url=http://localhost:3001] [--shots=false]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);
const BASE = args.url ?? "http://localhost:3001";
const SHOTS = args.shots !== "false";
const OUT = path.join(process.env.TEMP ?? process.env.TMPDIR ?? ".", "chemlab-shots", "safe-right");

/** 满宽托盘右沿（viewBox 单位）= BENCH.tray.x + w，由 bench-layout.test.ts 一起锁住 */
const FULL_TRAY_RIGHT = 640 + 650;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1152, height: 720 },
  { width: 1024, height: 700 },
];

const IDS = ["beaker", "tube-a", "tube-b", "volumetric", "flask"];

const read = ({ ids, fullTrayRight }) => {
  const rail = document.querySelector('[aria-label="操作面板"]');
  const tray = document.querySelector('[data-demo-id="demo-tool-tray"]');
  /* 取台面那只 SVG（页面里还有一堆图标 svg 也带 viewBox，第一个不是它） */
  const svg = document.querySelector("[data-safe-right] svg");
  const stage = document.querySelector("[data-safe-right]");
  if (!rail || !tray || !svg) return null;
  const sb = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const scale = sb.width / vb.width;
  const railLeft = rail.getBoundingClientRect().left;
  const dx = Number(stage?.getAttribute("data-layout-dx") || 0);
  const px = (units) => sb.left + (units - vb.x) * scale;

  const vessels = ids
    .map((id) => {
      const el = document.querySelector(`[data-demo-id="demo-scene-vessel-${id}"]`);
      return el ? { id, right: el.getBoundingClientRect().right } : null;
    })
    .filter(Boolean)
    .map((v) => ({
      id: v.id,
      after: Math.round(v.right - railLeft),
      before: Math.round(v.right - dx * scale - railLeft),
    }));

  return {
    dx,
    safeRight: stage?.getAttribute("data-safe-right") ?? "",
    tray: {
      after: Math.round(tray.getBoundingClientRect().right - railLeft),
      before: Math.round(px(fullTrayRight) - railLeft),
    },
    vessels,
  };
};

const browser = await chromium.launch();
if (SHOTS) mkdirSync(OUT, { recursive: true });
const rows = [];
let fails = 0;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => {
      const n = document.querySelector('[data-vessel-id="volumetric"]');
      return Boolean(n && Object.keys(n).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(500);
  const m = await page.evaluate(read, { ids: IDS, fullTrayRight: FULL_TRAY_RIGHT });
  if (!m) {
    console.log(`${vp.width}: 读不到台面/右栏，跳过`);
    fails += 1;
    await page.close();
    continue;
  }
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `${vp.width}.png`) });

  const worst = (k) => Math.max(...m.vessels.map((v) => v[k]));
  const pass = m.tray.after <= -6 && worst("after") <= -2;
  if (!pass) fails += 1;
  rows.push({
    vp: `${vp.width}×${vp.height}`,
    m,
    worstBefore: worst("before"),
    worstAfter: worst("after"),
    pass,
  });
  await page.close();
}

await browser.close();
console.log("viewport     | 托盘越界 改前→改后 | 最右器皿越界 改前→改后 | 器皿位移 | safeRight | 判定");
for (const r of rows) {
  console.log(
    `${r.vp.padEnd(12)} | ${String(r.m.tray.before).padStart(4)}px → ${String(r.m.tray.after).padStart(4)}px      | ` +
      `${String(r.worstBefore).padStart(5)}px → ${String(r.worstAfter).padStart(5)}px      | ` +
      `${r.m.dx} 单位 | ${r.m.safeRight || "-"} | ${r.pass ? "✓" : "✗"}`,
  );
}
console.log("\n负值 = 在右栏左沿之外（留出净空）。容器 < 900px 时右栏挪到台面下方，不在本次范围。");
console.log(`截图：${OUT}`);
process.exit(fails === 0 ? 0 : 1);
