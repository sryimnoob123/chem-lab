import fs from "node:fs";

const f = "scripts/exp02-chain.mjs";
let t = fs.readFileSync(f, "utf8");
t = t.replace('const expId = process.env.EXP_ID ?? "exp08";', 'const expId = process.env.EXP_ID ?? "exp02";');
t = t.replace(/exp08/g, "exp02");
fs.writeFileSync(f, t, "utf8");
console.log("exp02-chain 已就绪，含 exp08 替换:", !t.includes("exp08"));
