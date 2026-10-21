/**
 * 给 .team/DECISIONS.md 追加本轮决策（一次性，幂等）。
 * 注意：本文件在模板字符串里**不使用反引号**，避免把字符串截断。
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".team/DECISIONS.md");
const MARK = "## D-021 ~ D-030 · 演示收尾轮（2026-10-21 晚）";

const TEXT = `
---

${MARK}

用户这一轮的口径变化（原文要点）：实验流程不明确、右侧 UI 堆叠、中间面板对比度低、
不同液体倒进去变成同色、动画质量差（问 Three.js / 更好的 2D 动画）、
不要鉴权直接登录、学生端不要教师端的东西、两端分开、做完实验要有总结、
演示只做一个实验然后跳过、导出表格、10 个实验只精做 3 个。

| # | 决策 | 为什么 | 证据 / 落点 |
|---|---|---|---|
| D-021 | 实验台改亮场（纸白 #F6F7F5 + 墨线 rgba(74,87,104,X)） | 暗底 #0E1620 + 墨线 #16202C@70% 对比度约 1.3:1，学生看不清器皿与液体；亮底才像玻璃 | globals.css token；contrast-audit 从 53 严重 → 0；STYLE-20261021.md |
| D-022 | 液体颜色按化学语义混合，废弃"取最后一次试剂" | 旧 liquidColorFor 直接返回 last，导致红+黄倒进去同色 | lib/scene/liquid-mix.ts + 19 条单测；vessel-art.tsx 接线 |
| D-023 | 实验列表 3 个重点 + 7 个"即将开放"（禁用） | 现场一定会点第 5 个；半成品被点开比"明确未开放"更掉分 | app/experiments/page.tsx 的 FEATURED_IDS；?unlock=all 保留调试 |
| D-024 | 学生端 / 教师端彻底分开 | 用户："学生端就学生端的，教师端就教师端的" | shell.tsx 删 /teacher 入口与 /demo 导航；报告页删"查看教师端" |
| D-025 | 登录改为预填 + 一键进，但不削弱后端鉴权 | 用户要求"点了直接进"；但成绩归属依赖 studentNo，直接放开白名单会破坏数据口径 | login/page.tsx 预填 20250101/周若曦 + enterAs()；/api/session 未改 |
| D-026 | 「拼接式方案设计」正名为「进阶学习」 | 用户明确要求改名 | shell.tsx 导航 + app/plan/page.tsx metadata + designer.tsx h1 |
| D-027 | 报告页新增「本次总结」+ 单次导出 CSV | 用户："做完实验之后有一个总结，整个实验的表现" + "提供导出的表格" | lib/report/summary.ts（10 条单测）+ /api/runs/[id]/export |
| D-028 | 「跳过实验」仅演示模式可见 | 用户演示时不想逐步做完；但常驻等于教学生逃课 | workbench.tsx 的 skipVisible（?demo=1 或 ?play=demo） |
| D-029 | GSAP 只做技术评估，本轮不接入 | 许可已放开（3.13 起商用免费），但"亮场 + 混色 + 流程"才是演示成败项；同天引入两个大改风险相乘 | docs/design/ASSET-LICENSES.md 记录评估结论；AGENTS.md §9 仍写"不引动画库" |
| D-030 | 构建与重启必须两步 | Next standalone 不带 .next/static，漏了就是整页无样式、e2e 全红（已踩） | AGENTS.md §9.3；scripts/restart-prod.ps1 |

### 对抗性审查记下来的三条（防复发）

1. 不要用"7 个简单流程"糊弄：观众会点开。要么精做，要么明确禁用。
2. 大改不要叠在同一天：亮场（1700 行 CSS）+ GSAP（动画管线重写）同时上，任何一边翻车都会拖垮验收。
3. 工作量超过 10 小时就必须砍：这一轮从 14 个工作面砍到 8 个 P0，才留出彩排时间。

### 本轮未做 / 明确不做

- Lottie / Rive（需要美术产线）、全量 Three.js（10 个器皿建模做不完）
- 封面与实验室风格图（用户："暂时不用太去管"）
- 恢复一键演示入口（已下线，代码保留）
- 关闭登录鉴权（改为预填 + 一键，不动后端）
`;

const text = fs.readFileSync(file, "utf8");
if (text.includes(MARK)) {
  console.log("已存在，跳过");
} else {
  fs.writeFileSync(file, text + TEXT, "utf8");
  console.log("已追加 DECISIONS.md D-021~D-030");
}
