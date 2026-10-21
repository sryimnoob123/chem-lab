# engine-core notes（只追加）

## 2026-10-20 18:40 · 完成：状态机 + exp09 定义垂直切片，44 测试全绿
- 做了什么：
  - `lib/engine.types.ts`：契约 §1~§8 的 TS 投影（ActionType 17 原语 / CompetencyCode / Event 联合 / ExperimentState / Incident / HintLevel / TimelineRow），外加定义层类型（StepDefinition、ChoiceDefinition、ChoiceHazard、StepJudge、StepHints、IncidentInput）。
  - `lib/engine.ts`：`apply`（顺序保护 out-of-order / already-completed、重复提交与前置动作校验、陷阱产出 feedback+hint+violation/incident、完成推进、stateChanged diff）、`applyIncident`（规则层动态判定入账、幂等）、`initState/getStep/getDefinition/listExperimentIds`。`state.stepLog`（可选字段）做幂等簿记。事件顺序与"引擎不判对错"的边界写在文件头注释。
  - `experiments/exp09/definition.ts`：7 步全量定义（每步 3 正确 + 1~3 陷阱，14 陷阱 = L4×1/L3×3/L2×6/L1×4），`requires` 表达"先称量再定容"等硬顺序；步级 demo-id 与规格 §6 最后一列逐字一致。
  - `lib/engine.test.ts`（27 条）+ `experiments/exp09/definition.test.ts`（17 条）。
- 证据：
  - `npx vitest run lib/engine.test.ts` → 27 passed。
  - `experiments/exp09/definition.test.ts` 用临时配置（include 加 `experiments/**/*.test.ts`，已删除临时文件）→ 17 passed。
  - `npx eslint` 上述 5 文件 → 0 error 0 warning；`npx tsc --noEmit` → 我的文件 0 error，仅 `lib/chem/phenomena.ts`（别的轨道在写）报错。
- 改了哪些文件：`lib/engine.types.ts`、`lib/engine.ts`、`experiments/exp09/definition.ts`、`lib/engine.test.ts`、`experiments/exp09/definition.test.ts`、本 notes + `.team/tasks/engine-core.md`。
- 下一步 / 阻塞：
  - **阻塞 Lead**：`vitest.config.ts` 的 `test.include` 缺 `"experiments/**/*.test.ts"`，交付命令里的 `definition.test.ts` 目前不会被收集（只跑 27 条）。加一行即闭环。
  - 规则轨道：`lib/safety/incidents/exp09.ts` 的事故表与 `definition.ts` 里的 `ruleId/incidentId/fx/level/deduct` 保持一致；动态追加判定走 `applyIncident`，重复入账已幂等。
  - UI 轨道：`data-demo-id` 用定义里的 `step.demoId` / `choice.demoId`，别自己拼。
