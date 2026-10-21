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
- 本地演示库：`npm run db:demo` 重播前要先停 dev（PGlite 独占）。
