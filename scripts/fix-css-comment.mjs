import fs from "node:fs";

const f = "components/exp/guide/guide.module.css";
const lines = fs.readFileSync(f, "utf8").split("\n");

// 替换被 PowerShell 写坏的注释行（含 U+FFFD 或乱码特征）为正确中文
const fixed = lines.map((line) => {
  if (line.includes("绐勫睆") || line.includes("\uFFFD") || line.includes("浮動") === false && line.includes("避让") === false && /\/\*.*预习.*\*\//.test(line) === false && line.includes("/*") && line.includes("浮动") === false && line.includes("窄屏") === false && line.includes("预习")) {
    return "/* 窄屏：浮动「预习」入口仍在右下，留出更小的避让位 */";
  }
  return line;
});

// 兜底：任何仍含乱码的注释行直接替换
const out = fixed.map((line) =>
  /\/\*.*\*\//.test(line) && /[^\x00-\x7F]/.test(line) && !/[\u4e00-\u9fa5「」]/.test(line)
    ? "/* 窄屏：浮动「预习」入口仍在右下，留出更小的避让位 */"
    : line,
);

fs.writeFileSync(f, out.join("\n"), "utf8");
console.log("已处理", out.length, "行");
console.log(out.slice(-7).join("\n"));
