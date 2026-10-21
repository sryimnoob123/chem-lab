# handoff · workbench-ux（操作台体验 / 拖拽三段式 + 提示三级阶梯）

状态：**四绿**（tsc 0 / lint 0 error / vitest 519 passed / 浏览器实测 :3001 通过）；workbench.tsx 双编码事故已由 Lead 修复，我接手补完并实测。
口径：流程正确性 > UI 美化；demo 钩子 / `data-demo-id` / stepIndex / dispatch 语义不动（唯一例外：drop 的 dispatch 延后到倒入动画播完）。

## 流程有影响的改动（验收重点）
1. `use-drop-flow.ts`：松手 → 吸附 160ms → 倒入 **700ms 播完才** `onAccept`（实测：pour 覆盖层 0~550ms 在，600ms 时 `第 4/7 步 · 现在该溶解了 → 现在该观察了`）；
   失败 → 回弹 240ms + `RejectHint` 三行（错在哪/为什么/怎么改）+ `fail-reject`，本步不动、原地重试。
2. `scene-stage.tsx`：接 `useDropFlow` + `PourFX`；同步 `resolveDrop`；`hintHighlight` → 锥形瓶描边+箭头；`SuccessBurst`/`EndingFlash` 占位。
3. `drop-resolve.ts`：`resolveDrop`/`nextReagentId`/`canPourAction`/`REAGENT_DROP_COPY`（11 单测）。
4. `hint-ladder.ts` + `use-workbench.ts#revealHint`：L1/L2/L3 递进、每步 3 次、第 4 次不给、扣 1/3/5；`operationScore` 本地同步。
5. `workbench.tsx`：`askHint()` 唯一入口（灯泡/键盘 H/24s 空闲/看板）；L3 高亮只亮一个目标；`finish` 带 `?auto=1`；`ErrorToast` 重试（`retryRef`）；
   `IncidentBanner` 按 error-states 口径 **L1~L4 都出**（`level/deduction/onRetry`），L1/L2 由组件自动收。
6. 音效：`drop`(落点) / `ok-l1` / `ok-l2` / `fail-reject` / `fail-incident` / `tick` / `error-system`。

## 纯视觉改动
- 抓起 `opacity .92 + scale(.98)`（**修了 CSS Modules 坑**）、热区 `outline + 淡填充`（`data-over`）、失败回弹 240ms；
- 灯泡 76×32（`data-demo-id="demo-hint-button"` 未改名，`data-level`/`data-exhausted`/`已用完`）；L3 描边+箭头（guide.module.css）；
- `NextActionCard` 主按钮放大成一句大字指令；keyFooter 34px；坐标角标/重复文案收起。

## 坑 / 待接（详见 `.team/notes/workbench-ux.md` 末尾）
- **CSS Modules 会把本地 `.ix` 哈希成 `<hash>_ix`**，motion.css 的 `.ix` 是全局类 → 选择器永不匹配。已把 workbench.module.css 5 处改 `:global(.ix)`；全仓只有该文件踩坑。
- 结算侧（Lead）：`computeIndependentDeduct` 改 `Σ {1:1,2:3,3:5}`；报告/教师端「第 N 步 · 提示 k 次 · −X 分」；`POST /api/runs/[id]/events` 兼容 `{hint:{stepIndex,level,deduct,competency}}`（workbench 已留 `askHint` + `TODO(结算侧)`）。
- 已知债务：workbench.tsx 剩 29 处 U+FFFD **全在注释**；`workbench.module.css` 有旧 hintBox 死 CSS（`.hintButton` 会覆盖页脚 padding，尺寸仍 76×32）；L3 文案说「高亮手套/聚乙烯瓶」，实际高亮的是右侧主按钮（文案在实验定义，不属我 scope）。
- 证据：`vitest 519 passed` / `tsc 0` / `lint 0 error(15 warning, scripts/*.mjs)`；截图 `%TEMP%\chemlab-shots\20261022-hint\`、`%TEMP%\chemlab-shots\20261022-drop\`。
