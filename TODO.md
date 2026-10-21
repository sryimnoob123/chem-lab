# TODO.md — 留给扣子编程 Agent 的收尾清单

> 我们这边（本地）已经把应用做完整、自测过；下面这些是**必须用你平台能力**才能收掉的，或者平台侧一次性配好的。
> 每条写清四件事：**是什么 / 在哪改 / 怎么验 / 失败会怎样**。
> 请按顺序做，做完在每条后面打勾并把线上地址贴回来。

## 0. 项目速览

- Next.js 16（App Router）+ TypeScript strict + Tailwind v4 + Drizzle ORM
- 本地开发库：PGlite（`.pgdata/`，WASM 版 Postgres，零安装）；**生产必须换真 PostgreSQL**
- 构建产物：`output: "standalone"`，启动方式是 `node .next/standalone/server.js`（**不是 `npm start`**）
- 自测命令：
  - `npm run lint` / `npm run typecheck` / `npm run test`（vitest，394 条）
  - `E2E_BASE_URL=http://localhost:3001 npx playwright test`（Playwright；不设这个变量会自己起 dev server）
- 迁移：`db/migrations/*.sql`（幂等，可重复执行，已用真 PG 17 验证）
- 环境变量样例：`.env.local.example`

## 1. 接入数据库（platform 内置 PG）——**已完成，无需再改代码**

- **状态（2026-10-21）**：`lib/db/index.ts` 已是双模入口：
  - 命中 `DATABASE_URL` / `COZE_DATABASE_URL` / `COZE_PG_URL` / `COZE_POSTGRES_URL` / `COZE_DB_URL` / `POSTGRES_URL` → `postgres.js` + Drizzle，走真 PostgreSQL
  - 命中拆开的 `COZE_PG_HOST/USER/PASSWORD/DATABASE` 或 `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` → 拼连接串，同上
  - 都不命中 → PGlite（仅本地开发）
  - 依赖已加 `postgres`（`prepare: false`，兼容托管连接池）；`next.config.ts` 已把它列入 `serverExternalPackages`
- **已验证**：`node scripts/pg-mode-check.mjs` → 临时 PG 17 上 `db/init.mjs` 建表播种 + `DATABASE_URL` 起 standalone + `/api/experiments` 返回 **10 条**。
- **你只需要**：在扣子项目里开通数据库能力，让平台注入凭据。若部署后 `dbMode === "pglite"`（变量名一个都没命中），去「数据库 > 设置」看实际变量名，加进 `lib/db/index.ts` 的 `candidates`（一行），重新部署。
- **建表/种子**：开发库执行 `db/migrations/0001_init.sql`，或 `node db/init.mjs`（现已支持真 PG）；**首次部署勾选「同步数据」**，之后只同步 Schema。
- 详见 `docs/扣子部署适配.md`。

## 2. 环境变量两套

- **是什么**：开发/生产各一套，生产在"发布管理"里配，改完要重新部署才生效。
- **需要配的**：`DATABASE_URL`（平台注入）、`PORT`（平台通常自动注入，别写死）、`HOSTNAME=0.0.0.0`
- **本地才用的**：`PGLITE_DIR`（指向 `.pgdata` 目录），**扣子上不要设**
- **不要用** `COZE_` 前缀（系统保留）

## 3. 同步 schema

- **是什么**：`db/migrations/0001_init.sql` 是可重复执行的增量 SQL（`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`）。
- **怎么验**：部署后页面读库正常；教师端能读出数据；`GET /api/experiments` 返回 10 条
- **失败会怎样**：接口 500，日志里是 SQL 错误

## 4. 大模型能力：**本期未实现**（不要按"已接线"验收）

- 原计划的"AI 评估点评"（`lib/llm.ts`）**不存在**，代码里没有 provider 分支、没有降级模板。
- 现状：所有评分都是**确定性规则分**（`lib/assess` / `lib/pedagogy/scoring.ts`），不依赖任何模型，离线可跑。
- 如果扣子要给报告加 AI 点评，属于**新增功能**，需要重新设计接口，不在本次交付范围。

## 5. 自定义域名 / 去 Logo（套餐相关）

- 演示如果要用学校域名（如 `chem.henu.edu.cn`），需要已备案域名 + SSL；平台侧操作。
- 去品牌 Logo 取决于套餐版本。

## 6. 部署与回滚

- 部署前确认：没有运行中的开发任务、生产环境变量齐全、最新预览已验收。
- 回滚只回滚代码，**不回滚数据库**——所以破坏性 schema 变更要分两次发（先加列，后删列）。

## 7. 本期不做（别自作主张加）

- 对象存储 / 文件上传（报告只导出 CSV）
- 真实登录与校方 SSO（学号即身份）
- 微信小程序版本
- 改视觉体系（设计契约在 `docs/design/DESIGN-CONTRACT.md`，改之前先问）

## 8. 上线验收 5 条（请逐条截图发回）

1. 首页能打开、实验列表 **10 个实验全部「可进入」**
2. 进任一实验：**先出现 BOPPPS 前测页**（导入 + 目标 + 3 道题），3 题全对才进操作台
3. 操作台里做一步错误操作 → 出红色失败卡 + 「为什么 / 正确做法」两行 → 「重做本步」可回到该步
4. 做完全部步骤 → 交卷 → 报告页有分数、学号、时间线，**顶部还有 BOPPPS 后测 3 题**，提交后给逐题解析
5. 教师端（`/teacher`，口令 `2026`）能看学情并导出 CSV（UTF-8 BOM，Excel 不乱码）

## 9. 仍然缺的（我们本地待办，不交给平台）

- 迁移题（transfer）在数据层留空：10 份实验库文档里的迁移题都是开放题，没有选项，不适用于当前选择题结构
- 大模型点评：`lib/plan/assess.ts` 里的 `offlineAssessment` 是**纯规则离线模板**（结论/依据/下一步三段），没有接任何模型；`buildPrompt` 已写好但没人调用

## 10. 开发者调试面板 `/dev`（**不参与上线验收**）

- **是什么**：本地调试用面板：10 个实验总览、跳过前测进操作台/报告页/自动演示、清前测缓存、登录态、runId 时间线、事故一键注入。
- **开关**：`DEVTOOLS=1` 强制开启；`DEVTOOLS=0` 强制关闭；**什么都不设**时只有 `NODE_ENV !== "production"` 才开启。
- **生产默认行为**：不设 `DEVTOOLS` 时 `/dev` 整页 404；全站没有任何入口链接指向 `/dev`，页面自身 `robots: noindex`。
- **部署时怎么关**：不设 `DEVTOOLS`（或显式 `DEVTOOLS=0`）即可；线上排障确实需要时再临时设 `DEVTOOLS=1` 重新部署，用完删掉。
- **不参与验收**：第 8 节的 5 条上线验收不含 `/dev`，截图基线也不需要它。
- **悬浮 Dev Dock**：任意页面左下角的「DEV」按钮（`components/devtools/dev-dock*.tsx`），点开是 320px 抽屉：身份（一键学生/教师登录）、10 实验直达、进度锁（前测解锁/重置）、快捷跳转；与 `/dev` 用同一开关，生产构建不加载它的 JS/CSS。
- **实现文件**：`app/dev/**` + `components/devtools/**`（只读这两个目录即可整体删除，不影响正式页面；`app/layout.tsx` 里只有两行挂载代码）。

