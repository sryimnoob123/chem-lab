## 2026-10-21 05:40 · 投放 audit + 演示报告提示（收尾）

### 做了什么
- 新后端入口 `POST /api/runs/[id]/drops`（`app/api/runs/[id]/drops/route.ts`），body：
  `{ kind:"drop", reagentId, vesselId, inputMode, outcome?, reactionText? }`
  - 只写 timeline 一条 `actionType="drop"`；不参与状态机。
  - 重放 `replayState` 跳过 drop 行；计分 `computeRunScore` 过滤 drop 行（能力点/尝试次数/tolerance 均不计）。
- Workbench 场景投放审计：
  - 不修改 `scene-stage.tsx`；Workbench 用 document capture 监听 drag/drop、click、focusin，结合 `onCaption` 抓到 reagent/vessel/caption。
  - `sendDrop()` 异步 POST；失败静默；run 未就绪时排队；`finish` 等所有 action/drop inflight；演示模式直接不写。
- 报告页：
  - 时间线识别 `actionType="drop"`，渲染 `投放 氢氧化钠 → 锥形瓶 · <reactionText>`，状态「已投放」。
  - `?demo=1` 显示 `data-demo-id="demo-report-notice"`：`演示示例 · 非本次 run` + `这是历史记录，用于说明报告结构。`，琥珀中性色。
  - 演示交卷跳 `/exp/exp09/report?demo=1`。

### 证据
- 投放前后（单 Playwright 串行，dev 3000）：
  - before run `284cedae...`：dropRows **0**，timeline 仅动作条；
  - after run `1f8b83cf...`（后再跑 `007fdf9e...`）：dropRows **1**，文本：
    `投放 氢氧化钠 → 锥形瓶 · NaOH 逐滴加入锥形瓶：局部出现浅粉红又褪去，说明还在终点前；继续半滴、摇匀。`
  - `POST /api/runs/1f8b83cf.../drops` → **200**。
  - 截图：`%TEMP%\chemlab-shots\drop-demo-final\report-before-drop.png`、`report-after-drop.png`
  - JSON：`%TEMP%\chemlab-shots\drop-demo-final\drop-assert.json`
- 演示模式：`?play=demo` 拖入 NaOH + 自动 6 步 + 交卷：
  - badge `演示模式 · 不记录`
  - URL `/exp/exp09/report?demo=1`
  - notice 文本正确，`data-demo-id="demo-report-notice"`
  - `/api/runs` 请求 **0**（含 drops）
  - console/pageerror 0
  - 截图/JSON：`demo-report-notice.png`、`demo-assert.json`
- `node scripts/flow-chain.mjs` → **9/9**
- `npx tsc --noEmit` → exit 0
- `npx eslint "app/exp/[id]"` → exit 0

### 环境
- dev 3000 使用 `PGLITE_DIR=.pgdata-dev2`（已 init + seed），不与 3001 的 `.pgdata` 争锁。

补充：POST /api/runs/[id]/events 也兼容 {kind:'drop',...} 直报，原 {events:Action[]} 语义不变；实测 200。
