# 化学数据底座（chem-model）

认领人：chem-model
独占文件：`lib/chem/substances.ts`、`lib/chem/phenomena.ts`、`lib/chem/phenomena-table.ts`、`lib/chem/uncertainty.ts`、`lib/chem/sig-fig-faq.ts`、`lib/chem/*.test.ts`

## 目标
1. 物质表覆盖 exp01~10 的试剂与关键产物：id/中文名/化学式/物态/颜色/浓度/GHS/储存/ref。
2. 现象查表用显式数据表：`lookup(reagents, condition)` 命中 / 条件消歧 / 未命中给提示，不写推理引擎。
3. 有效数字与误差：读数位数、加减乘除、相对误差/极差/平均偏差、四舍六入五成双。
4. 单测 ≥18 条；`npx vitest run lib/chem` 全绿，`lib/chem/**` tsc 零错误。

## 给下游的接口
- `substances`：`SUBSTANCES`、`getSubstance`、`requireSubstance`、`resolveSubstanceId`、`COLORS`、`listSubstancesByPhase`。
- `phenomena`：`lookup(reagents, condition) → LookupHit | LookupMiss`、`PHENOMENA`、`phenomenaFor`；颜色字段可直接塞契约 §3。
- `uncertainty`：`READING_SPECS`、`recordReading`、`countSigFigs`、`roundHalfEven`、`addSub`、`multiplyDivide`、`relativeError`、`relativeRange`、`relativeMeanDeviation`、`SIG_FIG_FAQ`。

## 验收
- `npx vitest run lib/chem` → 3 files / 45 tests passed
- `npx tsc --noEmit 2>&1 | Select-String lib/chem` → 无输出
