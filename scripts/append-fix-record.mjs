import fs from "node:fs";

const file = "docs/交付说明.md";
const cur = fs.readFileSync(file, "utf8");
if (cur.includes("## 9. 收尾修复记录")) {
  console.log("已存在第 9 章");
  process.exit(0);
}

const lines = [
  "",
  "## 9. 收尾修复记录（2026-10-21 05:55 · 生产口 3001 验收）",
  "",
  "三条已知问题已修：",
  "",
  "| # | 问题 | 修法 | 证据 |",
  "|---|---|---|---|",
  "| 1 | 投放不写时间线 | 新增 `POST /api/runs/[id]/drops`（`kind:\"drop\"`），报告时间线显示「投放 氢氧化钠 → 锥形瓶 · 反应文案」，重放与计分跳过该行 | `evidence/prod-fix/report-before-drop.png` / `report-after-drop.png` |",
  "| 2 | 演示进报告取错记录 | 演示交卷跳 `?demo=1`，报告顶部出琥珀色说明条「演示示例 · 非本次 run」（`data-demo-id=demo-report-notice`） | `evidence/prod-fix/demo-report-notice.png` |",
  "| 3 | 点选无器皿高亮 | `scene-stage.tsx` 锥形瓶热区 `data-drop-target={selectedId||draggingId}`，复用 CSS 虚线环伪元素 | `evidence/prod-fix/exp09-drop-target.png` |",
  "",
  "**生产口（3001）三套脚本**：flow-chain **9/9**（pageerror 0）、five-modes **7/7**、双步骤分支 **30/30**（pageerror 0）。",
  "",
  "**20 轮浸泡**（登录 → 实验 → 操作 → 交卷 → 退出）：**20/20 通过**，pageerror **0**，堆 3.1 → 3.2 MB（首尾 +0.1 MB，后半段 +0.1 MB），判定**无泄漏**。明细 `evidence/prod-fix/soak-summary.json`。",
  "",
  "**验收辅助**：三套脚本已支持 `BASE_URL` 环境变量（默认 3000，生产用 `BASE_URL=http://localhost:3001`）；`flow-chain.mjs` 已忽略 favicon 这类静态资源 404（不算页面异常）。",
  "",
];

fs.writeFileSync(file, cur + lines.join("\n"), "utf8");
console.log("已追加第 9 章");
