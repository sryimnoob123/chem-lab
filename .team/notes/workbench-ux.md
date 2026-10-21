# notes · workbench-ux（操作台体验 / 拖拽三段式 + 轻度 UI 收敛）

## 2026-10-21 17:30 · 完成：drop 判定纯函数 + 单测（拖拽三段式的"算不算"）
- 做了什么：新增 `components/exp/guide/drop-resolve.ts`（纯函数，0 依赖）：
  - `resolveDrop(step, reagentId, performed)` → `accept(choiceId)` / `reject(line)`；
    规则只用定义里既有数据：choice.type ∈ {addDrops,dissolve,dilute,transfer,titrate} + 文案/params.indicator 指向该试剂；
    正确动作前置未满足 → 拒收并点名缺的前置；只有陷阱动作 → 拒收并复述事故标题；本步不加试剂 → 拒收并提示该做的动作。
  - `REAGENT_DROP_COPY`（原 scene-stage 的 DROP_COPY 搬过来，一处文案）、`SNAP_MS=160 / POUR_MS=700 / REJECT_MS=240`。
- 证据：`npx vitest run components/exp/guide/drop-resolve.test.ts` → 7 passed；`npx tsc --noEmit` → 0。
- 改了哪些文件：`components/exp/guide/drop-resolve.ts`（新）、`components/exp/guide/drop-resolve.test.ts`（新）。
- 下一步：`use-drop-flow.ts` 钩子（吸附→倒入→推进 / 回弹→拒收→原地重试），scene-stage 接上。

## 2026-10-21 · 口径调整（Lead 转达用户 17:2x）
- 流程正确性 > UI 美化：UI 只做轻度收敛（合并多条提示为 1 条、去掉坐标角标等装饰、详情类折叠），
  **不重排主结构、不删参数卡/事件条**，demo 钩子与 stepIndex/dispatch 语义不动（唯一例外：drop 的 dispatch 延后到倒入动画结束）。
- 每完成一小块立刻跑 tsc + vitest 并记进本文件；handoff 里把 diff 分成「流程有影响的改动」「纯视觉改动」两类。
