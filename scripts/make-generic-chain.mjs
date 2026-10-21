import fs from "node:fs";

const src = "scripts/exp04-chain.mjs";
let t = fs.readFileSync(src, "utf8");
t = t.replace('path.join("public", "shots-prod", "exp04")', 'path.join("public", "shots-prod", expId)');
t = t.replace('const expId = process.env.EXP_ID ?? "exp04";', 'const expId = process.env.EXP_ID ?? "exp04";');
t = t.replace("/**\n * exp04 整链验收", "/**\n * 通用整链验收（任意已接通实验）");
fs.writeFileSync("scripts/exp-chain.mjs", t, "utf8");
const out = fs.readFileSync("scripts/exp-chain.mjs", "utf8");
console.log("生成 scripts/exp-chain.mjs · 目录参数化:", out.includes("shots-prod\", expId"));
