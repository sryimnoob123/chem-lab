# handoff · mission-board-ui — 实验页 UI 重构（左上角任务看板 + 去杂乱）
**状态：已交付；3001 已按 HEAD 构建，验收全绿。** 本次只动实验页（app/exp/[id] + components/exp/guide），未碰其他板块。
## 结构（这次做完的样子）
- 左上 244px 纸白看板（窄屏 172px）：`实验 09 · 名称` / **一句话目标** / 7 个进度点 + `第 N/7 步 · 现在该X了` / **当前一步一句指引（≤20 字）**；整张卡的头就是按钮，点开才是详细流程 + 参数 + 提示阶梯 + 老师会说。
- 右栏 8 块并列 → 4 块：**大字读数**（exp09 = 滴定管读数；其余实验只在本步有判据时报允许误差，没判据就不摆空卡）→ **一个主操作** → 失败原因（折叠）→ 其他做法（折叠）→ 完成卡。

## 面板被收去哪
- **进看板折叠区**：StepTimeline（`demo-guide-step-N` 保留）、参数卡（exp09 已用体积/指示剂；非 exp09 观察记录/违规事故/实验进度）、「要提示吗」（H 键仍可，取到的提示替换第四行 → **同屏只留 1 条**）、老师会说。
- **留右栏顶层折叠**：其他做法 —— 不能进抽屉：`scripts/lib/click-op.mjs` 只展开 `demo-other-ways`，进抽屉后陷阱按钮不可点，flow-smoke / exp-chain 会全挂。

## 接口（接手只需看这 5 个文件）
- `components/exp/guide/mission-board.tsx`（152 行，本体：四行 + 展开开关）与 `mission-board-details.tsx`（120 行，折叠区内容）；props 全由 workbench 传，组件无业务规则。
- `mission-copy.ts`（`missionGoal` / `missionProgress` / `missionGuide`；**进度行格式被 scripts/walk-steps.mjs 用「第 N/」解析，别改**）。
- 场景指引：`drop-resolve.ts` 的 `nextReagentId(step, performed, rackIds)` + `app/exp/[id]/rack-ids.ts`；`data-next="true"` 挂试剂按钮与锥形瓶（`bench-next` 脉冲，reduce 静止）。

## 别踩的坑
- `app/exp/[id]/lab-apparatus.tsx` 的器皿颜色是 JSX 硬编码，**CSS 对比度脚本查不到**：亮场描边必须 `rgba(74,87,104,X)`；`.fxSlot::before` 是「压淡 .28」不是「盖白 .90」（曾被批量换色误伤，整台器皿看着消失）。
- 新手教学首次自动弹会挡住所有 e2e：`click-op.mjs` 已加 `dismissOnboarding(page)` 并挂在 `ensureOpVisible`；**自己直接 `.click()` 的脚本要显式调一次**。`npm run build` 后必须 `pwsh -File scripts/restart-prod.ps1`（末步 `$home` 报错但服务已起）。
## 证据（HEAD / 3001 生产）
`tsc` 空 · `lint` 0 error · `flow-smoke exp01` **8/8**、`exp09` **8/8** · `mission-board-shot` exp01/exp09 **各 23/23** · `contrast-audit` exp09/exp01 **0 严重 0 偏低** · 截图 `%TEMP%\chemlab-shots\mission-board\`。
