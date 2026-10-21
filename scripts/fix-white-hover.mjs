/**
 * 亮场第四步：修掉剩余"纸白底上的白字"。
 *
 * 做法：按选择器文本定位块，只把该块内**第一个** `color: #fff;` 换掉；
 * 有彩色底的（蓝底主按钮、选中态 modeButton）不在名单里，原样保留。
 *
 * 用法：node scripts/fix-white-hover.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

/** [选择器前缀, 新颜色] —— 选择器按 CSS 里的字面写法给，含空格与转义 */
const RULES = [
  // ---- workbench.module.css ----
  [".back:hover", "var(--river-700)"],
  [".modeButton:hover", "var(--river-700)"],
  [".pickHint", "var(--ink-2)"],
  [".railTitle", "var(--ink)"],
  ['.ledger li[data-state="current"]', "var(--ink)"],
  [".hintTitle", "var(--ink)"],
  [".hintButton:hover", "var(--river-700)"],
  [".feedbackTitle", "var(--ink)"],
  [".feedbackText span", "var(--ink)"],
  [".actionsHead h3", "var(--ink)"],
  [".action:hover:not(:disabled)", "var(--river-700)"],
  [".resetButton:hover", "var(--river-700)"],
  [".reportLink:hover", "var(--river-700)"],
  [".note span", "var(--ink-2)"],
  [".retryButton:hover", "var(--river-700)"],
];

const GUIDE_RULES = [[".retry:hover", "var(--river-700)"]];

const FILES = [
  ["app/exp/[id]/workbench.module.css", RULES],
  ["components/exp/guide/guide.module.css", GUIDE_RULES],
];

let changed = 0;
for (const [rel, rules] of FILES) {
  const file = path.join(ROOT, rel);
  let text = fs.readFileSync(file, "utf8");
  let hits = 0;

  for (const [selector, color] of rules) {
    // 定位 `selector {`（允许 selector 前后空白），再从 `{` 往后到第一个 `}` 之间替换
    const selIdx = text.indexOf(selector + " {");
    if (selIdx < 0) {
      console.log(`⚠ 找不到选择器：${selector}（${rel}）`);
      continue;
    }
    const open = text.indexOf("{", selIdx);
    const close = text.indexOf("}", open);
    if (open < 0 || close < 0) continue;
    const block = text.slice(open, close);
    if (!/color:\s*#fff;/.test(block)) {
      continue; // 可能已被上一轮修过
    }
    const nextBlock = block.replace(/color:\s*#fff;/, `color: ${color};`);
    text = text.slice(0, open) + nextBlock + text.slice(close);
    hits += 1;
  }

  if (!DRY && hits) fs.writeFileSync(file, text, "utf8");
  changed += hits;
  console.log(`${rel}: ${hits} 处白字 → 深色`);
}
console.log(`合计 ${changed} 处${DRY ? "（dry run）" : ""}`);
