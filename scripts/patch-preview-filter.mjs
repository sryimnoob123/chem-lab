import fs from "node:fs";

const f = "scripts/build-preview.mjs";
let t = fs.readFileSync(f, "utf8");

// extras 的截图过滤：排除 samescreen 归档（文件名带 exp0）与重复项
const before = `.filter((x) => x.endsWith(".png"))`;
const after = `.filter((x) => x.endsWith(".png") && !x.includes("exp0"))`;

if (t.includes(after)) {
  console.log("已过滤过，跳过");
} else if (t.includes(before)) {
  // 只替换 extras 里那一处（extraDefs 之后的 readdirSync）
  const idx = t.indexOf("extraDefs");
  const head = t.slice(0, idx);
  const tail = t.slice(idx);
  const tail2 = tail.replace(before, after);
  t = head + tail2;
  fs.writeFileSync(f, t, "utf8");
  console.log("已过滤 samescreen 归档图");
} else {
  console.log("未找到过滤点");
}
