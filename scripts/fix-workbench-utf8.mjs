/**
 * 一次性修复：app/exp/[id]/workbench.tsx 的 REJECT_FALLBACK 段被 PowerShell 写坏
 *（UTF-8 → GBK 双重编码，且三行字符串结尾引号丢失，Turbopack 报 Unterminated string constant）。
 *
 * 只替换第 56~61 行（1-based）这一段，其余内容原样保留。
 * 用 node 的 fs 显式 utf8 读写，不经过 PowerShell。
 */
import { readFileSync, writeFileSync } from "node:fs";

const target = "app/exp/[id]/workbench.tsx";
const lines = readFileSync(target, "utf8").split("\n");

const START = 56; // 1-based
const COUNT = 6;

const expected = lines.slice(START - 1, START - 1 + COUNT).join("\n");
if (!expected.includes("REJECT_FALLBACK")) {
  console.error("拒绝执行：第 56~61 行不像 REJECT_FALLBACK 段，实际内容：");
  console.error(expected);
  process.exit(1);
}

const fixed = [
  "/** RejectHint 的兜底三行（拒收永远给完整的三段信息，不留空）。 */",
  "const REJECT_FALLBACK = [",
  '  "这一步投不进去",',
  '  "当前步骤不接受这个试剂",',
  '  "按上方「建议动作」再试一次",',
  "] as const;",
];

lines.splice(START - 1, COUNT, ...fixed);
writeFileSync(target, lines.join("\n"), "utf8");
console.log(`已修复 ${target} 第 ${START}~${START + COUNT - 1} 行，写入 ${fixed.length} 行。`);
