/**
 * 金属件「有没有渐变 / 有没有边缘高光」实测（B3 的 A/B 证据）
 *
 * 金属最难量化的一点：平涂和渐变在**截图缩略图**里几乎一样，只有把像素扫出来才看得出。
 * 所以这里对每个金属件取两条扫描线（横 = 左右明暗，竖 = 上下明暗），
 * 输出 min / median / max / spread（= max-min，平涂贴 0，有渐变才会拉开）。
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:3000 OUT=<json> node scripts/metal-layers-measure.mjs
 *   SHOT=<png 路径> 同时落一张 1440×900 整屏截图（改前 / 改后各一次，肉眼复核）。
 *
 * 亮度口径：L = 0.2126R + 0.7152G + 0.0722B（0..255）。纸白台面 ≈ 246。
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT =
  process.env.OUT ?? path.join(os.tmpdir(), "chemlab-shots", "metal-layers.json");
const SHOT = process.env.SHOT ?? null;
const DPR = Number(process.env.DPR ?? 2);

/** data-metal 是给本脚本用的稳定抓手，和渲染无关 */
const PARTS = ["balance-base", "balance-column", "balance-pan", "balance-screen", "tray-base"];

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const browser = await chromium.launch();
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR })
).newPage();
await page.goto(BASE + "/exp/exp01?force=1", { waitUntil: "networkidle" });
await page.waitForFunction(
  () => Boolean(document.querySelector("[data-metal='balance-base']")),
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(900);

const shot = await page.screenshot(SHOT ? { path: SHOT } : undefined);
const rects = await page.evaluate(
  (parts) =>
    Object.fromEntries(
      parts.map((p) => {
        const el = document.querySelector(`[data-metal='${p}']`);
        if (!el) return [p, null];
        const r = el.getBoundingClientRect();
        return [p, { x: r.x, y: r.y, w: r.width, h: r.height }];
      }),
    ),
  PARTS,
);
await browser.close();

const result = { base: BASE, dpr: DPR, at: new Date().toISOString(), parts: {} };
const table = [];

for (const part of PARTS) {
  const r = rects[part];
  if (!r) {
    result.parts[part] = null;
    continue;
  }
  const pad = 1; // 把描边一起圈进来（描边是"边沿"的一半证据）
  const left = Math.max(0, Math.round((r.x - pad) * DPR));
  const top = Math.max(0, Math.round((r.y - pad) * DPR));
  const width = Math.min(Math.round((r.w + pad * 2) * DPR), 1440 * DPR - left);
  const height = Math.min(Math.round((r.h + pad * 2) * DPR), 900 * DPR - top);

  const { data, info } = await sharp(shot)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = (x, y) => {
    const i = (Math.min(y, info.height - 1) * info.width + Math.min(x, info.width - 1)) * info.channels;
    return Number(lum(data[i], data[i + 1], data[i + 2]).toFixed(1));
  };

  /** 一条扫描线：返回亮度序列与统计量 */
  const scanLine = (points) => {
    const strip = points.map(([x, y]) => px(x, y));
    const sorted = [...strip].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return {
      min: sorted[0],
      median,
      max: sorted[sorted.length - 1],
      spread: Number((sorted[sorted.length - 1] - sorted[0]).toFixed(1)),
      profile: strip.map((v) => Math.round(v)).join(" "),
    };
  };

  // 横线：避开圆角与描边，取竖向 55% 处；竖线：取横向 50% 处
  const midY = Math.round(height * 0.55);
  const midX = Math.round(width * 0.5);
  const horizontal = scanLine(
    Array.from({ length: width }, (_, x) => [x, midY]),
  );
  const vertical = scanLine(
    Array.from({ length: height }, (_, y) => [midX, y]),
  );

  result.parts[part] = { rect: r, horizontal, vertical };
  table.push({
    part,
    "w×h": `${r.w.toFixed(1)}×${r.h.toFixed(1)}`,
    "H min/med/max": `${horizontal.min}/${horizontal.median}/${horizontal.max}`,
    "H spread": horizontal.spread.toFixed(1),
    "V min/med/max": `${vertical.min}/${vertical.median}/${vertical.max}`,
    "V spread": vertical.spread.toFixed(1),
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log("BASE", BASE, "→", OUT, SHOT ? `shot → ${SHOT}` : "");
console.table(table);
for (const part of PARTS) {
  if (!result.parts[part]) continue;
  console.log(part, "H:", result.parts[part].horizontal.profile);
  console.log(part, "V:", result.parts[part].vertical.profile);
}
