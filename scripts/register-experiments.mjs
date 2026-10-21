/**
 * 把 experiments/expNN/definition.ts 注册进 lib/engine.ts（幂等）
 * 用法：node scripts/register-experiments.mjs exp05 exp06 exp07 exp10
 */
import fs from "node:fs";
import path from "node:path";

const ids = process.argv.slice(2).filter((a) => /^exp\d+$/.test(a));
if (!ids.length) {
  console.log("用法: node scripts/register-experiments.mjs exp05 exp06 ...");
  process.exit(1);
}

const file = path.join(process.cwd(), "lib", "engine.ts");
let src = fs.readFileSync(file, "utf8");

for (const id of ids) {
  const defPath = path.join(process.cwd(), "experiments", id, "definition.ts");
  if (!fs.existsSync(defPath)) {
    console.log(`跳过 ${id}：definition.ts 不存在`);
    continue;
  }
  const name = `${id}Definition`;

  if (!src.includes(`from "../experiments/${id}/definition"`)) {
    // 找最后一条 definition 的 import 行，插在其后
    const importRe = /import \{ exp\d+Definition \} from "\.\.\/experiments\/exp\d+\/definition";\n/g;
    const hits = [...src.matchAll(importRe)];
    const line = `import { ${name} } from "../experiments/${id}/definition";\n`;
    if (hits.length) {
      const last = hits[hits.length - 1];
      const at = last.index + last[0].length;
      src = src.slice(0, at) + line + src.slice(at);
    } else {
      console.log(`警告 ${id}：engine.ts 里找不到任何 definition import，请手动检查`);
      continue;
    }
  }

  if (!src.includes(`[${name}.id]: ${name}`)) {
    const mapRe = /\[exp\d+Definition\.id\]: exp\d+Definition,\n/g;
    const hits = [...src.matchAll(mapRe)];
    const line = `  [${name}.id]: ${name},\n`;
    if (hits.length) {
      const last = hits[hits.length - 1];
      const at = last.index + last[0].length;
      src = src.slice(0, at) + line + src.slice(at);
    } else {
      console.log(`警告 ${id}：engine.ts 里找不到 definition map 条目`);
      continue;
    }
  }
  console.log(`已注册 ${id}`);
}

fs.writeFileSync(file, src, "utf8");
console.log("engine.ts 已写入");
