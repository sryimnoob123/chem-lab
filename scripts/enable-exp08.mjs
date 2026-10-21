import fs from "node:fs";

const file = "lib/catalog.ts";
const t = fs.readFileSync(file, "utf8");
const re = /(id: "exp08"[\s\S]*?)playable: false/;
if (re.test(t)) {
  fs.writeFileSync(file, t.replace(re, "$1playable: true"), "utf8");
  console.log("exp08 playable → true");
} else {
  console.log(t.includes('id: "exp08"') ? "exp08 已是 true 或结构不同" : "未找到 exp08");
}
