/**
 * 给 AGENTS.md 追加"本轮新增约定"（一次性，幂等）。
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "AGENTS.md");
const MARK = "## 9. 本轮新增约定（2026-10-21 晚）";

const TEXT = `
---

${MARK}

这一节是这几天踩坑后的硬约定，**优先级高于本文前面任何"看起来更优雅"的做法**。

### 9.1 实验台是亮场
- 场景底色走 \`--bench-ink\`，值已是纸白 \`#F6F7F5\`；暗场 token 另存为 \`--bench-ink-dark\` 等，**只在事故 L3/L4 反差、演示浮层局部使用**。
- 器皿描边用 **\`rgba(74, 87, 104, X)\`（= \`--ink-2\`）**，不要用浅灰 \`rgba(201,214,228,X)\`（那是暗场配色，纸白底上约 1.2:1，肉眼几乎不可见）。
- 纸白底上**不要用白色高光**表现玻璃：高光要改成淡墨阴影（\`rgba(74,87,104,.12)\`）。
- 改完必须跑：\`node scripts/contrast-audit.mjs "/exp/exp01?force=1"\`，要求 **0 严重**。

### 9.2 液体颜色只能走混色表
- 禁止再写"取最后一次试剂颜色"那种逻辑（旧 \`liquidColorFor\` 的坑：红+黄倒进去还是同色）。
- 统一用 \`lib/scene/liquid-mix.ts\` 的 \`mixLiquids(ids)\`，优先级：**沉淀/气体 > 指示剂变色 > 配位 > 有色基础液 > 水色兜底**。
- 新增反应物组合时：先在 \`PRECIPITATES\`/\`BASE_COLORS\` 里加一行，再补 \`liquid-mix.test.ts\` 用例。

### 9.3 构建与重启是两步
- \`npm run build\` 之后**必须** \`& ".\\scripts\\restart-prod.ps1"\`。
- 原因：Next standalone 不带 \`.next/static\`，漏了会"整页无样式"，所有选择器失效、e2e 全红（我们已经在 10-21 踩过一次）。
- 该脚本最后一步用了 \`$home\` 变量，和 PowerShell 只读变量 \`$HOME\` 冲突会报错退出，但**服务其实已经起来了**——用 \`Invoke-WebRequest http://localhost:3001\` 验证即可，别当失败重来。

### 9.4 演示开关
- \`components/demo/demo-overlay.tsx\` 的 \`DEMO_ENTRY_ENABLED = false\`：一键演示入口已下线，代码保留。
- 「跳过实验」按钮只在 \`?demo=1\` 或 \`?play=demo\` 出现（\`workbench.tsx\` 的 \`skipVisible\`），**不要改成常驻**——学生看到等于教逃课。
- 所有 \`data-demo-id\` 一律保留，改名等于砸掉演示脚本和 e2e。

### 9.5 学生端 / 教师端分开
- 学生端导航（\`components/app/shell.tsx\` 的 \`MAIN_NAV\` 与侧边栏）**不得出现"教师端"入口**。
- 学生与教师是两套后台：\`/experiments\` 与 \`/teacher\`，不要互相嵌入。
- 登录页已预填演示账号（\`20250101\` / \`周若曦\`）并支持"一键进"；**后端白名单与口令校验保持不变**（成绩归属依赖 studentNo）。

### 9.6 实验列表是 3 + 7
- \`app/experiments/page.tsx\` 的 \`FEATURED_IDS\` = 三个精做实验；其余收进「更多实验」并置为禁用态（"即将开放"）。
- \`?unlock=all\` 才放开全部 10 个，用于调试。
- 要"升级"某个实验为精做：改 \`FEATURED_IDS\` 一行，不要改渲染结构。

### 9.7 报告页要给结论
- 交卷后学生先看到「本次总结」（\`lib/report/summary.ts\` 的 \`buildRunSummary\`）：一句话 + 完成步骤/事故/用时。
- 导出用 \`/api/runs/[id]/export\`（单次记录），与教师端 \`/api/teacher/export\`（全班学情）区分，别合并。

### 9.8 颜色一律走 token
- 改颜色只准改 \`app/globals.css\` 的 token 或引用 \`var(--…)\`，不要在组件里写字面量。
- 批量扫暗底/白字可用：\`node scripts/fix-light-theme.mjs\`、\`node scripts/fix-white-hover.mjs\`（都是幂等的）。
- 审计脚本查不到 SVG 属性里的颜色（\`stroke\`/\`fill\` 写死在 JSX 里），这部分要人工看或者补 \`lab-apparatus.tsx\` 的检查。
`;

const text = fs.readFileSync(file, "utf8");
if (text.includes(MARK)) {
  console.log("已存在，跳过");
} else {
  fs.writeFileSync(file, text + TEXT, "utf8");
  console.log("已追加 AGENTS.md 第 9 节");
}
