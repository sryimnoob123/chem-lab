/**
 * 批量设置 catalog 里实验的 playable 标记（幂等）
 * 用法：node scripts/set-playable.mjs true exp05 exp06 exp07 exp10
 *       node scripts/set-playable.mjs false exp05
 */
import fs from "node:fs";
import path from "node:path";

const [flag, ...idsRaw] = process.argv.slice(2);
if (!/^(true|false)$/.test(flag ?? "") || !idsRaw.length) {
  console.log("用法: node scripts/set-playable.mjs true|false exp05 exp06 ...");
  process.exit(1);
}
const ids = idsRaw.filter((a) => /^exp\d+$/.test(a));

const file = path.join(process.cwd(), "lib", "catalog.ts");
let src = fs.readFileSync(file, "utf8");

for (const id of ids) {
  const re = new RegExp(`(id: "${id}"[\\s\\S]*?)playable: (true|false)`);
  const m = src.match(re);
  if (!m) {
    console.log(`未匹配 ${id}`);
    continue;
  }
  if (m[2] === flag) {
    console.log(`${id} 已是 ${flag}`);
    continue;
  }
  src = src.replace(re, `$1playable: ${flag}`);
  console.log(`${id} playable → ${flag}`);
}

fs.writeFileSync(file, src, "utf8");
