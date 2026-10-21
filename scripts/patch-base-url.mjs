import fs from "node:fs";

const targets = [
  ["scripts/flow-chain.mjs", 'const base = "http://localhost:3000"', 'const base = process.env.BASE_URL ?? "http://localhost:3000"'],
  ["scripts/five-modes-check.mjs", 'const base = "http://localhost:3000"', 'const base = process.env.BASE_URL ?? "http://localhost:3000"'],
  ["scripts/scene-interaction-check.mjs", 'const BASE = "http://localhost:3000"', 'const BASE = process.env.BASE_URL ?? "http://localhost:3000"'],
];

for (const [file, from, to] of targets) {
  if (!fs.existsSync(file)) {
    console.log("缺失", file);
    continue;
  }
  const t = fs.readFileSync(file, "utf8");
  if (t.includes("process.env.BASE_URL")) {
    console.log("已支持 BASE_URL:", file);
    continue;
  }
  if (!t.includes(from)) {
    console.log("未匹配到硬编码:", file);
    continue;
  }
  fs.writeFileSync(file, t.replace(from, to), "utf8");
  console.log("已改:", file);
}
