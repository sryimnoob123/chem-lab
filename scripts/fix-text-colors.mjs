/**
 * 亮场第三步：把"白字"改成深色字，修掉换底后的"白字白底"。
 *
 * 只做精确字符串替换（每处 old 在文件里唯一），不碰结构、不碰中文。
 * 用法：node scripts/fix-text-colors.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

const EDITS = [
  // ---- 实验页：顶部标题 / 试剂名 / 底栏编号 / 开发提示 ----
  {
    file: "app/exp/[id]/workbench.module.css",
    old: `.topTitle {\n  min-width: 0;\n  max-width: 380px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: #fff;`,
    next: `.topTitle {\n  min-width: 0;\n  max-width: 380px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--ink);`,
  },
  {
    file: "app/exp/[id]/workbench.module.css",
    old: `.reagentName {\n  color: #fff;`,
    next: `.reagentName {\n  color: var(--ink);`,
  },
  {
    file: "app/exp/[id]/workbench.module.css",
    old: `.dockNo {\n  color: #fff;`,
    next: `.dockNo {\n  color: var(--ink-2);`,
  },
  {
    file: "app/exp/[id]/workbench.module.css",
    old: `  background: rgba(246, 247, 245, 0.94);\n  color: #d8b36a;`,
    next: `  background: rgba(246, 247, 245, 0.94);\n  color: #b45309;`,
  },
  // ---- 交卷按钮：浅绿字在白绿底上看不见 → 深绿字 ----
  {
    file: "app/exp/[id]/workbench.module.css",
    old: `.finishTop {\n  min-height: 30px;\n  padding: 0 10px;\n  border: 1px solid var(--jade-600);\n  background: rgba(15, 123, 108, 0.16);\n  color: #b7e3d6;`,
    next: `.finishTop {\n  min-height: 30px;\n  padding: 0 10px;\n  border: 1px solid var(--jade-600);\n  background: rgba(15, 123, 108, 0.12);\n  color: #0f7b6c;`,
  },
  {
    file: "app/exp/[id]/workbench.module.css",
    old: `.finishTop:hover:not(:disabled) {\n  background: rgba(15, 123, 108, 0.28);\n  color: #fff;\n}`,
    next: `.finishTop:hover:not(:disabled) {\n  background: rgba(15, 123, 108, 0.22);\n  color: #0b5e52;\n}`,
  },
  // ---- 退出链接：hover 白字在纸白底上不可见 ----
  {
    file: "app/exp/[id]/workbench.module.css",
    old: `.exit:hover {\n  color: #fff;\n}`,
    next: `.exit:hover {\n  color: var(--river-700);\n  text-decoration-thickness: 2px;\n}`,
  },
  // ---- 结果条主操作文字（原先靠深底反白）----
  {
    file: "components/exp/guide/guide.module.css",
    old: `.nextName {\n  font-size: 14px;\n  line-height: 1.35;\n  font-weight: 500;\n}`,
    next: `.nextName {\n  font-size: 14px;\n  line-height: 1.35;\n  font-weight: 500;\n  color: var(--ink);\n}`,
  },
];

const byFile = new Map();
for (const e of EDITS) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

let total = 0;
for (const [rel, edits] of byFile) {
  const file = path.join(ROOT, rel);
  let text = fs.readFileSync(file, "utf8");
  let applied = 0;
  for (const e of edits) {
    if (!text.includes(e.old)) {
      console.log(`⚠ 未命中：${rel} 的 ${e.old.split("\n")[0]}`);
      continue;
    }
    text = text.replace(e.old, e.next);
    applied += 1;
  }
  if (!DRY && applied) fs.writeFileSync(file, text, "utf8");
  total += applied;
  console.log(`${rel}: 替换 ${applied}/${edits.length}`);
}
console.log(`合计 ${total} 处${DRY ? "（dry run）" : ""}`);
