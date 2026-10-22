# chem-lab 工程约定（webapp profile 必读）

## 0. 交付目标
本地全栈 Web 应用 → 验收全绿 → 推 GitHub main → 扣子编程（code.coze.cn）导入并一键部署。
扣子硬约束见 skill `coze-coding-webapp`（动工前读）。

### 0.1 扣子部署 / 预览配置（code.coze.cn 一键部署用）
- `.coze` 已按扣子标准补齐：`sub_id=ff55e765`、`project_type=web`、`requires=["nodejs-22"]`，
  预览 `preview_enable=enabled`（web 类型可预览）。`sub_id` 创建后不可改。
- `.preview` 固定 `expose_port=5000`（已加 `.gitignore`，不提交 git）；对平台只暴露 5000，端口不 hardcode 到代码。
- 预览（`.coze [dev]`）→ `scripts/dev_build.sh` + `scripts/dev_run.sh`（`npx next dev --hostname 0.0.0.0 --port <expose_port>`）。
- 部署（`.coze [deploy]`）→ `.cozeproj/scripts/deploy_build.sh`（`npm ci` + `npm run build`）+ `deploy_run.sh`（`npm run start -- --port ${PORT:-5000}`）。
- 构建命令 `npm run build`、启动命令 `npm run start`（端口取平台注入的 `PORT`，缺省 5000）。Node 22。

### 0.2 线上数据库（扣子部署必读，2026-10 踩坑）
- 扣子线上容器文件系统**只读**：只要 `lib/db/index.ts` 的 `resolveDatabaseUrl()` 返回 null，就会 fallback 到
  PGlite 本地文件模式，尝试 mkdir `/opt/bytefaas/.pgdata` → EROFS → `/api/experiments` 等接口 500。
- 因此**线上必须注入真实 PostgreSQL 连接串**才能跑通数据接口。代码按优先级探测：
  `DATABASE_URL` / `COZE_DATABASE_URL` / `COZE_PG_URL` / `COZE_POSTGRES_URL` / `COZE_DB_URL` / `POSTGRES_URL`
  （须为 `postgres://` 或 `postgresql://` 开头），或拆分段 `COZE_PG_HOST`|`PGHOST` + `COZE_PG_USER`|`PGUSER`
  + `COZE_PG_DATABASE`|`PGDATABASE`（host/user/database 三者齐全，端口 `COZE_PG_PORT`|`PGPORT` 缺省 5432）。
- 本地开发/预览无 `DATABASE_URL` 时走 PGlite（`.pgdata`，可写），`/api/experiments` 正常 200。
- 详见 `lib/db/index.ts` 注释与 `docs/扣子部署适配.md`。

### 0.3 干活的地方与 skill 落点
- 开发、验收、批量测试都在 **Hermes profile `webapp`** 这边做，只维护这一套环境。
- skill 副本在 `%LOCALAPPDATA%\hermes\profiles\webapp\skills\<category>\<name>\`；社区原件在 `~/.dsh/skills`，
  **只当源，不当工作目录**。两边格式同源（`SKILL.md` + YAML frontmatter + 资源子目录），复制即可用。
- 加 skill：`cp -r ~/.dsh/skills/<name> <profile>/skills/<category>/`；改 skill 走 `skill_manage`，别手改副本。
- **能查 skill 的不在本文重写**，本文只留指针和本项目特有的硬约定。

## 1. 语言与栈（定死，别自由发挥）
- **TypeScript strict**，不开 `any` 逃生门（要逃就用 `unknown` + 收窄）。
- **Next.js App Router**：默认 Server Component；只有需要事件/状态的文件才 `'use client'`。
  改路由/缓存/渲染前先看 `node_modules/next/dist/docs/`（这一版与训练数据有出入），要实时文档用 MCP `context7`。
- **样式 Tailwind** + 少量 CSS 变量做主题；不引 CSS-in-JS、不引组件库（除非先讨论）。
- **交互：SVG + CSS transition/animation 为主**。弹簧、布局/共享元素动画、退场动画、可打断手势才上 Motion（判据见 §3.1）。
  Canvas 仅在元素数 >200 或需要逐帧绘制时用。
- **数据库：PostgreSQL**。本地 PGlite（`.pgdata`）开发，线上接扣子托管 PG；驱动已定 **Drizzle**（`drizzle-orm` + `postgres`），
  不许混用第二套。schema / 索引 / 迁移规则见 skill `supabase-postgres-best-practices`。
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
- 接口设计（分页、错误码、幂等、N+1）见 skill `api-design-principles`；渲染与包体积性能见 `vercel-react-best-practices`。
- 移动端优先验证：触控区 ≥44px，横屏/竖屏都不许横向溢出。

### 3.1 动效：跟 skill `animate` 的判据走，不凭手感拍值
- 顺序固定：先判「**该不该动 / 什么目的**」，再按**最便宜的工具**往下挑 ——
  CSS transition → `@starting-style` → CSS animation → WAAPI → 最后才是 Motion。
  键鼠高频（100+ 次/天）、键盘触发的操作**不动**。
- 六条硬线（`review-animations` 直接判负的那种）：
  - 进入/退场用 `ease-out`，**禁 `ease-in`**；UI 曲线用 `cubic-bezier(.23, 1, .32, 1)`，不用内置 ease-out。
  - 不用 `scale(0)` 进场，用 `scale(.95) + opacity: 0`。
  - 不用 `transition: all`，点名属性。
  - 只动 `transform` / `opacity`（`clip-path` 例外）；不动 `width/height/top/left`。
  - UI 常规交互 ≤300ms；按下 `scale(.97)`。
  - `prefers-reduced-motion` 与 `@media (hover: hover) and (pointer: fine)` 跟动画一起写，不留后续。
- **Motion（`motion.dev`）只在四处用**：拖拽带惯性的手势、需要「活」的弹簧、用户能打断/反向的交互、布局与共享元素动画。
  其余场景引库＝白加体积。GSAP / react-spring / framer-motion 仍不引（评估结论见 `docs/design/ASSET-LICENSES.md`）。
- 真用 Motion 时别写 `x/y/scale` 简写，写全 `transform` 字符串（简写不走硬件加速）。
- 页面/共享元素转场优先用原生 View Transition（skill `vercel-react-view-transitions`），零依赖。
- 提交前用 `review-animations` 自评；「哪里该动」问 `find-animation-opportunities`；全库审计用 `improve-animations`。

### 3.2 颜色：一律走 token，数值要实测
- 只准改 `app/globals.css` 的 token 或引用 `var(--…)`，组件里不写字面量。
- 色阶、语义命名、格式转换、对比度以 skill `better-colors` 为准；**不报没测过的对比度数值**。
- 无障碍（键盘、焦点、ARIA、WCAG 2.2）审 skill `accessibility`。

## 4. 测试流程（三层，按改动范围跑）
1. **每次改完必跑**：`npm run lint` + `npm run typecheck`，必须全绿才算改完。
2. **逻辑层 vitest**：规则引擎、判定、计分、时间线 —— 新增一条规则必须带用例。
3. **端到端 Playwright**：关键路径「进实验 → 做一步 → 有反馈 → 出结果」。本地起 dev server 后跑 `npm run e2e`。
- 他会随时手点：每次交付给 URL + 「点哪、预期什么」清单，别只给一句"做好了"。

## 5. 提交与交接
- 小步提交；message 写「改了什么 / 为什么」。
- 提交前用 `requesting-code-review` skill 过一遍。
- 部署前跑一遍 skill `coze-coding-webapp` 的清单。

## 6. 作战方式：默认并行（硬要求，不是优化项）

**节点：2026-10-22（周四）晚必须能演示。**

### 6.1 并行用 `delegate_task`
- **只要有两件互不依赖的事，就同一批发出两个子任务**（一次可发多个，上限 20）。不要一个 agent 从头串到尾。
- 子 agent **看不到这段对话**：目标、硬约束（技术栈、DDL、不许动的文件）、验收标准必须写进它的 `context`，否则它自己瞎猜。
- 子 agent 的自述**不是证据**：涉及写文件 / 上传 / 部署，要求返回可核对的抓手（绝对路径、URL、commit），自己再验一遍。
- 机械、同构的活（批量改文件、全量巡检、抽数据）用 `execute_code` 跑循环并落盘，中间结果不进上下文。
- 长跑（build / e2e / 爬取）用 `terminal(background=true, notify=true)`，不要阻塞对话。
- 并行不是免费的：每个子 agent 都吃上下文和 token，够用就停，别为了"看起来快"空转。

### 6.2 一个文件一个 owner
- 开并行前先划写作用域，**不许重叠**；有先后依赖就串行，或先定接口再并行。
- **共享文件只有一个 owner**：`AGENTS.md`、`db/schema.ts`、`strings.ts`、`package.json`、任何 `*.config.*`。
  多个子任务都要碰的，由主 agent 自己改。
- 单条子任务 20 分钟没进展：换人 / 拆小 / 降范围，并把为什么记一句到 `.team/notes/`。

### 6.3 汇合与验收
- 主 agent 负责最终 diff 审查，跑四绿：`npm run lint` / `npm run typecheck` / `npm run test` / `npm run e2e`。
- 任何「好了」必须带证据：命令输出、断言数、截图路径。没有证据视为没做。
- 改坏了先 `git checkout -- <file>` 或从 git 恢复，**不要在坏状态上继续叠改动**。

### 6.4 结论落盘（并行时必须遵守）
- **没写进文件的结论 = 没发生过。** 汇合只读文件，不从对话里回忆。
- 每完成一个可验收小块，往 `.team/notes/<角色>.md` 追加一条：做了什么 / 证据 / 改了哪些文件 / 下一步。
- 角色结束前写 `.team/handoff/<角色>.md`（≤20 行），下一个人只读它就能接上。

## 7. 能力与工具（Hermes `webapp`）

| 能力 | 什么时候用 |
|---|---|
| `browser_exec` | 开 localhost、截图（自动回传给我看）、页面内 `js()` 断言、CDP 无障碍树 |
| MCP `playwright` | 移动端视口 390×844、trace 录制、网络 mock / 断言 |
| MCP `context7` | Next 16 / React 19 / Drizzle 的实时文档（训练数据过期时查它） |
| `delegate_task` | 并行子 agent（§6） |
| `execute_code` | 批量 / 循环活，过滤后再进上下文 |
| `terminal` / `process_manage` | 起 dev server、读日志、长跑后台任务、kill 进程 |
| `clarify` | 需要他拍板时（§8.1） |
| `web_extract` / `web_search` | 查文档查资料；网络失败先看 skill `sakuracat` |
| skill | 落点见 §0.3。常用：`coze-coding-webapp`（扣子部署）、`animate` 四件套（动效）、`design-taste-frontend` / `impeccable` / `frontend-design` / `emil-design-eng`（视觉）、`better-colors`（配色）、`accessibility`、`webapp-testing`、`systematic-debugging`、`requesting-code-review` |

**装东西两条规矩**：
1. **Hermes 已内置的能力不再装同名 skill**（浏览器、截图、docs 查询、并行、批量脚本这些工具都有），装了只是多一份要维护的副本。
2. 新增 MCP / 插件 = 在本机跑第三方代码，先在本任务里讨论；新增 skill 从 `~/.dsh/skills` 复制即可。

## 8. 点测回路（用户会随时点）

用户会随时自己开页面点测，不预先通知。所以：

- 每次交付 = **可点的 URL + 「点哪、预期什么」清单**，别只说"做好了"。
- 测什么、用哪个工具（别混用）：

| 测试类型 | 用哪个 |
|---|---|
| 桌面视口看页面、截图留证 | `browser_exec`（`capture_screenshot()`，截图自动回传，别另开工具重复截） |
| 移动端 390×844 / 触控行为 | MCP `playwright`（`--viewport-size=390x844`） |
| 需要登录态的真实网站 | `ego-browser` 或 `browser_exec(local=True)`；**不要**用它们开 localhost |
| 页面内部状态 / 断言 | `browser_exec` 的 `js('...')`（比肉眼看截图准） |

- 截图统一落 `%TEMP%\chemlab-shots`，回话里给路径。
- 点测反馈"点了没反应"时：先复现 + 给根因，**不许猜着同时改三处**。
- 现有工具做不到的测试（新视口、录屏、网络回放等）先报给用户，由他决定加 MCP 还是换做法——不要自己装。

### 8.1 需要人拍板时怎么问

- 提问走 `clarify`：问题要写清楚到「看手机也能答」的程度，**给选项**，别只给一段话。
- 用户经常在换办公地点，**别假设他就在电脑前**：需要他决策的，发出去等答复，不要自己替他拍。
- **特别难判定 / 有歧义的测试，以用户口径为准**：先问一次拿到判据，再动手；不要先做完再问"这样可以吗"。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## 9. 本轮新增约定（2026-10-21 晚）

这一节是这几天踩坑后的硬约定，**优先级高于本文前面任何"看起来更优雅"的做法**。

### 9.1 实验台是亮场
- 场景底色走 `--bench-ink`，值已是纸白 `#F6F7F5`；暗场 token 另存为 `--bench-ink-dark` 等，**只在事故 L3/L4 反差、演示浮层局部使用**。
- 器皿描边用 **`rgba(74, 87, 104, X)`（= `--ink-2`）**，不要用浅灰 `rgba(201,214,228,X)`（那是暗场配色，纸白底上约 1.2:1，肉眼几乎不可见）。
- 纸白底上**不要用白色高光**表现玻璃：高光要改成淡墨阴影（`rgba(74,87,104,.12)`）。
- 改完必须跑：`node scripts/contrast-audit.mjs "/exp/exp01?force=1"`，要求 **0 严重**。

### 9.2 液体颜色只能走混色表
- 禁止再写"取最后一次试剂颜色"那种逻辑（旧 `liquidColorFor` 的坑：红+黄倒进去还是同色）。
- 统一用 `lib/scene/liquid-mix.ts` 的 `mixLiquids(ids)`，优先级：**沉淀/气体 > 指示剂变色 > 配位 > 有色基础液 > 水色兜底**。
- 新增反应物组合时：先在 `PRECIPITATES`/`BASE_COLORS` 里加一行，再补 `liquid-mix.test.ts` 用例。

### 9.3 构建与重启是两步
- `npm run build` 之后**必须**重启生产进程：`powershell -ExecutionPolicy Bypass -File ./scripts/restart-prod.ps1`。
  （本机 terminal 走 bash，`& ".\scripts\..."` 是 PowerShell 语法，在 bash 里跑不了，别照抄。）
- 原因：Next standalone 不带 `.next/static`，漏了会"整页无样式"，所有选择器失效、e2e 全红（10-21 踩过一次）。
- 该脚本最后一步用了 `$home` 变量，和 PowerShell 只读变量 `$HOME` 冲突会报错退出，但**服务其实已经起来了**——
  用 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001` 验证即可，别当失败重来。

### 9.4 演示开关
- `components/demo/demo-overlay.tsx` 的 `DEMO_ENTRY_ENABLED = false`：一键演示入口已下线，代码保留。
- 「跳过实验」按钮只在 `?demo=1` 或 `?play=demo` 出现（`workbench.tsx` 的 `skipVisible`），**不要改成常驻**——学生看到等于教逃课。
- 所有 `data-demo-id` 一律保留，改名等于砸掉演示脚本和 e2e。

### 9.5 学生端 / 教师端分开
- 学生端导航（`components/app/shell.tsx` 的 `MAIN_NAV` 与侧边栏）**不得出现"教师端"入口**。
- 学生与教师是两套后台：`/experiments` 与 `/teacher`，不要互相嵌入。
- 登录页已预填演示账号（`20250101` / `周若曦`）并支持"一键进"；**后端白名单与口令校验保持不变**（成绩归属依赖 studentNo）。

### 9.6 实验列表是 3 + 7
- `app/experiments/page.tsx` 的 `FEATURED_IDS` = 三个精做实验；其余收进「更多实验」并置为禁用态（"即将开放"）。
- `?unlock=all` 才放开全部 10 个，用于调试。
- 要"升级"某个实验为精做：改 `FEATURED_IDS` 一行，不要改渲染结构。

### 9.7 报告页要给结论
- 交卷后学生先看到「本次总结」（`lib/report/summary.ts` 的 `buildRunSummary`）：一句话 + 完成步骤/事故/用时。
- 导出用 `/api/runs/[id]/export`（单次记录），与教师端 `/api/teacher/export`（全班学情）区分，别合并。

### 9.8 颜色一律走 token
- 改颜色只准改 `app/globals.css` 的 token 或引用 `var(--…)`，不要在组件里写字面量。
- 批量扫暗底/白字可用：`node scripts/fix-light-theme.mjs`、`node scripts/fix-white-hover.mjs`（都是幂等的）。
- 审计脚本查不到 SVG 属性里的颜色（`stroke`/`fill` 写死在 JSX 里），这部分要人工看或者补 `lab-apparatus.tsx` 的检查。

### 9.9 界面文案：不加二级标签和解释

> **Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.**

- 一个界面元素只给一层文字。标题已经说清楚的，不要再加一行副标题、角标、括号注释、小字说明。
- 层级靠**布局**表达（位置、间距、对齐、分隔线、留白），不靠"再加一行灰字"。
- 例外只有一个：**教学必需的信息**——读数公差、事故等级、扣分，以及**「这个动作怎么执行」的操作方式**（用户 2026-10-22：只说"观察/读数"却不说点哪里，等于不能用）。这类信息不能省，但要放进它所属的那个元素里（建议卡第二行就是动作的执行方式，不再重复判据），不许平铺成第二条说明行。
- 具体到本项目：引导卡只保留「动作名 + 一句为什么」，`按 1` 这类快捷键提示只在真的能用键盘时才出现；实验卡只留编号 + 实验名（2026-10-22 已按此删掉卡片下方那行 `洗涤 · 称量 · 定容 · 硫酸稀释`）；场景器皿不加"空/已加"之类的状态小字，状态用液面、颜色、描边表达。
- 自检：删掉某行文字后，用户是否仍然知道该做什么？如果知道，那行就是多余的。
