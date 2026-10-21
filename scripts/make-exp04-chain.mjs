import fs from "node:fs";

// 复制 exp03 的整链脚本改成 exp04（含自动找 trap 的逻辑）
const src = "scripts/exp03-chain.mjs";
const dst = "scripts/exp04-chain.mjs";
let t = fs.readFileSync(src, "utf8");
t = t.replace('const expId = "exp03";', 'const expId = process.env.EXP_ID ?? "exp04";');
t = t.replace(/public\/shots-prod\/exp03/g, "public/shots-prod/exp04");
t = t.replace(/exp03-chain/g, "exp04-chain");
t = t.replace(/exp03/g, "exp04");
fs.writeFileSync(dst, t, "utf8");
console.log("生成", dst, "| 含 exp04:", t.includes("exp04"), "| 残留 exp03:", t.includes("exp03"));
