import fs from "node:fs";

const file = "lib/catalog.ts";
const t = fs.readFileSync(file, "utf8");
const re = /(id: "exp02"[\s\S]*?)playable: true/;
if (re.test(t)) {
  fs.writeFileSync(file, t.replace(re, "$1playable: false"), "utf8");
  console.log("exp02 playable → false（未达验收条件，先回退）");
} else {
  console.log("exp02 已是 false 或结构不同");
}
