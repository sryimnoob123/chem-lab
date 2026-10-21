/**
 * 更新 docs/项目交接.md：追加「2026-10-21 晚 演示收尾轮」一节（幂等）。
 * 注意：模板字符串内不使用反引号。
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "docs/项目交接.md");
const MARK = "## 2026-10-21 晚 · 演示收尾轮";

const TEXT = `
---

${MARK}

### 这一轮改完的状态

| 项 | 结果 |
|---|---|
| 完整链路 verify-full.mjs | exp01 20/20、exp08 21/21、exp09 23/23，失败项 0 |
| 报告页 | 三个实验全部有：总分 / 本次总结 / 能力点 / 错题解析 / 导出 CSV |
| 教师端 | /teacher 表格 40 行，能看班级成绩 |
| 对比度 | contrast-audit /exp/exp01 = 0 严重 0 偏低 |
| 单测 | liquid-mix 19 条、report summary 10 条、guide 17 条，全过 |
| tsc / lint / build | 空 / 0 error / 成功 |

### 关键修复（按影响排序）

1. 实验台改亮场：暗底 #0E1620 + 墨线 #16202C@70% 对比度约 1.3:1，学生看不清器皿。
   现在 --bench-ink = 纸白 #F6F7F5，器皿墨线 rgba(74,87,104,X)，事故时才压暗。
2. .fxSlot::before 被批量换色误写成 rgba(246,247,245,.90)：一块 90% 白板盖住整个实验台，
   是"器皿看着消失"的真凶。对比度脚本查不到（它只算文字），已改回 .28。
3. 液体混色：旧 liquidColorFor 直接返回最后一次试剂颜色 → 红+黄倒进去同色。
   新 lib/scene/liquid-mix.ts 按化学语义（沉淀 > 指示剂 > 配位 > 基础色 > 水色）计算。
4. 报告页顺序：交卷后第一眼是总分 + 本次总结，后测移到后面。
5. 列表 3 + 7：FEATURED_IDS = exp01/exp09/exp08，其余禁用为"即将开放"。

### 两个必须记住的坑

1. npm run build 之后**必须**运行 scripts/restart-prod.ps1（同步 .next/static），
   否则整页无样式、所有 e2e 全红。
2. **flow-smoke.mjs 用 ?force=1 绕过了前测门禁**，所以"8/8 通过"不代表真实学生路径能走通。
   真实路径必须用 scripts/verify-full.mjs（它会先做 3 题前测再进操作台）。

### 仍未做完

- 扣子线上还是旧版：coze code repo pull 返回 success，但部署 commitHash 不变、
  线上文案仍是"登录并进入实验"。扣子的版本树不认 GitHub commit，
  已发 coze code message send 让项目 AI 同步并重新部署（processing）。
  若仍不通，需要人工在 code.coze.cn 界面点同步/部署。
- 实验台留白偏多（器皿居中但左下/右下空），下一步可加台面质感或放大器皿。
- 7 个"即将开放"实验：内容在、交互未打磨。
- GSAP（DrawSVG / MorphSVG / Timeline）只做了评估，未接入。

### 演示当天怎么起

    $env:PGLITE_DIR = (Join-Path (Get-Location).Path ".pgdata-prod2")
    & ".\\scripts\\restart-prod.ps1"
    # 打开 http://localhost:3001
    # 学生 20250101 / 周若曦（登录页已预填），教师口令 2026
    # 演示动线：列表点 exp09 → 前测 3 题 → 看板指引 → 操作 → 交卷 → 总结 + 导出 → 教师端
    # 一键跳过：实验页 URL 加 ?demo=1，右上角出现「跳过实验」
`;

const text = fs.readFileSync(file, "utf8");
if (text.includes(MARK)) {
  console.log("已存在，跳过");
} else {
  fs.writeFileSync(file, text + TEXT, "utf8");
  console.log("已追加项目交接文档");
}
