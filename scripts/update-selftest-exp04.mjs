import fs from "node:fs";

const f = "docs/自测清单.md";
let t = fs.readFileSync(f, "utf8");
const before = t;
t = t.replace("| 04 沉淀平衡 | `/exp/exp04` | 暂未开放 |", "| **04 沉淀平衡** | `/exp/exp04` | **可玩（5 步 / 23 选项 / 10 个 trap）** |");
if (t === before) console.log("未匹配，请检查原行");
else {
  fs.writeFileSync(f, t, "utf8");
  console.log("exp04 已标记可玩");
}
