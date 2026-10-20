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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
