/**
 * 玻璃器皿「液态玻璃五层」实测（B1 的 A/B 证据）
 *
 * 量的是**像素**，不是 DOM 属性：每台器皿取一条水平扫描线（器身中部），
 * 输出「最暗处（外描边）/ 描边内侧最亮处（specular rim）/ 器身中部（tint+sheen）」三个亮度，
 * 并且把整条线的亮度十进制串打出来，改前改后各跑一次就能对比。
 *
 * 用法：
 *   PLAYWRIGHT_BROWSERS_PATH=…/ms-playwright \
 *   BASE_URL=http://localhost:3001 OUT=<json 路径> node scripts/glass-layers-measure.mjs
 *
 * 亮度口径：L = 0.2126R + 0.7152G + 0.0722B（0..255）。纸白台面 ≈ 246。
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT =
  process.env.OUT ??
  path.join(os.tmpdir(), "chemlab-shots", "glass-layers.json");
const DPR = Number(process.env.DPR ?? 2);
const VESSELS = ["beaker", "tube-a", "volumetric", "flask"];

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const browser = await chromium.launch();
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR })
).newPage();
await page.goto(BASE + "/exp/exp01?force=1", { waitUntil: "networkidle" });
await page.waitForFunction(
  () => Boolean(document.querySelector("[data-vessel-art='beaker']")),
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(900);

const shot = await page.screenshot();
const rects = await page.evaluate(
  (ids) =>
    Object.fromEntries(
      ids.map((id) => {
        const el = document.querySelector(`[data-vessel-art='${id}']`);
        const r = el.getBoundingClientRect();
        return [id, { x: r.x, y: r.y, w: r.width, h: r.height }];
      }),
    ),
  VESSELS,
);
await browser.close();

const result = { base: BASE, dpr: DPR, at: new Date().toISOString(), vessels: {} };
const table = [];

for (const id of VESSELS) {
  const r = rects[id];
  const left = Math.max(0, Math.round((r.x - 4) * DPR));
  const top = Math.max(0, Math.round((r.y - 4) * DPR));
  const width = Math.min(Math.round((r.w + 8) * DPR), 1440 * DPR - left);
  const height = Math.min(Math.round((r.h + 8) * DPR), 900 * DPR - top);

  const { data, info } = await sharp(shot)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 扫描线：器身中部（避开瓶口椭圆与器底弧）；另加一条**干壁**行（30% 高，所有器皿都在液面之上），
  // 因为 55% 行的器身中部可能泡在液体里，tint/sheen 的读数会被液体颜色带偏。
  const rows = { dry: Math.round(height * 0.3), wet: Math.round(height * (id === "flask" ? 0.72 : 0.55)) };

  const scan = (row) => {
    const strip = [];
    for (let x = 0; x < info.width; x += 1) {
      const i = (row * info.width + x) * info.channels;
      strip.push({
        x,
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        L: Number(lum(data[i], data[i + 1], data[i + 2]).toFixed(1)),
      });
    }
    // 外描边 = 左半 / 右半各自最暗（全行最暗会在两壁之间来回跳，读数不稳）；
    // 描边内侧最亮 = 那条描边往**器内** 8px 内的最大亮度（左壁向右、右壁向左找）。
    const half = Math.floor(strip.length / 2);
    const pick = (arr) => arr.reduce((a, p) => (p.L < a.L ? p : a), arr[0]);
    const leftOutline = pick(strip.slice(0, half));
    const rightOutline = pick(strip.slice(half));
    const insideOf = (edge, dir) =>
      strip.filter((p) => dir > 0 ? p.x >= edge.x && p.x <= edge.x + 8 * DPR : p.x <= edge.x && p.x >= edge.x - 8 * DPR);
    const leftRim = insideOf(leftOutline, 1).reduce((a, p) => (p.L > a.L ? p : a), leftOutline);
    const rightRim = insideOf(rightOutline, -1).reduce((a, p) => (p.L > a.L ? p : a), rightOutline);
    const rim = leftRim.L >= rightRim.L ? leftRim : rightRim;
    const dark = leftOutline;
    const body = strip[Math.floor(strip.length / 2)];
    // 「器身」取**同一行、亮边往里 12~24px** 的窗（不是行中心）：
    // 有液体的行里行中心泡在液体里，拿液体和玻璃亮边比会得出负值 —— 那是口径错，不是没亮边。
    const wallSample = (edge, dir) =>
      strip
        .filter((p) => (dir > 0 ? p.x >= edge.x + 12 * DPR && p.x <= edge.x + 24 * DPR : p.x <= edge.x - 12 * DPR && p.x >= edge.x - 24 * DPR))
        .map((p) => p.L)
        .sort((a, b) => a - b);
    const nearWall = rim.x === leftRim.x ? wallSample(leftOutline, 1) : wallSample(rightOutline, -1);
    const bodyNearWall = nearWall.length ? nearWall[Math.floor(nearWall.length / 2)] : body.L;
    // Sheen：左右两条描边之间的**整段器身**（不是只取左壁 8~20px，那样斜向柔光根本落不进采样窗），
    // 中位数当底、最大值当 45° 柔光峰值。平涂时差 ≈ 1~2（等于没有），有柔光后应 ≥ 4。
    const inkCut = Math.min(leftOutline.L, rightOutline.L) + 60; // 深墨线 ~110，器身 ~235 —— 60 的闸门刚好把描边切掉
    const solidXs = strip.filter((p) => p.L < inkCut).map((p) => p.x);
    const leftEdge = solidXs.length ? solidXs[0] : 0;
    const rightEdge = solidXs.length ? solidXs[solidXs.length - 1] : strip.length - 1;
    const interior = strip.filter((p) => p.x > leftEdge + 3 * DPR && p.x < rightEdge - 3 * DPR);
    const sorted = interior.map((p) => p.L).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : body.L;
    const peak = sorted.length ? sorted[sorted.length - 1] : body.L;
    return {
      row,
      outline: { x: dark.x, L: dark.L, rgb: [dark.r, dark.g, dark.b] },
      rim: { x: rim.x, L: rim.L, rgb: [rim.r, rim.g, rim.b] },
      rimLeftL: leftRim.L,
      rimRightL: rightRim.L,
      bodyNearWall: Number(bodyNearWall.toFixed(1)),
      body: { x: body.x, L: body.L, rgb: [body.r, body.g, body.b] },
      // 亮度差：rim 比同一行紧邻的器身亮多少（>0 才算真的有亮边）；描边比器身暗多少；斜向柔光峰值比器身底亮多少
      rimMinusBody: Number((rim.L - bodyNearWall).toFixed(1)),
      bodyMinusOutline: Number((body.L - dark.L).toFixed(1)),
      sheenGain: Number((peak - median).toFixed(1)),
      profile: strip.map((p) => Math.round(p.L)).join(" "),
    };
  };

  result.vessels[id] = { rect: r, ...Object.fromEntries(Object.entries(rows).map(([k, row]) => [k, scan(row)])) };
  for (const [key, scanResult] of Object.entries(result.vessels[id])) {
    if (key === "rect") continue;
    table.push({
      vessel: `${id}/${key}`,
      outlineL: scanResult.outline.L,
      rimL: scanResult.rim.L,
      "rimL/R": `${Math.round(scanResult.rimLeftL)}/${Math.round(scanResult.rimRightL)}`,
      bodyL: scanResult.body.L,
      "rim-body": scanResult.rimMinusBody.toFixed(1),
      "body-outline": scanResult.bodyMinusOutline.toFixed(1),
      "sheen+": scanResult.sheenGain.toFixed(1),
    });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log("BASE", BASE, "→", OUT);
console.table(table);
for (const id of VESSELS) console.log(id, "dry:", result.vessels[id].dry.profile);
