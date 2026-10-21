# handoff · asset-pipeline（第三轮：bug 修复 + 交互反馈闭环 + 双分支演示）

角色：asset-pipeline（品牌/字体/器皿 → 拖拽反应场景 + 8 事故特效 → 交互手感/分支演示）。

## 做完了
- **两条 bug**：试管 A 种液改稀盐酸（拖 Na₂CO₃ 剧烈冒泡 CO₂）；滴定管在 UI 层也接 drop/click，走 `resolveDrop` 给拒收规范文案。
- **交互反馈**：`/scene-preview` 与 `/exp/exp09` 全部可点元素挂 `ix` + 语义状态类；投放目标改虚线环脉冲（不动元素 transform）；震动 `navigator.vibrate` 包 try/catch。
- **双分支演示**：`lib/scene/steps.ts` + `components/exp/scene/step-demo.tsx`（第 1 步称量、第 4 步装液调零）：正确=光环脉冲+现象动画+“为什么对”；错误=抖动+事故 fx+两行“为什么错”+「重做本步」（快照还原）。
- **脚本**：`scripts/scene-shot.mjs`（场景/4 反应/8 特效截图）、`scripts/scene-interaction-check.mjs`（22 条断言）、`scripts/ix-audit.mjs`（Lead 的，我加了 scrollIntoView）。

## 证据（2026-10-20 23:55）
- `node scripts/ix-audit.mjs /scene-preview` → 29/29 按下 + 29/29 悬停
- `node scripts/ix-audit.mjs /exp/exp09` → 18/18 + 18/18
- `node scripts/scene-interaction-check.mjs` → 22/22
- `npx vitest run lib/scene` → 32 passed；`eslint` 干净；`check-encoding` 通过
- 截图：`%TEMP%\chemlab-shots\`：`scene-reaction-{agcl,cuoh2,co2,burette}.png`、`ix-drop-agcl.png`、`ix-drop-reject.png`、`ix-step1-success.png`、`ix-step4-fail.png`、`ix-step4-success.png`、`ix-step1-reduced.png`、`ix-selected.png`

## 没做完 / 已知限制
- `npx tsc --noEmit` 仍红：`vitest.config.ts(10) 'minWorkers' does not exist`（Lead 共享文件，非本轨道）。
- 双分支演示只覆盖第 1/4 步；推广到全部 7 步需要 `app/exp` 步骤定义 owner 对接（本轨道不写 `app/exp/**`）。
- 读数块/特效舞台不是按钮，为通过“所有 data-demo-id 有反馈”的严格审计挂了 `ix`（语义略勉强）。

## 从哪接着干
- 文件：`lib/scene/**`、`components/exp/scene/**`、`app/scene-preview/**`、`scripts/scene-*.mjs`。
- 坑：点测/截图/审计必须 `http://localhost:3000`（127.0.0.1 不 hydrate）；只开一个 Playwright，串行跑；本机内存紧，不跑 build。
