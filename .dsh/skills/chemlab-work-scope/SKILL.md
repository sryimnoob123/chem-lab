---
name: chemlab-work-scope
description: Use when 接手 chem-lab（化学实验虚拟仿真平台）的开发工作——说明这项工作涵盖哪些部分、每部分要产出什么、以及已就位与可选的 skill。
---

# chem-lab 工作范围与可用 Skill

## 这项工作要交付什么

面向大一《无机及分析化学实验》的在线虚拟实验平台。学生用 **2D 界面**按流程做实验，平台记录每一步，对违规操作给强负反馈；教师端看学情并导出数据；学有余力的学生做拼凑式方案设计，由 AI 点评。最终部署到**扣子编程**。

拆开看，包含七块：

### 1. 教学内容建模（10 个实验）
把教学大纲里的 10 个实验变成机器可执行的流程定义：器材清单、试剂清单、步骤顺序与依赖、每一步的判定规则。
产出：`experiments/<id>/definition.ts`。**新增实验只加文件，不改渲染器。**

### 2. 2D 交互动画
SVG 画器材（试管、烧杯、滴定管、天平），用状态机驱动液面高度、颜色变化、气泡、沉淀、读数显示。
产出：`components/Stage.tsx`（通用舞台）+ 每实验的视觉状态。

### 3. 安全规则引擎（产品的灵魂）
违规操作要有可见后果（爆炸、有毒气体、液体溅出、读数偏差），并讲清「为什么错 / 正确做法 / 扣多少分」。
产出：`lib/rules/` —— 一条规则 = 触发条件 + 后果动画 + 讲解文案 + 扣分值。

### 4. 学生端
实验入口与顺序锁、逐步操作界面、过程记录、报告提交、AI 导师对话（流式）。

### 5. 教师端
名单导入与管理、学情看板（按实验/按学生）、数据导出（Excel，字段与页面数字必须一致）。

### 6. AI 评估
两条线：① 拼凑式方案的可行性判定（选试剂/浓度/步骤/指示剂 → 判是否可行）② LLM 点评。扣子内置大模型，不用自己管 key。

### 7. 数据与部署
PostgreSQL schema 与可重复执行的迁移；环境变量开发/生产隔离；扣子部署（一键、只认 main、只同步 schema）。硬约束见 skill `coze-coding-webapp`。

---

## 已就位的 skill（项目级 `.dsh/skills/`）

| skill | 管哪块 |
|---|---|
| `coze-coding-webapp` | 第 7 块：扣子部署的全部限制与迁移判据 |
| `frontend-design` | 视觉方向：动手前定色值/字体角色/标志元素，禁 generic 字体 |
| `emil-design-eng` | 第 2 块：动效规则（ease-out、≤300ms、按下 scale(0.97)、浮层原点） |
| `vercel-react-best-practices` | 前端性能：70 条规则，优先消除请求瀑布流与包体积 |
| `supabase-pg-best-practices` | 第 7 块：PG schema/迁移/索引/慢查询（适用于任何 Postgres，不绑 SDK） |
| `webapp-testing` | 验收：起前后端 + 先侦察再执行的浏览器测试 + 截图留证 |
| `systematic-debugging` | 排障：四阶段根因分析，先复现再改 |
| `chemlab-work-scope` | 本文档本身 |

## 还可以自己去找的方向（按需，别一次装齐）

- **前端视觉/动效**：`npx skills find "design"` / `"animation"`；关注 Anthropic、Vercel、Emil Kowalski 这类来源
- **可访问性与规范检查**：`"accessibility"`（收尾阶段用）
- **数据库**：`"postgres"` / `"drizzle"` / `"migration"`
- **测试**：`"playwright"` / `"e2e"` / `"testing"`
- 判据就三条：来源可信（有星、有作者）、不与现有 skill 讲同一件事、不假设我们用不了的平台能力（Supabase Auth/RLS、Vercel 部署、WebGL）

## 插件与 MCP（dsh 侧另有一套生态）

`dsh plugin --profile chemlab add <包名>`（dsh CLI 不在 PATH，用 `E:\TOOLS\dsh\resources\runtime\cli\bin\dsh.cmd`）。

**profile `chemlab` 已配好，不要重复装**（完整决策与证据见 `docs/dsh-profile-chemlab.md`）：

| 已装 | 用途 |
|---|---|
| `@deepseek-ai/dsh-experimental-agent-team-profile`（内置） | 多 agent 并行：spawn_teammate / team_task_* / wait_agent |
| `dshmarket` | 插件市场入口（620K 下载 / 6.8K★） |
| `billion-context` | 长会话上下文压缩（1.78M 下载） |
| `dsh-checkpoint-rewind` | `/checkpoint` `/rewind` 三态快照 |
| `@michengai/dsh-code-review` | `/review` 独立子 agent 审 diff |
| `dsh-diff-approval` | 逐文件 diff 审批台 |
| `dsh-builtin-browser` | localhost 截图留证、evaluate |

MCP：`browseros-neo`（登录态站点）、`magpie-search`、`context7`（实时文档）、`playwright`（只做移动端视口/trace）。

**已调研并否决**的候选（别再装第二遍）：`dsh-agent-teams`（npm 上不存在）、`dsh-claude-move`（本机无会话可迁）、视觉桥类（模型本身能读图）、`dsh-db-tool` 等数据库插件（连不上 PGlite）、记忆类（污染上下文）、部署类（与扣子链路正交）——理由逐条写在 `docs/dsh-profile-chemlab.md`。

装第三方插件 = 在本机跑第三方代码，先看源码。

---

## 环境与技术栈（已就位，直接用）

- Next.js 16 App Router + TypeScript strict + Tailwind v4 + Drizzle
- 开发库 **PGlite**（项目内 `.pgdata`，零安装）；正式接扣子托管 PG
- 测试：vitest（逻辑）+ Playwright（E2E，桌面/手机双视口）
- 真 PostgreSQL 17 在 `E:\TOOLS\pgsql`，服务 `postgresql-x64-17` 监听 5432
- 命令：`npm run dev / typecheck / lint / test / e2e / db:init`（`db:init` 前先停 dev，PGlite 是独占的）
- 工程约定：项目根 `AGENTS.md`（语言栈、目录、代码规范、三层测试流程）

已踩过的坑记在 `docs/环境说明.md`（PGlite 的 Turbopack 路径问题、Next 16 改 tsconfig、ESLint 9 无 next lint、端口占用导致假「读取失败」、skills 落点、PGlite 独占）。
