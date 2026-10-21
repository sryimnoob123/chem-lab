import fs from "node:fs";

const f = "docs/自测清单.md";
let t = fs.readFileSync(f, "utf8");
const before = t;
t = t.replace("| 10 盐酸标定 | `/exp/exp10` | 暂未开放 |", "| **10 标定碱度** | `/exp/exp10` | **可玩（6 步 / 30 选项 / 13 个 trap）** |");
if (t === before) console.log("未匹配 10 行");
else {
  fs.writeFileSync(f, t, "utf8");
  console.log("exp10 行已更新");
}
const rows = t.split("\n").filter((l) => /\/exp\/exp\d\d/.test(l) && l.trim().startsWith("|"));
console.log("入口表 " + rows.length + " 行，未开放剩 " + rows.filter((l) => l.includes("暂未开放")).length + " 行");
