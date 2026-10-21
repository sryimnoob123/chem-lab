/**
 * 亮场改造 v2：把**所有**"暗色底"字面量换成纸白底。
 *
 * v1 只处理了 rgba(10,16,24,α)；实测还有 rgba(14,22,32,α)、rgba(26,37,49,α)
 * 等变体散在 workbench/guide 里（mission-board-ui 数出 13 处）。
 * 这里改成按 RGB 阈值判断：r<75 && g<80 && b<95 一律视为暗底。
 *
 * 保留暗底的地方（白名单文件）：演示浮层 demo.css、事故特效 fx.module.css、
 * 报告页 report.module.css —— 这些"深底"是有意的反差。
 *
 * 用法：node scripts/fix-light-theme.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

const FILES = [
  "app/exp/[id]/workbench.module.css",
  "components/exp/guide/guide.module.css",
  "components/exp/guide/mission-board.module.css",
  "components/exp/scene/scene.module.css",
];

/** 暗底 → 纸白（保留 alpha，但抬到至少 0.9，避免透出下层暗色） */
function lightenAlpha(alpha) {
  const a = Number(alpha);
  const lifted = Number.isFinite(a) ? Math.max(a, 0.9) : 0.94;
  return lifted.toFixed(2);
}

const RGBA = /rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)/g;

function isDark(r, g, b) {
  return r < 75 && g < 80 && b < 95;
}

const report = [];

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");

  let hits = 0;
  const after = before.replace(RGBA, (full, r, g, b, a) => {
    if (!isDark(Number(r), Number(g), Number(b))) return full;
    hits += 1;
    return `rgba(246, 247, 245, ${lightenAlpha(a)})`;
  });

  if (hits === 0) {
    report.push(`${rel}: 无暗底`);
    continue;
  }
  if (!DRY) fs.writeFileSync(file, after, "utf8");
  report.push(`${rel}: ${hits} 处暗底 → 纸白${DRY ? "（dry run）" : ""}`);
}

console.log(report.join("\n"));
