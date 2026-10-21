# handoff · chem-model（化学数据底座）

状态：完成，待下游接入。测试与类型全绿。

## 文件
- `lib/chem/substances.ts`：`SUBSTANCES` / `getSubstance` / `resolveSubstanceId` / `COLORS`（60+ 物质，颜色 hex）。
- `lib/chem/phenomena-table.ts`：现象数据表（48 条，纯数据）。
- `lib/chem/phenomena.ts`：`lookup(reagents, condition)`；命中平铺 `precipitate/gas/colorChange/heat`，未命中 `{unknown:true,hint,suggestions}`。
- `lib/chem/uncertainty.ts`：`READING_SPECS` / `recordReading` / `countSigFigs` / `roundHalfEven` / `addSub` / `multiplyDivide` / `multiplyDivideByRule` / `relativeError` / `relativeRange` / `relativeMeanDeviation`。
- `lib/chem/sig-fig-faq.ts`：`SIG_FIG_FAQ`（"0.1 mol/L × 25.00 mL → 3 位 = 2.50 mmol"口径 + 严格版）。
- 测试：`lib/chem/*.test.ts`（3 文件 / 45 条）。

## 接入约定
- 颜色：直接取 `substances.color` / `phenomenon.precipitate.color` 写契约 §3 的 `liquid.color`、`precipitate.color`。
- 读数：`recordReading("acidBurette", v).display` 得到 2 位小数。
- 条件消歧：`{medium:"acidic"} | {excessOf:"nh3"} | {method:"flameTest"}`，不带条件时特异性条目不会误命中。

## 验收命令
`npx vitest run lib/chem`（45 passed）、`npx tsc --noEmit | Select-String lib/chem`（无输出）。
