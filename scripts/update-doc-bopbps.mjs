import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const f = "docs/自测清单.md";
let t = fs.readFileSync(f, "utf8");

const section = `
## 11. BOPPPS 教学六段（前测门禁 + 后测）

| 段 | 位置 | 怎么验 |
|---|---|---|
| B 导入 / O 目标 | \`/exp/expNN\` 首屏顶部两张卡 | 能看到「B · 导入」一段情境文字、「O · 目标」三条带 K1/S1/A1 编码 |
| P 前测 | 同上，3 题单选 | **不做全对进不去操作台**；故意答错 → 出「答案 X · 解析」，点「重新作答」可重答 |
| P 参与式 | 全对后自动进入的操作台 | 出现 4~5 个动作按钮（原来的 workbench） |
| P 后测 | \`/exp/expNN/report\` 顶部 | 3 题单选，提交后显示 \`x / 100\` 与逐题解析，可「重做后测」 |
| S 总结 | 后测卡片底部 | 一行总结（取自实验库 §10） |

**绕过入口**（联调/演示用，不写 localStorage）：\`?force=1\`、\`?demo=1\`、\`?play=demo\`。

自动化：
\`\`\`bash
BASE_URL=http://localhost:3001 node scripts/shot-bopbps.mjs exp01
# 断言：前测页出现 / 错题给解析 / 全对解锁操作台 / 后测页出现 / 后测提交出分
# 截图落 %TEMP%\\chemlab-shots\\bopbps\\
\`\`\`

数据来源：\`lib/pedagogy/curriculum/expNN.ts\`（60 题，逐字取自 \`docs/实验库/expNN.md\` §2/§3/§9/§10）。
`;

if (t.includes("## 11. BOPPPS")) {
  console.log("已存在 BOPPPS 一节，跳过");
} else {
  t = t.trimEnd() + "\n" + section;
  fs.writeFileSync(f, t, "utf8");
  console.log("已追加 BOPPPS 一节，文件", fs.statSync(f).size, "字节");
}

// 把 BOPPPS 截图归档到 public/shots-prod/bopbps/
const src = path.join(os.tmpdir(), "chemlab-shots", "bopbps");
const dst = path.join("public", "shots-prod", "bopbps");
if (fs.existsSync(src)) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f2 of fs.readdirSync(src).filter((x) => x.endsWith(".png"))) {
    fs.copyFileSync(path.join(src, f2), path.join(dst, f2));
  }
  console.log("截图归档:", fs.readdirSync(dst).length, "张 →", dst);
}
