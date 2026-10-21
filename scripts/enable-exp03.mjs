import fs from "node:fs";

const file = "lib/catalog.ts";
const t = fs.readFileSync(file, "utf8");
const re = /(id: "exp03"[\s\S]*?)playable: false/;
if (re.test(t)) {
  fs.writeFileSync(file, t.replace(re, "$1playable: true"), "utf8");
  console.log("exp03 playable → true");
} else {
  console.log("未匹配（可能已是 true）");
}
