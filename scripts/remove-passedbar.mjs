import fs from "node:fs";

const f = "components/exp/bopbps-gate.tsx";
const lines = fs.readFileSync(f, "utf8").split("\n");
const start = lines.findIndex((l) => l.includes("function PassedBar("));
if (start < 0) {
  console.log("没找到 PassedBar");
  process.exit(0);
}
// 上一行若是注释开头，一并删
let from = start;
if (lines[start - 1]?.trim().startsWith("/**")) from = start - 1;

// 从 start 向后找配对的大括号（函数体）
let depth = 0;
let end = -1;
for (let i = start; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  if (depth === 0 && i > start) {
    end = i;
    break;
  }
}
if (end < 0) {
  console.log("没找到函数结束");
  process.exit(1);
}
console.log("删除行", from + 1, "到", end + 1);
lines.splice(from, end - from + 1);
fs.writeFileSync(f, lines.join("\n"), "utf8");
console.log("剩余行数", lines.length, "· 仍含 PassedBar:", fs.readFileSync(f, "utf8").includes("PassedBar"));
