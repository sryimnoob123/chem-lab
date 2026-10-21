# handoff · hazard-engine（≤20 行）

已落盘：`lib/safety/{hazards,registry}.ts`、`lib/safety/incidents/{types,exp09}.ts` + 3 个 test 文件。
验证：`node scripts/check-encoding.mjs` 通过；`npx vitest run lib/safety` → 88 passed；`lib/safety/**` tsc 零错误；eslint exit 0。
（全仓 tsc 仅剩 `app/exp/[id]/workbench.tsx(78,16)`，UI 轨道的错，非本层。）

- 类型：`lib/safety/incidents/types.ts` **只 re-export** `lib/engine.types.ts`，别再自己声明；扩展类型是 `HazardIncident extends Incident { stepNo?; fxSilent? }`。
- id/level/fx/deduct：`incidents/exp09.ts` 与 `experiments/exp09/definition.ts` 的 ruleId（exp09-H1…H14）逐条对齐；H13 competency = K2。
- 引擎接线：`detectFirstIncident(state.expId, state, action)` → 组 `IncidentInput` → `applyIncident(state, input)`（幂等键 `(stepIndex, incidentId)`）。
- UI：`fxSilent === true` → 只出文字+音效不播动画；`stepNo` 是 1-based，定格/复盘直接可用。
- 待 Lead：`definition.ts:342` H1 的 refs 应为 `["S003","S010"]`（现写 S006=读数，口径不符）；hazards 编号以 `lib/safety/hazards.ts` 为准回填其它 md。
- 教训：写中文文件只用 `write`/`edit`，禁止 shell 重定向/Set-Content（Windows 默认编码会写坏）。
