# chem-lab 工程约定（webapp profile 必读）

## 0. 交付目标
本地全栈 Web 应用 → 验收全绿 → 推 GitHub main → 扣子编程（code.coze.cn）导入并一键部署。
扣子硬约束见 skill `coze-coding-webapp`（动工前读）。

## 1. 语言与栈（定死，别自由发挥）
- **TypeScript strict**，不开 `any` 逃生门（要逃就用 `unknown` + 收窄）。
- **Next.js App Router**：默认 Server Component；只有需要事件/状态的文件才 `'use client'`。
- **样式 Tailwind** + 少量 CSS 变量做主题；不引 CSS-in-JS、不引组件库（除非先讨论）。
- **交互：SVG + CSS transition/animation**。Canvas 仅在元素数 >200 或需要逐帧绘制时用。
- **数据库：PostgreSQL**。本地 Docker 起；驱动 `postgres.js` 或 Drizzle 二选一（**先定一个，不许混用**）。
- **禁止**：Supabase SDK（auth/storage/realtime）、Firebase、MongoDB、任何要求专属 SDK 的 BaaS —— 扣子上没有。
- **状态**：实验流程用显式状态机 `lib/engine.ts`；组件内 `useReducer` 够用，不引 redux/zustand。

## 2. 目录
```
app/                     路由与页面
components/              纯展示组件（不含业务规则）
lib/engine.ts            状态机：apply(action) -> state + events
lib/rules/               安全与操作规则（违规 → 后果 + 文案 + 扣分）
lib/timeline.ts          每步记录
lib/assess.ts            规则打分 + LLM 点评
experiments/<id>/        每个实验一份定义（器材/试剂/步骤 DAG/反馈）
db/migrations/           可重复执行的 DDL
strings.ts               所有用户可见文案（集中，便于改措辞）
```

## 3. 代码规范
- 单文件 ≤ 300 行，超了拆。
- **组件不写业务规则**：规则进 `lib/rules`，组件只渲染。
- 用户可见文案一律走 `strings.ts`，不散落在 JSX 里。
- 命名：文件 kebab-case、组件 PascalCase、函数 camelCase、常量 UPPER_SNAKE。
- 不硬编码路径/密钥/域名。资源路径用 `/${COZE_WORKSPACE_PATH}/assets`。
- 动画只动 `transform` / `opacity`；不要动画 `width/height/top/left`（会抖、会掉帧）。
- **不引动画库**：不用 framer-motion / GSAP / react-spring。`emil-design-eng` 等 skill 会推荐 Motion/spring，**本项目以这条为准**——动效一律 CSS transition/keyframes，常规交互 ≤300ms，按下 scale(0.97)。
- 移动端优先验证：触控区 ≥44px，横屏/竖屏都不许横向溢出。

## 4. 测试流程（三层，按改动范围跑）
1. **每次改完必跑**：`npm run lint` + `npx tsc --noEmit`，必须全绿才算改完。
2. **逻辑层 vitest**：规则引擎、判定、计分、时间线 —— 新增一条规则必须带用例。
3. **端到端 Playwright**：关键路径「进实验 → 做一步 → 有反馈 → 出结果」。本地起 dev server 后跑。
- 他会随时手点：每次交付给 URL + 「点哪、预期什么」清单，别只给一句"做好了"。

## 5. 提交与交接
- 小步提交；message 写「改了什么 / 为什么」。
- 提交前用 `requesting-code-review` skill 过一遍。
- 部署前跑一遍 skill `coze-coding-webapp` 的清单。

## 6. 作战方式：默认并行（硬要求，不是优化项）

**节点：2026-10-22（周四）晚必须能演示。今天 10-20，所有排期从这一条倒推。**
做任何计划前先算：还剩几个半天、每个板块要几个半天、哪块可以砍。

### 6.1 多 agent 并行是默认姿势

用 dsh 内置的 **Agent Team**（`@deepseek-ai/dsh-experimental-agent-team-profile`，profile `chemlab` 已挂载，**并行上限已调到 20**）：
`spawn_teammate` 开角色 / `team_task_create` 建任务（写明 `write_scopes`）/ `send_message` 定向补信息 / `wait_agent` 汇合。

**提速靠的就是频繁并行**，不要一个 agent 从头串到尾。判断标准：只要有两件互不依赖的事，就开两个角色同时做。

规模与配额（profile 已配 `maxMembers: 20`、`maxTasks: 512`）：
- 常规作业 **6~10 个**成员；赶节点、板块清晰、写作用域互不重叠时可拉到 **16~20**。
- 单个 agent 单轮并行工具调用上限约 **10**，需要更多就分批，或用 `workflow` 脚本扇出（`parallel` / `pipeline`，默认并发约 10）。
- 超过 20 会排队；**排队不是免费**——每个成员都吃上下文和 token，够用就停，不要为了"看起来快"空转。

规矩：
- **一个板块一个 owner**，写作用域不许重叠；任务上写清楚 `write_scopes`，有先后依赖就挂 `blocked_by`。
- **共享文件只有 Lead 能改**：`AGENTS.md`、`db/schema.ts`、`strings.ts`、`package.json`、任何 `*.config.*`。
- 开三个以上角色时，Lead 先输出一行「这次要达成什么、并行几条、预计多久」，**职责让成员自己认领**，不要逐条派活。
- **不许串行硬扛**：单条子任务 20 分钟没进展，换人/拆小/降级范围，并在团队任务里记一句为什么。
- 大批量、同构的活（如 10 个实验定义、全量页面巡检）用 `workflow` 一次扇出，不要手写 20 次 `spawn_teammate`。
- 汇合前必须 `wait_agent` + `team_task_list` 确认没有挂在 `in_progress` 的活；有则追问或接管。

### 6.2 分工由团队自己定，Lead 不写死

Lead 只给**目标、约束、验收标准**，不预设谁做哪块。团队自己拆分并认领：

- Lead 先开一个问题：本次要达成什么、有哪些硬约束（技术栈、DDL、不许动的文件），然后让成员**自己提拆分方案并认领**。
- 谁认领哪块，就由他自己在 `.team/tasks/<自己起的名字>.md` 写任务卡（目标 ≤5 条、独占哪些文件、验收标准），并同步 `write_scopes` 到团队任务板。
- Lead 只做三件事：**判冲突**（两个角色抢同一文件就叫停）、**定接口**（跨角色接口写进 `DECISIONS.md`）、**验收**（四绿 + diff）。
- 拆分结果没人满意时，Lead 才给建议方案，但仍由成员认领，不硬派。

唯一不变的硬规矩：**同一文件同一时间只有一个 owner**，共享文件（`AGENTS.md`、`db/schema.ts`、`strings.ts`、`package.json`、`*.config.*`）只有 Lead 能改。

### 6.3 汇合与验收

- Lead 负责最终 diff 审查，并跑四绿：`npm run lint` / `npm run typecheck` / `npm run test` / `npm run e2e`。
- 任何「好了」必须带证据：命令输出、断言数、截图路径。没有证据视为没做。
- 改坏了先 `/rewind` 回滚（checkpoint-rewind 已装），不要在坏状态上继续叠改动。

### 6.4 上下文落盘（4~10 个队友时必须遵守）

并行队友各自上下文独立且有限，**会被压缩/截断/注意力偏移**。所以：

- **没写进 `.team/` 的结论 = 没发生过。** Lead 汇合只读文件，不从对话里回忆。
- 开工前读 `.team/tasks/<你的轨道>.md` + `.team/DECISIONS.md`；**不读别人的 notes**（省上下文）。
- 每完成一个可验收小块，立刻往 `.team/notes/<角色>.md` **追加**一条（格式见 `.team/notes/TEMPLATE.md`）：做了什么 / 证据 / 改了哪些文件 / 下一步。
- 角色结束前写 `.team/handoff/<角色>.md`（≤20 行），下一个人只读它就能接上。
- 队友回复里**只给"已落盘到 X"**，不把大段结论塞回对话。
- Lead：spawn 前写任务卡（≤20 行，只给该角色需要的接口）；汇合时看 `git diff --stat` + notes 末尾几条。
- 上下文吃紧就换人：先让其写 handoff，再 `interrupt` 换新队友，**换人不换文件**。

## 7. 本 profile 已配置的能力（chemlab）

| 能力 | 什么时候用 |
|---|---|
| `/review`（dsh-code-review） | 每批改动提交前，独立子 agent 只读审查，出报告 |
| diff-approval 面板 | 提交前逐文件看 diff，Keep/Revert；比 `/review` 更快更细 |
| `/checkpoint` `/rewind`（checkpoint-rewind） | 大改前打点；改坏了一键回退（含配置） |
| `dsh_browser_*`（builtin-browser） | 打开 localhost、截图落盘留证、无障碍树、页面内 evaluate |
| MCP `playwright` | **只**用于移动端视口 390×844、trace 录制、网络 mock/断言 |
| `dshmarket` | 设置页里的插件市场，找新插件用 |
| billion-context | 长会话上下文压缩，卡上下文时自动生效 |
| MCP `browseros-neo` | 需要登录态的真实网站；**不要**用它开 localhost |
| MCP `magpie-search` | 联网搜索 |
| MCP `context7` | Next 16 / React 19 / Drizzle 的实时文档（训练数据过期时查它） |

已装插件之外的**不要**自行再装：装插件 = 在本机跑第三方代码，先在本任务里讨论。
完整的装了什么/为什么不装别的，见 `docs/dsh-profile-chemlab.md`（已调研 6000+ 社区插件，别重复踩）。

## 8. 侧边栏点测回路（用户会随时点）

用户会在 dsh Web UI 的**侧边栏里随时点测**，不预先通知。所以：

- 每次交付 = **可点的 URL + 「点哪、预期什么」清单**，别只说"做好了"。
- 测什么、用哪个工具（别混用）：

| 测试类型 | 用哪个 |
|---|---|
| 桌面视口看页面、截图留证 | 内置 `dsh_browser_*`（localhost:3000） |
| 移动端 390×844 / 触控行为 | MCP `playwright`（`--viewport-size=390x844`） |
| 需要登录态的真实网站 | MCP `browseros-neo`（**禁止**拿它开 localhost） |
| 页面内部状态/断言 | `dsh_browser_evaluate` 跑 JS（比肉眼看截图准） |

- 截图统一落 `%TEMP%\chemlab-shots`，回话里给路径。
- 点测反馈"点了没反应"时：先复现 + 给根因，**不许猜着同时改三处**。
- 如果发现某类测试现有工具做不到（新视口、录屏、网络回放等），**先报给 Lead**，由 Lead 决定加插件还是 MCP——不要自己装。

### 8.1 需要人拍板时怎么问

- 提问走 `ask_user_question`：它会**同时**弹到桌面 UI 和飞书手机卡（ask-router 已配），先答先得。所以问题要写清楚到"看手机也能答"的程度：给选项，别只给一段话。
- 用户经常在换办公地点，**别假设他就在电脑前**：需要他决策的，发出去就 `wait_agent` 式地等，不要自己替他拍。
- **特别难判定 / 有歧义的测试，以用户口径为准**：先问一次拿到判据，再动手；不要先做完再问"这样可以吗"。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
