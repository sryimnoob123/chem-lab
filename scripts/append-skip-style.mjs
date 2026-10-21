/**
 * 「跳过实验」按钮的次要样式（一次性追加，幂等）。
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app/exp/[id]/workbench.module.css");
const MARK = "/* ===== 跳过实验（仅演示模式） ===== */";

const CSS = `
${MARK}
.finishTop[data-kind="skip"] {
  border-color: var(--line);
  background: #fff;
  color: var(--ink-2);
}
.finishTop[data-kind="skip"]:hover:not(:disabled) {
  border-color: var(--ink-2);
  background: #fff;
  color: var(--ink);
}
`;

const text = fs.readFileSync(file, "utf8");
if (text.includes(MARK)) {
  console.log("已存在，跳过");
} else {
  fs.writeFileSync(file, text + CSS, "utf8");
  console.log("已追加跳过实验样式");
}
