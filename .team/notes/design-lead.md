# design-lead notes

## 2026-10-20 20:50 · 操作台改成全幅沉浸式互动场景

### 做了什么
- `app/exp/[id]` 改为 `100dvh` 全幅暗场：顶条 44px + 舞台 + 事件条 44px + 实验切换坞 52px，页面无滚动。
- 场景：左侧可拖/可点试剂架（NaOH / HCl / 酚酞 / 甲基橙），中央亮描边滴定管 + 锥形瓶 + 铁架台 + 台面，四角坐标刻度，背景 40px 工程网格。
- 右侧浮层（`rgba(14,22,32,.72)` + `blur(8px)` + 1px `--bench-line`）：当前步骤、7 格步骤台账、4 张实时参数卡、提示阶梯、事故/反馈卡、5 个动作按钮。
- 底部实验切换坞 10 格，`demo-switch-exp01…exp10`；当前 09 高亮 + 左侧 2px 河大蓝；未开放点击只在事件条提示，不跳走；移动端自动把 09 滚进视野。
- 引擎接线：`useReducer` + `initState` + `apply()` → 动作推进；`detectFirstIncident()` + `applyIncident()` 兜底动态事故；`levelForStepAttempt()` / `isDeductibleHint()` 驱动 H0–H3 提示与 H2 扣分提示。
- 事故：L3/L4 弹事故卡（registry 文案 + 扣分 + 等级 + L4 终止），并挂 `components/exp/scene/fx` 的 `FxByKey`（inline 缩放到 520px，暗场覆盖 FX 自带浅色台面）。
- 保留全部动作按钮的 `data-demo-id`（导演台用），新增 `demo-scene-drop-flask`、`demo-scene-reagent-*`。

### 证据
- `npx tsc --noEmit`：0 错误。
- `npm run build`：exit 0（`/exp/[id]` 为 ƒ dynamic）。
- 生产 `next start` 浏览器实测：
  - 第 1 步点“戴丁腈手套…”→ 反馈卡“记录 / 为什么：称取 NaOH 2.0 g”，步骤仍 01；
  - 点“加约 200 mL…”→ 记录；点“冷却至室温…”→ 顶条/台账/参数进入第 02 步；
  - 第 2 步点“把水…倒入盛有浓盐酸的烧杯…”→ 事故卡 `L4`、扣 20、`FxByKey` 1 个、事件条 danger、动作全部禁用、交卷面板“实验终止 0 操作分”；
  - 连续 3 次第 1 步错误后取提示 → `H2` + “使用提示将扣独立完成分”；
  - 点酚酞再点锥形瓶 → 事件条“酚酞在酸性溶液中无色…”；
  - 点 `demo-switch-exp01` → 事件条“实验 01 待开放，先完成当前实验。”；
  - 390×844：`document.scrollWidth/Height === clientWidth/Height`，无页面滚动；切换坞自动滚到 09。
- 截图：`%TEMP%\chemlab-shots\20261020-2047\pregame-{desktop-1440,tablet-768,mobile-390}.png`
- L4 实测截图：`%TEMP%\chemlab-shots\flow-l4-fx2.png`；H2 实测见终端输出。
- `npm run shots -- exp09` 唯一问题：`/exp/exp09/report` 仍 404（6 条 = 3 视口 × HTTP+console），报告页未接，需要报告页 owner 或后续接 `data-api`。

### 改了哪些文件
- `app/exp/[id]/workbench.tsx`（重写为沉浸式场景）
- `app/exp/[id]/workbench.module.css`（重写暗场布局）
- `app/exp/[id]/scene-stage.tsx`（新增：试剂架 + 场景 + 拖放）
- `app/exp/[id]/experiment-dock.tsx`（新增：10 实验切换坞）
- `app/exp/[id]/use-workbench.ts`（引擎 reducer / 提示 / 计分）
- `app/exp/[id]/page.tsx`（`getDefinition` 校验 + `expId`）
- `components/ui/button.tsx` + `button.module.css`（新增 `action` 变体）

### 环境注意
- 本机 `next dev` 的 HMR WebSocket 握手失败，导致开发服务器页面**完全不 hydrate**（所有页面按钮都没反应）；`next build && next start` 正常 hydrate。已用生产服务器完成交互验收；后续点测请用生产服务器或先修 dev/HMR。
- 当前 3000 端口跑的是 `next start`（生产构建），不是 dev。

### 下一步 / 阻塞
- `/exp/[id]/report` 仍 404，交卷链接会失效；需要报告页或改成“交卷后留在结果面板”。
- `app/globals.css` 未追加（全部样式在 `workbench.module.css`，避免和 Lead 的 `styles/*.css` 冲突）。
- 三个方向原型 README + 最终 notes 仍待补（`docs/design/directions/README.md`）。

## 2026-10-20 23:55 · 成功/失败/重做反馈 + 全量 ix 交互反馈

### 做了什么
- `use-workbench.ts`：`WorkbenchEvent` 增加 `outcome`（success/failure）与 `stepNumber`（触发反馈的 1 基步号，成功后 state 已前进也不会串号）；每步入口 `stepStart` 快照；`retry` 恢复快照、清掉当前步 hint 记录与选项、`retrySeq+1`；`lastChoiceId` 只给被点按钮挂反馈类；失败标题 `truncateHeadline` 取首分句 ≤20 字。
- `workbench.tsx`：事件条改成 56px 两行；成功 `--jade-600` 左条 + “为什么对：…”；失败 `--danger` 左条 + 第一行“错在哪” + 第二行“为什么”；`L1~L4 · −N 分` 小标签；右侧 44px `重做本步`；`data-demo-id="demo-feedback-ok-1" / "demo-feedback-fail-1" / "demo-retry-1"`（步号用事件 stepNumber）。重做后焦点回动作区；L4 终止页按钮改“重新演示”。
- `scene-stage.tsx`：正确 `ix-snap` 器皿脉冲，失败 `ix-shake` 240ms；数字 `ix-pop`；FX 延迟用 motion token。
- `experiment-dock.tsx` / `workbench.tsx`：所有 choice、提示、重做、重置、返回/退出、实验坞、参数卡、步骤台账统一挂 `ix`；步骤当前项 `ix-step data-current=true`；步骤内容切换 `ix-enter`。
- 新增参数卡可点说明（滴定管读数 / 已用体积 / 允许误差 / 指示剂颜色），点后事件条给一句解释。
- `workbench.module.css`：事件条两行/成功态/retry/步骤反馈类；去掉自写时长，统一引 motion token；`prefers-reduced-motion` 下动画归零但颜色/描边保留。

### 证据
- `node scripts/ix-audit.mjs /exp/exp09`：**18 个元素，按下 18/18，悬停 18/18**；JSON `%TEMP%\chemlab-shots\ix-202610201554\audit.json`。三个动作按钮 hoverScale 1.040/1.041、pressScale 0.97；`demo-scene-drop-flask` 也从 1.03 修正为 0.97。
- Playwright（reducedMotion=reduce，单实例）：
  - 第 1 步正确 → `demo-feedback-ok-1` 存在，事件条含“为什么对：称取 NaOH 2.0 g…”；
  - 第 1 步错误（徒手取 NaOH）→ `demo-feedback-fail-1` + `demo-retry-1`，两行文案，URL 不变；
  - 点“重做本步” → 失败文案消失、按钮恢复可用，再点正确仍出 `demo-feedback-ok-1`；
  - 第 4 步正确/错误/重做同样通过，`demo-feedback-ok-4`、`demo-feedback-fail-4`、`demo-retry-4`；
  - 全程 `pageerror` 0。
- 截图：`%TEMP%\chemlab-shots\feedback-20261020\desktop-success-v2.png`、`desktop-failure-v3.png`、`mobile-success-v2.png`、`mobile-failure-v2.png`。

### 已知
- 移动端 390×844 无页面滚动（scrollWidth/Height == client）；rail 内部可滚，失败聚焦时可能自动滚到被点动作；事件条第二行在窄屏省略号截断，完整“为什么”在右侧反馈卡。
- `demo-step-reading` 属于 `components/exp/scene`（asset-pipeline），本轮未动；当前 18 元素审计未把它计入。
- 复跑（Lead 的 ix-audit v2）：18 个元素，按下 18/18、悬停 18/18；JSON `%TEMP%\chemlab-shots\ix-202610201556\audit.json`。三个动作按钮 hoverScale 1.040~1.041、pressScale 0.97；flask 热区也回到 0.97。

## 2026-10-21 00:20 · /exp/exp09/report 报告页上线（演示链路闭环）

### 做了什么
- 新增 `app/exp/[id]/report/page.tsx` + `report.module.css` + `error.tsx`。
- 服务端优先按当前登录学生取该实验最近一条 `finished` run；未登录则取该实验最近 finished run（仍无则取任一 run）；用 `loadRunBundle`（与 `GET /api/report/[runId]` 同一数据源）读报告，读不到渲染全 0 骨架，不抛 500。
- 顶部：实验名 + 学号/姓名 + 交卷时间 + 总分大数字（IBM Plex Mono）。
- 预习 10% / 操作 40% / 报告 50% 三张卡 + 百分比刻度条；能力点掌握度横条（K1/K2/S1/S2/A1）；事故清单（等级/名称/第几步/扣分）；关键步骤时间线倒序最多 10 条；底部返回实验列表 / 查看教师端。
- 修掉 body 34px 左内边距造成的白边（`.page` 负 margin 补偿，1100/760 两级断点同步 30/26）。
- `error.tsx` 兜底，渲染异常时仍给可读页，不空白。

### 证据
- `GET /exp/exp09/report` → **200**，无 pageerror/console error；标题「酸碱标准溶液的配制与浓度比较」，总分 87，三段 75/92/85，能力点 5 行，事故 2 条，时间线 7 条；`/experiments`、`/teacher` 链接可点通。
- 截图：`%TEMP%\chemlab-shots\report-20261021\report-desktop-final2.png`（1440×975 全页）、`report-mobile-final.png`（390 全页）。
- 操作台稳定性复测：`/exp/exp09` 共 21 个 `data-demo-id`，全部可 scrollIntoView；第 1 步正确反馈 73ms、失败反馈 101ms 出现；页面无 dialog；`ix-audit` 仍 18/18 + 18/18。

## 2026-10-21 00:42 · 交卷链路闭环（flow-chain 9/9）

- `workbench.tsx`：首次进入 `POST /api/runs` 建/复用 run（`runIdRef`）；每次 choice `POST /api/runs/[id]/events`（队列化，run 未就绪先排队，失败静默）；顶栏 `学号` 从 `GET /api/session` 填充；右上角新增 `交卷`（`data-demo-id="demo-finish"`），先 `finish`，成功带 `?runId=` 跳报告，失败/无 run 跳无参报告。
- 报告页支持 `?runId=`：有参数只认该 run，不存在或不属于本实验 → 全 0 空态（200，不回落 seed）；无参数仍取最新 finished。
- 预取报告路由，避免首次交卷跳转等编译。
- 证据：`node scripts/flow-chain.mjs` → **9/9**；报告显示本次 run 总分 **50**（预习 0 / 操作 90 / 报告 27），不是 seed 87；学号 20250101；报告 URL 带 runId。
- 截图：`%TEMP%\chemlab-shots\flow-chain\chain-end.png`、`workbench-finish.png`。
- `npx tsc --noEmit`、`npx eslint "app/exp/[id]"` 干净；未跑 build。

## 2026-10-21 interactions final
See .team/notes/design-lead-interactions.md for five-path evidence.

## 2026-10-21 demo readonly final
See .team/notes/design-lead-demo-readonly.md.

## 2026-10-21 drop audit + demo report notice
See .team/notes/design-lead-drop-demo.md.
