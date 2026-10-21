# handoff：data-api（2026-10-20 19:13）

## 已交付（全部落盘，测试/curl 已过）
- 会话：`lib/session.ts` + `lib/persist/session-token.ts`（`chem_sid`/`chem_teacher`，HMAC-SHA256，`SESSION_SECRET`、`TEACHER_PASSCODE` 可覆盖）。
- 路由：`app/api/session`（POST/GET/DELETE）、`runs`（POST）、`runs/[id]`（GET）、`runs/[id]/events`（POST）、`runs/[id]/finish`（POST）、`report/[runId]`（GET）、`experiments`（GET）、`plans` + `plans/[id]`、`teacher/{unlock,roster,roster/import,roster/[no],export}`。
- 持久层：`lib/persist/{replay,events,score,report,runs,plans}.ts`。state 靠 timeline 重放（`lib/engine` 的 apply/applyIncident），交卷用 `lib/pedagogy/scoring.ts`。
- 查询：`lib/queries/teacher.ts`（4 个固定签名，**未改签名**）、`teacher-detail/shared`、`roster`、`roster-csv`、`csv`、`export`、`experiments`。
- 展示名回落：`lib/persist/labels.ts`（定义 label → 动作中文名；registry title → 演示 id 别名 → 级别名）。demo seed 的合成 id 也不会再露英文；seed 改用 registry id 后可删 LEGACY 映射。

## 口径要点（接手先看这几条）
- 教师查询默认排除 `is_demo`；`StudentDetail.competency` 是 **0~100**，`runs.score_detail.competency` 是 0~1。
- 交卷：三段分各自取整 → 10/40/50 折算 → 总分取整，所以 `total === round(weighted(scorePre,scoreOp,scoreReport))`。
- timeline 幂等键 `(runId,stepIndex,seq)`；incidents 无唯一索引，DB 查重 + 内存判重。
- 已交卷再 POST finish 幂等返回原报告；`status=finished` 的 run 再提交事件回 409 `RUN_FINISHED`。

## 改哪里
- 加新实验：只需 `experiments/<id>/definition.ts` 注册进 `lib/engine.ts` 的 DEFINITIONS，API 无需改。
- 错误码/鉴权：`app/api/_lib/http.ts`、`_lib/access.ts`。
- 数据库测试：照抄 `lib/persist/events.test.ts` 顶部（先设 `PGLITE_DIR` 再动态 import）。

## 已知注意
- `npx tsc --noEmit` 偶报 `.next/dev/types/validator.ts` 关于别人新页面的错：curl 一下该页面让 dev 重生成类型再跑。
- 本地演示库：`npm run db:demo` 重播前要先停 dev（PGlite 独占）；**不要 `taskkill /F` dev**，会留下打不开的 PGlite（`Aborted()`，删 postmaster.pid 也救不回）。
- Next dev Playwright：用 `http://localhost:<port>`，别用 `127.0.0.1`（HMR 被拒导致 React 不 hydrate、点击无效）。

## 附加交付（2026-10-21）：开发者调试面板 `/dev`
- 文件：`app/dev/{page,debug-data}.ts(x)`、`components/devtools/{dev-panel,dev-session,dev-run-inspector,dev-hazard-list,types}.tsx`、`devtools.module.css`；`TODO.md` 追加 §10。
- 开关：`DEVTOOLS=1` 强开 / `DEVTOOLS=0` 强关 / 未设置时仅非 production 开启；关闭时整页 404，全站无入口，不参与上线验收。删 `app/dev/**` + `components/devtools/**` 即整体移除。
- 本地入口：当前主 dev（3003）`http://localhost:3003/dev`；隔离验证截图见 `%TEMP%\chemlab-shots\devtools\`。

## 附加交付（2026-10-21）：悬浮 Dev Dock
- 文件：`components/devtools/dev-dock{,-experiments,-loader,-types}.tsx`、`dev-dock.module.css`、`devtools-enabled.ts`；`app/layout.tsx` 两行挂载（`devtoolsEnabled()` + `next/dynamic ssr:false`）。
- 位置左下 `left:16 bottom:76`（避开 Next dev 左下角调试圆点，否则点不到）；320px 抽屉；点「进实验」自动收起；生产不加载其 JS/CSS。
- 截图 `%TEMP%\chemlab-shots\dev-dock\`；与 `/dev` 同一开关，删 `components/devtools/**` 即整体移除。
- 文件补充：快捷跳转在 components/devtools/dev-dock-shortcuts.tsx；最终版 dev-dock.tsx 278 行。
