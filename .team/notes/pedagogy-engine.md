# pedagogy-engine notes（只追加）

## 2026-10-20 18:36 · 完成：教学层三模块 + 52 条单测
- 做了什么：新建 `lib/pedagogy/`。`hints.ts` 提示阶梯状态机（H0~H3 按"同一步同一能力点"错误次数推进，H4 由"同能力点连续 3 次错且跨 ≥2 步"触发，跨能力点隔离；H2+ 标 `shouldDeduct`）；`competency.ts` 能力点账本（契约公式 `clamp((correct-1.5*wrong-3*incidents)/max(1,attempts),0,1)`，attempts=correct+wrong 不含事故，雷达数据导出）；`scoring.ts` 操作分聚合 / 报告分 30-30-20-20 / 三项折算 10-40-50 / 目标达成度映射表写进文件头注释，`computeCourseResult` 端到端。
- 证据：`npx vitest run lib/pedagogy` → Test Files 3 passed，Tests 52 passed；`npx tsc --noEmit` → 无输出（全仓干净，无他人文件报错）；`npx eslint lib/pedagogy` → 无输出。
- 可核对样例：exp09 假数据（违规 6 + L2 事故 5 + H2/H3 提示扣 2、报告 100/90/85/95）→ 操作 87、报告 93、折算 91.3；目标 1/2/3 = 0.9 / 0.81 / 0.9（写在 `scoring.test.ts` 顶部）。
- 接口约定：文案键 H0~H3 = `hint.<expId>.step<1-based>.H<n>`，H4 = `hint.<expId>.meta.H4`（元认知跨步，不绑单步）；引擎侧每步判错后调 `recordErrorAndDecide`，把返回的 `history` 存进运行态；某能力点正确通过后调 `clearCompetencyHistory`。
- 改了哪些文件：`lib/pedagogy/{hints,competency,scoring}.ts`、对应 3 个 `.test.ts`、`.team/tasks/pedagogy-engine.md`、本 notes。
- 下一步 / 阻塞：无。等 Lead 验收；引擎/报告/教师端接入时按 `scoring.ts` 注释里的映射表取数即可。

## 2026-10-20 18:42 · 补充：阈值常量化 + 全仓 tsc 受他人文件阻塞
- 做了什么：`scoring.ts` 去掉魔法数字——H2 阈值改用 `hints.ts` 的 `INDEPENDENT_DEDUCT_MIN_LEVEL`，L4 终止改用新增具名常量 `TERMINATING_LEVEL`。
- 证据：`npx vitest run lib/pedagogy` 仍 52 passed；`npx eslint lib/pedagogy` 无输出；`npx tsc --noEmit --ignoreConfig --strict ... lib/pedagogy/*.ts`（含 3 个 test）无输出。
- 全仓 `npx tsc --noEmit` 现状：18:35 曾全绿；之后 `lib/chem/phenomena-table.ts(91,99)` 等出现 `TS1002 Unterminated string literal`（他人正在写的文件，按约定未改），**与本轨无关**，等该轨落盘后需重跑确认。
- 改了哪些文件：`lib/pedagogy/scoring.ts`、本 notes。
- 下一步 / 阻塞：无；Lead 汇合时若看到 `phenomena-table.ts` 报错，责任在 chem 轨。

