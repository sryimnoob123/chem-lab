# engine-core：通用状态机 + exp09 定义（垂直切片）

认领人：engine-core
独占文件：`lib/engine.ts`、`lib/engine.types.ts`、`experiments/exp09/definition.ts`、`lib/engine.test.ts`、`experiments/exp09/definition.test.ts`、`.team/tasks|notes/engine-core.md`

## 目标（≤5 条）
1. `apply(state, action) => { state, events }` 纯函数：17 原语、顺序保护、幂等、提示阶梯 H0~H4。
2. 规则层接口 `applyIncident(state, input)`：violation/incident 入账，同 `(stepIndex,id)` 只记一次。
3. exp09 七步定义：每步 ≥2 动作、≥1 陷阱，14 个事故与规格 §7 逐条对齐（L4×1/L3×3/L2×6/L1×4）。
4. 步级 `data-demo-id` 与规格 §6 最后一列逐字一致；动作级 id 按契约 §10。
5. 单测 ≥12 条 + 定义结构校验，全绿；TS strict、无 any。

## 对上游/下游的接口
- 给 UI/规则/时间线：`@/lib/engine` 同时 re-export 契约类型（`lib/engine.types.ts` 是唯一类型源）；`initState(expId)` 建初始状态；事件消费见 engine.ts 顶部注释的事件顺序与幂等键。
- 给内容轨道接新实验：在 `lib/engine.ts` 的 `DEFINITIONS` 加一行（该文件归 engine-core，改动先找 owner）。
- 从 Lead 处需要：`vitest.config.ts` 的 `test.include` 增加 `"experiments/**/*.test.ts"`（现只含 `lib/**`、`db/**`，否则 `definition.test.ts` 不会被收集）。

## 验收
- `npx vitest run lib/engine.test.ts experiments/exp09/definition.test.ts` → 44 passed
- `npx tsc --noEmit` → 我负责的文件 0 error
- `npx eslint <上面 5 个文件>` → 0 error 0 warning
