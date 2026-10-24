/**
 * 第五轮 · 帧率表合并（改前 / 改后并列）
 *
 * 输入：
 *   --before evidence/2026-10-24-round4-anim/fps.json     （第四轮实测，dev 构建）
 *   --dev    <dir>[,<dir>...]                            （本轮 dev 构建的实测目录，含 fps.json）
 *   --prod   <dir>[,<dir>...]                            （本轮 prod 构建的实测目录）
 * 输出：
 *   --out evidence/2026-10-24-final/fps.json             （同一份文件里并列 before / after）
 *
 * 多轮时按同一行取 **中位数**（同时保留每一轮的原始数字，不做挑选）。
 */
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const argOf = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const BEFORE = argOf("--before", "evidence/2026-10-24-round4-anim/fps.json");
const DEV_DIRS = argOf("--dev", "").split(",").filter(Boolean);
const PROD_DIRS = argOf("--prod", "").split(",").filter(Boolean);
const OUT = argOf("--out", "evidence/2026-10-24-final/fps.json");

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(2);
};

const load = (dirs) => dirs.map((d) => read(path.join(d, "fps.json")));

/** 把 [[{viewport,rows}...]...] 按视口/行名对齐，算中位数 */
function merge(runs) {
  const out = [];
  const vps = runs[0].map((r) => r.viewport);
  for (const [vi, vp] of vps.entries()) {
    const names = runs[0][vi].rows.map((r) => r.name);
    const rows = names.map((name, ri) => {
      const picks = runs.map((run) => run[vi].rows[ri]).filter(Boolean);
      const pick = (k) => picks.map((p) => p[k]);
      return {
        name,
        windowMs: median(pick("windowMs")),
        frames: median(pick("frames")),
        avg: median(pick("avg")),
        p95: median(pick("p95")),
        max: median(pick("max")),
        over33: median(pick("over33")),
        over50: median(pick("over50")),
        fps: median(pick("fps")),
        /** 每一轮的原始值，便于核对（不隐藏波动） */
        runs: picks.map((p) => ({ fps: p.fps, max: p.max, over33: p.over33, over50: p.over50 })),
      };
    });
    out.push({ viewport: vp, rows });
  }
  return out;
}

const before = read(BEFORE);
const devRuns = load(DEV_DIRS);
const prodRuns = load(PROD_DIRS);

const result = {
  schema: "chem-lab-fps/2",
  measuredAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  harness: "scripts/round4-fps.mjs（口径未改：页面内 rAF 连采，取动作层存在那段最多 120 帧的相邻间隔；不录屏）",
  criterion: { fps: "≥ 55", maxFrameMs: "≤ 50", viewports: ["1440x900", "390x844"] },
  columns: {
    before: "第四轮实测（dev 构建，HEAD 1018ed2）—— 上一版 fps.json 原样搬过来",
    dev: "本轮实测（dev 构建）" + (devRuns.length > 1 ? `，${devRuns.length} 轮取中位数` : ""),
    prod: "本轮实测（生产构建 next build + next start，就是部署产物）" + (prodRuns.length > 1 ? `，${prodRuns.length} 轮取中位数` : ""),
  },
  before: before.map((v) => ({
    viewport: v.viewport,
    rows: v.rows.map((r) => ({ name: r.name, windowMs: r.windowMs, frames: r.frames, avg: r.avg, p95: r.p95, max: r.max, over33: r.over33, over50: r.over50, fps: r.fps })),
  })),
  after: {
    dev: devRuns.length ? merge(devRuns) : null,
    prod: prodRuns.length ? merge(prodRuns) : null,
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

const show = (label, table) => {
  if (!table) return;
  for (const v of table) {
    console.log(`\n== ${label} ${v.viewport.label}×${v.viewport.h} ==`);
    for (const r of v.rows) {
      const pass = r.fps >= 55 && r.max <= 50 ? "✅" : "❌";
      console.log(`${pass} ${r.name}\t${r.windowMs}ms\t${r.fps}fps\tmax ${r.max}ms\t>33ms ${r.over33}\t>50ms ${r.over50}`);
    }
  }
};
console.log("## 改前（dev）");
show("before", result.before);
console.log("\n## 改后（dev）");
show("after-dev", result.after.dev);
console.log("\n## 改后（prod）");
show("after-prod", result.after.prod);
console.log(`\n写出 ${OUT}`);
