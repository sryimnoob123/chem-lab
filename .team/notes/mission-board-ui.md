# notes · mission-board-ui（左上角任务看板 + 实验页去杂乱）

## 2026-10-21 18:30 · 完成：看板本体 + 文案纯函数 + 单测
- 做了什么：新增 `components/exp/guide/mission-board.tsx`（整张卡的头是 button，默认 4 行：实验号+名 / 一句话目标 / 进度点+`第 N/M 步 · 现在该X了` / 当前一步指引 ≤20 字；折叠区 = 详细流程 + 参数格 + 提示阶梯 + 老师会说）。视觉：`--paper-2` 底 + 1px `--line` + 圆角 2px，桌面 244px、窄屏 184px。
- 文案：`mission-copy.ts`（纯函数）——10 个实验一句话目标（压缩自 docs/实验库 §2，≤20 字）+ `missionProgress`（**保留 walk-steps 解析的「第 N/」**）+ 兜底 + `missionGuide`。
- 证据：`npx vitest run components/exp/guide` → 17 passed（mission-copy 6 + drop-resolve 11）；`npx tsc --noEmit` → 空。
- 改了哪些文件：`components/exp/guide/mission-board.tsx`(新)、`mission-board.module.css`(新)、`mission-copy.ts`(新)、`mission-copy.test.ts`(新)。
- 下一步 / 阻塞：等 Lead 重建后截图；workbench 减法待放行。

## 2026-10-21 19:00 · 完成：workbench 减法 + 看板挂载 + 场景 data-next 指引
- 做了什么：
  - 右栏 8 块 → 4 块：大字读数 HUD（exp09 = 滴定管读数；其余 = 允许误差）→ 主操作卡（`NextActionCard` 只留 动作名/为什么/快捷键，进度与步骤点搬到看板）→ 失败原因折叠 → 其他做法折叠 → 完成卡。
  - 删掉：`StepTimeline`（`demo-guide-step-N` 改由看板渲染）、exp09 的「已用体积 V/指示剂颜色」、非 exp09 的「观察记录/违规事故/实验进度」、`要提示吗`、`老师会说`。**data-demo-id 一个没删**。
  - 看板挂到 `.missionSlot`（左上角，和试剂架同一列）；`.rack` top 14→156、宽 196→244；`.rail` 344→304 且高度随内容；`.benchArea`/`.fxSlot` padding 同步。
  - 场景指引：`app/exp/[id]/rack-ids.ts`（从 scene-stage 抽出）+ `drop-resolve.ts` 新增 `nextReagentId()`；试剂按钮/锥形瓶 `data-next` + `bench-next` 2.4s opacity 脉冲（reduce 静止）。
- 证据：`npx tsc --noEmit` → 空；`npm run lint` → 0 error（9 warning 均为既有 scripts）；`workbench.tsx` 1162 → 1071 行；`.rack/.rail/.param/.reagent` 由暗底改纸白（已报 Lead）。
- 改了哪些文件：`app/exp/[id]/workbench.tsx`、`app/exp/[id]/workbench.module.css`、`app/exp/[id]/scene-stage.tsx`、`app/exp/[id]/rack-ids.ts`(新)、`components/exp/guide/NextActionCard.tsx`、`components/exp/guide/drop-resolve.ts`(+test)。
- 下一步 / 阻塞：**等 Lead 重建 3001**（不许自起 dev/build）→ 跑 `flow-smoke exp01`/`exp09` 8/8 + 1440×900 / 390×844 截图；新手教学组件 `components/exp/onboarding/` 只到了 css+storage.ts，组件未交付，workbench 里已留 TODO 占位。

## 2026-10-21 19:06 · 完成：挂新手教学 + 修掉两个"整页看不见"的根因（已报 Lead 授权）
- 挂了 `<ExperimentOnboarding />`（不传 open = 首次自动弹）。
- **根因 1（器皿看不见）**：`app/exp/[id]/lab-apparatus.tsx` 还是暗场配色硬编码 —— `stroke: rgba(201,214,228,.62)` 在纸白 `#F6F7F5` 上约 1.2:1。按 Lead 规范批量换成 `rgba(74,87,104,X)`（= `--ink-2`）、白高光 `rgba(255,255,255,.32/.35)` → `rgba(74,87,104,.12)`、`#E6EEF7` → `#EDF0EE`、液滴改 `var(--river-700)`、液面 fillOpacity .55→.72。
- **根因 2（整台被冲淡）**：`workbench.module.css` 的 `.fxSlot::before` 被批量换色误写成 `rgba(246,247,245,.90)` —— 一块 90% 白板盖住整个场景（`.fxSlot` 是 inset:0 / z-index 6）。改回"压淡"语义 `rgba(246,247,245,.28)`。**这是 SVG/CSS 审计都抓不到的**（对比度脚本只算文字）。
- **新手教学挡住所有 e2e**：`scripts/lib/click-op.mjs` 新增 `dismissOnboarding(page)`，并在 `ensureOpVisible()` 里自动调用（所有用 `clickOp` 的脚本自动修好）；`scripts/flow-smoke.mjs` 进入实验后显式调用一次；`scripts/mission-board-shot.mjs` 先拍一张 onboarding 证据再关掉。**直接 `.click()` 的脚本（不是 clickOp）仍需自己调一次 `dismissOnboarding`。**
- 另修：`workbench.tsx` 里 Lead 新加的 `setSkipVisible` effect 触发 Next 16 `react-hooks/set-state-in-effect`，用 `setTimeout(0)` 包一层（同 onboarding 的修法）。
- 证据：`npx vitest run components/exp/guide` → 17 passed；`tsc` 空；`npm run lint` → 0 error。

## 2026-10-21 19:25 · 验收全绿（生产构建 3001，HEAD）
- `npx tsc --noEmit` → 空；`npm run lint` → **0 error**（10 warning 均为既有 scripts/未用 import）。
- `BASE_URL=http://localhost:3001 node scripts/flow-smoke.mjs exp01` → **8/8**；`exp09` → **8/8**。
- `BASE_URL=... node scripts/mission-board-shot.mjs exp09` / `exp01` → **各 23/23**（看板 244×99 不压试剂架/锥形瓶、无横向溢出、进度行格式、详情 7 步+提示+老师会说、390×844 看板 172px 内 0 个 <44px 按钮）。
- `node scripts/contrast-audit.mjs "/exp/exp09?force=1"` 与 `/exp/exp01?force=1` → **0 严重 / 0 偏低**。
- 截图：`%TEMP%\chemlab-shots\mission-board\`（`desktop-exp09-01-initial` / `desktop-exp09-02-details` / `desktop-exp01-01-initial` / `mobile-exp09-*` / `mobile-exp01-*` / `-00-onboarding` / `desktop-04-vessel-crop`）。
- 本轮补充结构修正：`.params` 窄屏 `order:-1`（大字读数排到主操作前）；窄屏看板 184→172px（不压滴定管）；非 exp09 且本步无判据时**不渲染空的大字读数卡**（不再用"—"占位）。

