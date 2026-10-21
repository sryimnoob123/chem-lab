import fs from "node:fs";

const f = "docs/自测清单.md";
let t = fs.readFileSync(f, "utf8");
const before = t;
t = t.replace("| 01 仪器认领 | `/exp/exp01` | 暂未开放（友好页） |", "| **01 仪器认领** | `/exp/exp01` | **可玩** |");
t = t.replace("| 08 称量练习 | `/exp/exp08` | 暂未开放 |", "| **08 称量练习** | `/exp/exp08` | **可玩（7 步 / 34 选项 / 14 个 trap）** |");
if (t === before) {
  console.log("未发生替换，请检查原行文本");
} else {
  fs.writeFileSync(f, t, "utf8");
  console.log("已更新:", t.includes("01 仪器认领** | `/exp/exp01` | **可玩"), t.includes("08 称量练习** | `/exp/exp08` | **可玩"));
}
