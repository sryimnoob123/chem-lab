import fs from "node:fs";
import path from "node:path";

// 把历史 demo 脚本里硬编码的 3000 改成读 BASE_URL（默认 3001），便于在生产口跑
const dir = "scripts";
const files = fs.readdirSync(dir).filter((f) => f.startsWith("demo") || f === "accept-demo.mjs" || f === "record-demo.mjs");
let changed = 0;
for (const f of files) {
  const p = path.join(dir, f);
  let t = fs.readFileSync(p, "utf8");
  const before = t;
  t = t.replace(/"http:\/\/localhost:3000"/g, 'process.env.BASE_URL ?? "http://localhost:3001"');
  t = t.replace(/"http:\/\/127\.0\.0\.1:3000"/g, 'process.env.BASE_URL ?? "http://localhost:3001"');
  t = t.replace(/'http:\/\/localhost:3000'/g, 'process.env.BASE_URL ?? "http://localhost:3001"');
  if (t !== before) {
    fs.writeFileSync(p, t, "utf8");
    changed++;
    console.log("改写:", f);
  }
}
console.log("共改写", changed, "个文件");
