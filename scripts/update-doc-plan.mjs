import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const f = "docs/自测清单.md";
let t = fs.readFileSync(f, "utf8");

const section = `
## 12. 拼接式方案设计（/plan）+ 教师端学情导出

### 12.1 方案设计
- 入口：\`/plan\`（需学生登录）；素材 31 块（器材 9 / 试剂 8 / 步骤 10 / 参数 5），来自 \`lib/plan/pieces.ts\`
- 交互：左侧按类目点选 → 右侧流程（可 ↑↓ 调序、✕ 移除）→ 实时跑 \`lib/plan/rules.ts\` 的 21 条规则
- 判定：\`100/100 · 可行\` 为满分方案；缺关键块会掉分并列出违规（红=block，黄=warn）
- 保存：\`POST /api/plans\` → 落库返回 planId

| 场景 | 预期 |
|---|---|
| 首次进入 | 空方案，立即给出 13 条违规（不是空白页） |
| 点「载入参考方案」 | **100 / 100 · 可行**，校验 21 条通过、0 问题 |
| 去掉「无水 Na₂CO₃」 | 掉到 **88 / 100 · 不可行**，出现 1 条 block |
| 点「保存方案」 | 出现「已保存方案 <uuid>」 |

### 12.2 教师端导出
- 入口：\`/teacher\`（顶栏「教师解锁」→ 口令 \`2026\`）→ 「导出学情 CSV」
- CSV：\`chem-lab-学情-<日期>.csv\`，**UTF-8 BOM**（Excel 直接开中文不乱码）
- 表头：\`学号,姓名,班级,实验,状态,完成度,操作分,报告分,总分,事故数,最近活跃\`
- 未解锁点导出：提示「请先在右上角教师解锁」（后端 403，不会白屏）

自动化：
\`\`\`bash
BASE_URL=http://localhost:3001 node scripts/plan-teacher-check.mjs
# 断言：空方案 13 条违规 / 参考方案 100 分 / 反例 88 分 / 保存落库 /
#      教师解锁 / 导出 CSV 含 BOM / 表头正确
# 截图落 %TEMP%\\chemlab-shots\\plan-teacher\\
\`\`\`
`;

if (t.includes("## 12. 拼接式方案设计")) {
  console.log("已存在第 12 节，跳过");
} else {
  t = t.trimEnd() + "\n" + section;
  fs.writeFileSync(f, t, "utf8");
  console.log("已追加第 12 节，", fs.statSync(f).size, "字节");
}

// 归档截图
const src = path.join(os.tmpdir(), "chemlab-shots", "plan-teacher");
const dst = path.join("public", "shots-prod", "plan");
if (fs.existsSync(src)) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f2 of fs.readdirSync(src).filter((x) => x.endsWith(".png"))) {
    fs.copyFileSync(path.join(src, f2), path.join(dst, f2));
  }
  console.log("截图归档:", fs.readdirSync(dst).length, "张 →", dst);
}
