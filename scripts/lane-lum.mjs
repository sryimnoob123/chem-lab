/**
 * 从一张整屏截图里量「一台器皿的液体」纵向亮度剖面（B2 用的像素口径）。
 *
 * 用法：
 *   node scripts/lane-lum.mjs <shot.png> <dpr> <liquidJSON> [<surfaceJSON>] [<label>]
 *   liquidJSON / surfaceJSON = {x,y,w,h}（CSS px，getBoundingClientRect 的值）
 *
 * 输出：液面盘峰值/中位、液柱 30/55/80% 三段的行中位亮度、以及整条 profile。
 * 亮度 L = 0.2126R + 0.7152G + 0.0722B（0..255）。纸白台面 ≈ 246。
 * 只取中间 44% 的列，避开左右壁描边、内壁厚度与体积横向渐变。
 */
import sharp from "sharp";

const [, , shot, dprArg, liquidArg, surfaceArg, label = "vessel"] = process.argv;
if (!shot || !liquidArg) {
  console.error("用法: node scripts/lane-lum.mjs <shot.png> <dpr> <liquidJSON> [surfaceJSON] [label]");
  process.exit(2);
}
const DPR = Number(dprArg ?? 3);
const liquid = JSON.parse(liquidArg);
const surface = surfaceArg && surfaceArg !== "-" ? JSON.parse(surfaceArg) : liquid;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
const fix = (n) => Number(n.toFixed(1));

const left = Math.max(0, Math.round((liquid.x - 2) * DPR));
const top = Math.max(0, Math.round((liquid.y - 2) * DPR));
const width = Math.max(1, Math.round((liquid.w + 4) * DPR));
const height = Math.max(1, Math.round((liquid.h + 4) * DPR));

const { data, info } = await sharp(shot)
  .extract({ left, top, width, height })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const x0 = Math.round(info.width * 0.28);
const x1 = Math.round(info.width * 0.72);
const rows = [];
for (let row = 0; row < info.height; row += 1) {
  const vals = [];
  for (let x = x0; x < x1; x += 1) {
    const i = (row * info.width + x) * info.channels;
    vals.push(lum(data[i], data[i + 1], data[i + 2]));
  }
  rows.push({ row, med: median(vals), peak: Math.max(...vals) });
}

const H = rows.length;
// 与 scripts/liquid-layers-measure.mjs 的 metrics() 同一口径，才能和「改前」的存档数字直接比
const ry = Math.max(2, Math.round((surface.h / 2) * DPR));
const discEnd = Math.min(H - 2, Math.max(5, Math.round(ry * 0.85)));
const discRows = rows.slice(3, discEnd);
const discPeak = Math.max(...discRows.map((r) => r.peak));
const discMed = median(discRows.map((r) => r.med));
const bodyRows = rows.slice(Math.min(H - 3, Math.max(4, Math.round(ry))), H - 3);
const at = (f) => bodyRows[Math.floor((bodyRows.length - 1) * f)];
const out = {
  label,
  dpr: DPR,
  heightPx: H,
  ryPx: ry,
  surface: { peak: fix(discPeak), med: fix(discMed) },
  body: bodyRows.length >= 8
    ? { b30: fix(at(0.3).med), b55: fix(at(0.55).med), b80: fix(at(0.8).med) }
    : null,
  surfaceGain: bodyRows.length >= 8 ? fix(discPeak - at(0.3).med) : null,
  ringVsDisc: fix(discPeak - discMed),
  depthDrop: bodyRows.length >= 8 ? fix(at(0.3).med - at(0.8).med) : null,
  monotone: bodyRows.length >= 8 ? at(0.3).med >= at(0.55).med && at(0.55).med >= at(0.8).med : null,
};
console.log(JSON.stringify(out, null, 2));
console.log("profile:", rows.map((r) => Math.round(r.med)).join(" "));
