# pedagogy-engine：教学层（提示阶梯 / 能力账本 / 计分折算）

认领人：pedagogy-engine
独占文件：`lib/pedagogy/hints.ts`、`lib/pedagogy/competency.ts`、`lib/pedagogy/scoring.ts`、`lib/pedagogy/*.test.ts`

## 目标
1. 提示阶梯状态机：错误历史 → H0~H4 + 文案键；跨能力点隔离；连续 3 次同类错误跳 H4。
2. 能力点账本：correct/wrong/incident 记账，按契约公式算 mastery，导出雷达数据。
3. 计分：操作分聚合、三项折算（10/40/50）、课程目标 1/2/3 达成度。

## 接口（下游直接 import）
- `hints.ts`：`decideHint({ expId, competency, stepIndex, history })` → `{ level, textKey, stepAttempt, competencyStreak, metacognitive, shouldDeduct }`；`recordErrorAndDecide()` 一步完成"决策 + 记错"；`clearCompetencyHistory()` 正确通过后清错误史。
- 文案键：H0~H3 = `hint.<expId>.step<1-based>.H<n>`；H4 = `hint.<expId>.meta.H4`。
- `competency.ts`：`recordOutcome/recordOutcomes`、`computeMastery`、`tallyCompetency`、`buildRadarData`。
- `scoring.ts`：`computeOperationScore`、`computeIndependentDeduct`、`computeReportScore`、`computeWeightedTotal`、`computeObjectiveAttainment`、`computeCourseResult`（端到端）。

## 验收
- `npx vitest run lib/pedagogy` → 3 files / 52 tests passed
- `npx tsc --noEmit` → 无输出
- `npx eslint lib/pedagogy` → 无输出
