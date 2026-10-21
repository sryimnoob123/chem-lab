import fs from "node:fs";

const f = "docs/自测清单.md";
let t = fs.readFileSync(f, "utf8");
const rows = [
  ["05 氧化还原", "| **05 氧化还原** | `/exp/exp05` | **可玩（6 步 / 30 选项 / 13 个 trap）** |"],
  ["06 配合物", "| **06 配合物** | `/exp/exp06` | **可玩（6 步 / 28 选项 / 10 个 trap）** |"],
  ["07 阳离子", "| **07 阳离子** | `/exp/exp07` | **可玩（6 步 / 27 选项 / 10 个 trap）** |"],
  ["10 标定", "| **10 标定碱度** | `/exp/exp10` | **可玩（6 步 / 30 选项 / 13 个 trap）** |"],
];
let changed = 0;
for (const [key, next] of rows) {
  const re = new RegExp(`\\| ${key}[^\\n]*\\| \`/exp/[^\\n]*\\| [^|]*\\|`);
  const m = t.match(re);
  if (m && m[0] !== next) {
    t = t.replace(re, next);
    changed++;
    console.log("更新:", key);
  } else if (!m) {
    console.log("未匹配:", key);
  }
}
fs.writeFileSync(f, t, "utf8");
console.log("改动行数:", changed);
console.log(t.split("\n").filter((l) => /\/exp\/exp/.test(l)).join("\n"));
