import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app", "exp", "[id]", "workbench.tsx");
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

const start = 688; // 0-based: 原 L689
const end = 700; // 0-based exclusive: 原 L700 之后
const block = lines.slice(start, end).join("\n");
if (!block.includes("TODO(结算")) {
  throw new Error("TODO block not found at expected lines — 文件又被改过，停止");
}

const replacement = [
  "  /**",
  "   * 取一条提示（唯一入口：灯泡 / 键盘 H / 24s 空闲自动）。",
  "   * 三级阶梯与扣分由 use-workbench 的 revealHint 决定；用完时不再派发。",
  "   * 学生主动取提示会上报 `{ kind: \"hint\" }`（报告记「提示 k 次 · −X 分」）：",
  "   * 服务端 appendRunEvents 落审计行 → replay 收集 → 计分按 HINT_DEDUCT_BY_LEVEL 求和；",
  "   * 演示只读模式（`?play=demo`）不落库。",
  "   */",
];

lines.splice(start, end - start, ...replacement);
fs.writeFileSync(file, lines.join("\n"), "utf8");

const rest = fs
  .readFileSync(file, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.includes("\uFFFD")).length;
console.log("cleaned TODO block; remaining FFFD lines:", rest);
