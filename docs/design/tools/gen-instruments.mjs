// 由 scripts 生成 public/instruments/{burette,conical-flask,beaker}.svg
// 统一规范：玻璃描边 #16202C @70% / 1.4px；填充 rgba(255,255,255,.5)；
// 左上 45° 单条 2px 白色高光 @35%；刻线等宽字体 7px；无渐变、无投影（器皿底部 1px 深色边除外）。
// 运行：node docs/design/tools/gen-instruments.mjs
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../../public/instruments");
const ROOT = resolve(HERE, "../../..");
mkdirSync(OUT, { recursive: true });

const INK = "#16202C";
const STROKE = `stroke="${INK}" stroke-opacity="0.7" stroke-width="1.4"`;
const GLASS = `fill="#fff" fill-opacity="0.5"`;
const NONE = `fill="none"`;
const FONT = `font-family="'IBM Plex Mono', 'IBM Mono', monospace" font-size="7"`;
// 刻度字体内嵌：SVG 用 <img> 引入时拿不到页面字体，内嵌后单文件打开/打印也是等宽体。
const MONO_B64 = readFileSync(
  resolve(ROOT, "public/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2")
).toString("base64");
const FONT_STYLE = `<style>@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${MONO_B64}) format('woff2');}</style>`;
const n = (v) => Number(v.toFixed(2));
const head = (title, meta) => `<!--
  ${title}
${meta.split("\n").map((l) => "  " + l).join("\n")}
  统一规范：描边 ${INK} @70% / 1.4px；玻璃填充 rgba(255,255,255,.5)；
  光源左上 45°，单条 2px 白色高光 @35%；刻线等宽字体 7px；
  不用渐变洗底、不用投影（仅器皿底部一条 1px 深色边）。
  刻度字体：内嵌 IBM Plex Mono 400（woff2 base64，OFL 1.1），脱离页面也保持等宽。
-->`;

/* ---------------- 1. 酸式滴定管 50 mL ---------------- */
const B = { x0: 47, x1: 73, yTop: 20, yBottom: 300, y0: 52, y1: 296, ml: 50 };
const bY = (v) => B.y0 + (v / B.ml) * (B.y1 - B.y0);
const buretteTicks = [];
for (let i = 0; i <= B.ml * 10; i++) {
  const v = i / 10;
  const y = n(bY(v));
  const is5 = Math.abs(v % 5) < 1e-6;
  const is1 = Math.abs(v % 1) < 1e-6;
  const isHalf = Math.abs((v * 2) % 1) < 1e-6;
  const [len, w] = is5 ? [10.3, 1.4] : is1 ? [6.2, 1.2] : isHalf ? [3.8, 0.9] : [2.6, 0.45];
  const x = n(72.3 - len);
  const op = is5 || is1 ? "" : ` stroke-opacity="0.62"`;
  buretteTicks.push(`    <line x1="${x}" y1="${y}" x2="72.3" y2="${y}" stroke-width="${w}"${op}/>`);
}
const buretteLabels = [];
for (let v = 0; v <= B.ml; v += 5) {
  buretteLabels.push(
    `    <text x="61.5" y="${n(bY(v) + 2.4)}" text-anchor="end" font-size="7" fill="${INK}" fill-opacity="0.7">${v}</text>`
  );
}

const burette = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 360" width="120" height="360" role="img" aria-label="50 毫升酸式滴定管，0 至 50 毫升刻度">
${head(
  "器皿：酸式滴定管（burette）",
  `用途：酸碱滴定中盛装标准酸溶液，逐滴放出并精确读数。
真实规格：50 mL，酸式玻璃旋塞，最小分度 0.1 mL，读数估读至 0.01 mL。
画布：viewBox 0 0 120 360（高瘦系）。
坐标：管身 x=47..73（瓶口 y=14，x=45..75）；0 mL 刻线 y=52，50 mL 刻线 y=296（每 1 mL = ${n((B.y1 - B.y0) / 50)}px）；
      旋塞 y=300..316；下尖嘴 y=316..342。
注：0.1 mL 细刻线按真实密度绘制，1 倍显示时并成刻度带，放大后可分辨。`
)}
${FONT_STYLE}
  <g id="burette">
    <path d="M45 14 H75 L73 20 V300 H47 V20 Z" ${GLASS} ${STROKE}/>
    <rect x="38" y="300" width="44" height="16" rx="4" ${GLASS} ${STROKE}/>
    <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" ${GLASS} ${STROKE}/>
    <line x1="82" y1="308" x2="87" y2="308" ${STROKE}/>
    <rect x="87" y="303.5" width="12" height="9" rx="2" ${GLASS} ${STROKE}/>
    <line x1="93" y1="304" x2="93" y2="312" ${STROKE} ${NONE}/>
    <g id="graduation" data-range="0-50" data-min-division="0.1" ${FONT} stroke="${INK}" stroke-opacity="0.7" fill="${INK}" fill-opacity="0.7">
${buretteTicks.join("\n")}
${buretteLabels.join("\n")}
    </g>
    <line x1="51" y1="30" x2="51" y2="292" stroke="#fff" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
    <line x1="58.5" y1="341" x2="62" y2="341" stroke="${INK}" stroke-opacity="0.55" stroke-width="1"/>
  </g>
</svg>
`;

/* ---------------- 2. 250 mL 锥形瓶 ---------------- */
const flask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200" role="img" aria-label="250 毫升锥形瓶">
${head(
  "器皿：锥形瓶（conical flask / Erlenmeyer flask）",
  `用途：滴定承接瓶、加热与振荡反应容器。
真实规格：250 mL 广口锥形瓶，瓶口外径约 34 mm，瓶底外径约 85 mm，总高约 145 mm。
画布：viewBox 0 0 160 200（矮胖系）。
坐标：瓶口 x=63..97（y=16），瓶颈至 y=62；肩部直线展开至瓶底 y=184，底宽 x=32..128；
      250 mL 标线 y=99（瓶颈下约 30 mm 处）。`
)}
${FONT_STYLE}
  <g id="conical-flask">
    <path d="M63 16 H97 V62 L128 178 Q128 184 122 184 H38 Q32 184 32 178 L63 62 Z" ${GLASS} ${STROKE}/>
    <line x1="60" y1="16" x2="100" y2="16" ${STROKE} ${NONE}/>
    <line x1="55" y1="99" x2="105" y2="99" ${STROKE}/>
    <text x="80" y="93" text-anchor="middle" ${FONT} fill="${INK}" fill-opacity="0.7">250</text>
    <line x1="67" y1="72" x2="44" y2="164" stroke="#fff" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
    <line x1="37" y1="183" x2="123" y2="183" stroke="${INK}" stroke-opacity="0.55" stroke-width="1"/>
  </g>
</svg>
`;

/* ---------------- 3. 250 mL 烧杯 ---------------- */
const beaker = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200" role="img" aria-label="250 毫升烧杯，50 至 250 毫升刻度">
${head(
  "器皿：烧杯（beaker）",
  `用途：试液配制、溶解、加热与粗略量取。
真实规格：250 mL 低型烧杯，外径约 70 mm，高约 95 mm；刻度为近似量取用，最小分度 10 mL。
画布：viewBox 0 0 160 200（矮胖系）。
坐标：杯口椭圆圆心 (80,41)，rx=54 / ry=7.5；杯身 x=26..134，底 y=188；
      0 mL 在 y=184，250 mL 在 y=56（每 1 mL = 0.512px），主刻度间隔 50 mL 带数字。`
)}
${FONT_STYLE}
  <g id="beaker">
    <path d="M26 41 V188 H134 V41 Z" fill="#fff" fill-opacity="0.5"/>
    <path d="M26 41 V188 H134 V41" ${STROKE} ${NONE}/>
    <ellipse cx="80" cy="41" rx="54" ry="7.5" ${STROKE} ${NONE}/>
    <g id="graduation" data-range="0-250" data-min-division="10" ${FONT} stroke="${INK}" stroke-opacity="0.7" fill="${INK}" fill-opacity="0.7">
${(() => {
  const out = [];
  const y = (v) => n(184 - v * 0.512);
  for (let v = 10; v <= 240; v += 10) {
    const major = v % 50 === 0;
    out.push(`    <line x1="30" y1="${y(v)}" x2="${major ? 42 : 35.5}" y2="${y(v)}" stroke-width="${major ? 1.2 : 0.9}"${major ? "" : ` stroke-opacity="0.62"`}/>`);
  }
  for (let v = 50; v <= 250; v += 50) {
    out.push(`    <line x1="30" y1="${y(v)}" x2="42" y2="${y(v)}" stroke-width="1.2"/>`);
    out.push(`    <text x="45" y="${n(y(v) + 2.4)}" font-size="7" fill="${INK}" fill-opacity="0.7">${v}</text>`);
  }
  return out.join("\n");
})()}
    </g>
    <line x1="31.5" y1="56" x2="31.5" y2="180" stroke="#fff" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
    <line x1="28" y1="187" x2="132" y2="187" stroke="${INK}" stroke-opacity="0.55" stroke-width="1"/>
  </g>
</svg>
`;

writeFileSync(resolve(OUT, "burette.svg"), burette, "utf8");
writeFileSync(resolve(OUT, "conical-flask.svg"), flask, "utf8");
writeFileSync(resolve(OUT, "beaker.svg"), beaker, "utf8");
console.log("written:", OUT);
