import fs from "node:fs";

const f = "docs/自测清单.md";
let t = fs.readFileSync(f, "utf8");
const before = t;
t = t.replace("| 02 氯化钠制备 | `/exp/exp02` | 暂未开放 |", "| **02 氯化钠制备** | `/exp/exp02` | **可玩（6 步 / 27 选项 / 11 个 trap）** |");
if (t === before) {
  console.log("未匹配，请检查原行");
} else {
  fs.writeFileSync(f, t, "utf8");
  console.log("exp02 已标记可玩");
}
