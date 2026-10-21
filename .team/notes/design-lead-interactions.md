## 2026-10-21 01:36 · 五种交互路径 + 顶栏交互方式切换（本轮交付）

### 做了什么
- `workbench.tsx`：顶栏「学号 → 交互方式 [拖拽][点选][键盘][事件][自动] → 交卷」；`data-demo-id=demo-mode-*`、`data-current="true"`；localStorage `chem-lab:input-mode` 持久化；根节点 `data-input-mode`。
- `choose` 的 `inputMode` 默认取当前选中方式（切换只影响推荐与记录）；键盘/自动显式传 key/auto；`sendAction` 统一写入 `params.inputMode` 后 POST `/api/runs/[id]/events`。
- 键盘：1~9 选动作、H 提示、R 重做、Enter 完成交卷；忽略 input/textarea/select/contenteditable；底部常驻快捷键提示。
- 事件：`?demo=1&reagent=naoh&vessel=flask` 直接落到已投放状态并显示同一条 NaOH 文案；路径自动把交互方式标为「事件」。
- 自动：切换后对当前步按顺序执行 correct actions，步号推进即停；重复点「自动」可再跑当前步。
- 拖拽/点选：试剂架拖到锥形瓶、点试剂→提示→点锥形瓶，事件条文案一致；Tab 切选中、Esc 取消。

### 证据
- `node scripts/flow-chain.mjs` → **9/9**（含交卷→报告页）。
- 五路径串行（单 Playwright，登录 20250101）：拖拽 35ms、点选 64ms、键盘 85ms、event 直达、自动 1.03s 到第 02 步；pageerror/console error 0（登录后）。
- payload：`{inputMode:"drag"}`、`{inputMode:"click"}`、`{inputMode:"key"}`、`{inputMode:"event"}`、`{inputMode:"auto"}` 均实测到 POST events。
- 报告 `?runId=`：自动跑完 7 步后 Enter 交卷 → `/exp/exp09/report?runId=...`，200，总分 80；默认报告 200；非法 runId 200 零骨架。
- `npx tsc --noEmit`、`npx eslint "app/exp/[id]"` 干净。
- 截图目录 `%TEMP%\chemlab-shots\five-paths`：`path-drag/click/key/event/auto.png`、`mode-*.png`（5 个切换态）、`report-by-runid.png`、`mobile.png`。
- 唯一说明：拖拽/点选是场景反馈不是引擎 choice；它们记进 `data-input-mode`，随后动作用选中方式写入 run（已验证 drag/click payload）。

### 下一步
- 若验收要求「纯拖拽动作本身也出现在 run timeline」，需要新增审计事件入口/API，当前未改 lib/api。
