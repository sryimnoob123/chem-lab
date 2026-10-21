# demo-flow notes（只追加）

## 2026-10-21 17:40 · 完成：10 个实验演示脚本补齐 + director 动效/跨 realm 修复 + 覆盖表落盘

- 做了什么：
  1. 盘点现状：`lib/demo/scripts/` 原先只有 exp09 一个实验脚本；且脚本直接点第 1 步 `transfer`（前置未满足 → 按钮 disabled），实际推不动。另发现 `director.findTarget` 用 `instanceof HTMLElement` 判断 iframe 元素，跨 realm 恒 false，**旧版在任何 iframe 里都找不到目标**；`cursor.ensure` 同病（每步重复插光标）。
  2. 10 个实验全部补齐脚本（`lib/demo/scripts/exp01.ts` ~ `exp10.ts`，每个 ≤50 行）：正确路径 → 中途一次 L3 事故/拒收 → `demo-retry-N` 重做 → 继续走完 → `demo-finish` 交卷看报告。
  3. `lib/demo/director.ts`（212 行）：跨 realm 用 `nodeType/tagName` 鸭子类型；点前自动展开目标所在 `<details>`（「其他做法」折叠区，不必加钩子）；点击流程 = 320ms 位移 → 180ms 目标高亮 → 按下 scale+ripple → 结果条 380ms 观察窗 → 按 `demo-feedback-ok/-fail` 给目标 jade/danger 反馈环；新增 step kind `waitFor`（等结果条/下一步出现，超时只跳过）。
  4. `lib/demo/cursor.ts`（141 行）：`ringAt`/`outline` 通用反馈环与描边，destroy 按 `data-demo-fx` 全清。
  5. 字幕时序定稿并落实：**先操作、后字幕**——动作步骤 text 在动作+结果反馈之后播；caption/wait 段导语立即播（已写进 docs/演示钩子.md §4）。
  6. 越界改动：`components/demo/demo-overlay.tsx` 的 ORDER → `DEMO_ORDER`（内容：新增实验脚本追加在后，原 7 个顺序不变；单一来源 = lib/demo/scripts/index.ts 的 `DEMO_SCRIPTS` 派生）。Lead 已授权 B，仅此两处（import + 常量）。
  7. 覆盖表 + 钩子清单落 `docs/演示钩子.md`。
- 证据：
  - `npx tsc --noEmit` → 无输出（0）
  - `npm run lint` → 本轮我的文件 0 error / 0 warning；当前仓库另有 1 error 在 `app/exp/[id]/use-drop-flow.ts:67`（workbench-ux 作用域，非本轨道）
  - `npx vitest run` → 27 files / 444 passed（未退化）
  - 静态校验（临时 node 脚本，不落库）：230 个 click 目标全部命中定义/工作台既有钩子，失败→重做→交卷时序 0 问题
- 改了哪些文件：`lib/demo/types.ts`、`lib/demo/director.ts`、`lib/demo/cursor.ts`、`lib/demo/scripts/index.ts`、`lib/demo/scripts/exp01~exp10.ts`（exp09 重写）、`components/demo/demo-overlay.tsx`（授权 B，2 处）、新增 `docs/演示钩子.md`、本文件、`docs/` 新增文档
- 下一步 / 阻塞：运行时浏览器点测需起服务（本轮按约束未起 dev/build）；建议 Lead 在 `npm run dev` 后看「一键演示」浮层：exp01~exp10 每场应出现 光标位移/目标高亮/按下 ripple/结果条/失败事故特效；另需 workbench-ux 修 `use-drop-flow.ts:67` 的 lint error。

## 2026-10-21 17:45 · 完成：DEMO_ORDER 与脚本步数核对

- DEMO_ORDER（浮层播放顺序）：`home, login, catalog, exp09, report, fx, teacher, exp01, exp02, exp03, exp04, exp05, exp06, exp07, exp08, exp10`
  - 原 7 个在前且顺序不变（home 仍是开场）；新增 9 个实验脚本追加在后；exp09 复用原第 4 位（脚本已重写为完整流程）。
- 每个脚本的 `{ kind: ... }` 步数：exp01 38 / exp02 32 / exp03 31 / exp04 28 / exp05 34 / exp06 35 / exp07 34 / exp08 37 / exp09 39 / exp10 34；单文件 39~50 行（≤300）。
- 覆盖表与钩子清单：`docs/演示钩子.md`（§2 覆盖表、§5 钩子清单、§4 时序规则）。

## 2026-10-22 04:10 · 真拖拽：exp01/exp09/exp03 脚本改造 + 首轮实测

- 做了什么：
  1. 摸清拖拽链路：起点 `demo-scene-reagent-<id>`（`scene-stage.tsx` 的 reagent 按钮，`onDragStart` 里 `dataTransfer.setData("text/plain", reagent.id)`），落点 `demo-scene-drop-flask`；`use-drop-flow` 的 `resolveDrop(step, reagentId, performed)` 当帧判定，命中即播 700ms 倒入动画，**播完才 dispatch**。
  2. exp01 第 4 步：`demo-op-step4-dissolve` 换成 `{kind:"drag", target:"demo-scene-reagent-water", to:"demo-scene-drop-flask"}`；并修了动作顺序（brush 必须在 completesStep 的 calibrate 之前，否则按钮提前消失，实测 warning 证实）。
  3. exp09 第 2 步「酸入水」换成拖 `hcl` 瓶、第 5 步「加酚酞」换成拖 `phenolphthalein` 瓶（`params.indicator` 命中）。
  4. exp03 静态确认**没有可成功拖拽**：试剂架只有 `water`，6 步里没有可倒原语的动作命中它（`step4-wash` 有蒸馏水但 type 是 wash）；脚本保留一次"拖水被拒收"的真 DnD 示范，其余 click。
- 证据（04:00 构建、服务正常时实测）：`/demo?autoplay=1` 选 exp01 → **67s** 落到 `/exp/exp01/report?demo=1`，`reachedReport=true`，播出了「真拖拽」字幕，errors 仅 1 条 401（待确认 URL），warns 仅 `demo-op-step2-brush`（已修）。
- 改动文件：`lib/demo/scripts/exp01.ts`、`lib/demo/scripts/exp03.ts`、`lib/demo/scripts/exp09.ts`、`docs/演示钩子.md`（§9 真拖拽）。
- 阻塞：04:02 起 `app/exp/[id]/workbench.tsx` 被 workbench-ux 的 PowerShell 回写弄坏（UTF-8→GBK、吞引号、265 个 U+FFFD），`npm run build` 失败、`.next/standalone` 被清、:3001 停机；该文件归 Lead/workbench-ux，我无法修。等 `npx tsc --noEmit`=0 后我立即 rebuild + 重启 + 复测 exp01/exp09/exp03。

## 2026-10-22 04:12 · 补充：测试入口纠正

- `/exp/exp01?force=1&autodemo=1` 的 `autodemo=1` **没有被 workbench 处理**（全仓唯一出现是 `dev-dock-experiments.tsx` 的链接），不会自动演示；且不带 `play=demo` 会创建真实 run 写库。
- 正确演示测试入口：`/demo?autoplay=1`（DemoStage 自动给 iframe 拼 `?play=demo` → demoReadonly 不落库），或浮层（`DEMO_ENTRY_ENABLED=false` 时入口隐藏但代码保留）。

## 2026-10-22 04:36 · 完成：三场真拖拽实测全绿 + 字幕时序修复 + director 拆文件

- 做了什么：
  1. `lib/demo/director.ts` 拆成 175 行（原 374 行超 300）：DOM 小工具进 `lib/demo/dom.ts`（79 行），拖拽编排进 `lib/demo/drag.ts`（87 行）。
  2. 修字幕被顶掉：动作解说播出后固定 hold **900ms**，再进入下一步（否则紧跟的 caption 立刻覆盖，实测 exp09 第 5 步拖拽字幕看不到）。
  3. 拖拽结果环等待改成 `FEEDBACK_WINDOW_MS + 340`（drop 后 700ms 才 dispatch，过早读结果条会读到上一条）。
- 实测（04:36 构建，http://localhost:3001，Playwright 无头，`/demo?autoplay=1`）：

| 实验 | 用时 | 报告页 | 真拖拽证据（iframe 事件探针） | console errors |
|---|---|---|---|---|
| exp01 | **67s** | ✅ `/exp/exp01/report?demo=1` | dragstart water → drop drop-flask → dragend | 4（全是 `/api/session` 401，匿名会话预期） |
| exp09 | **72s** | ✅ `/exp/exp09/report?demo=1` | 第2步 hcl: dragstart→drop→dragend；第5步 phenolphthalein: dragstart→dragend（drop 未被探针捕获，但脚本无该步 click、步骤 5→6→7 推进+报告落地=drop 被接受） | 4（同上） |
| exp03 | **58s** | ✅ `/exp/exp03/report?demo=1` | dragstart water → drop drop-flask → dragend → `demo-reject-hint` 三行文本（操作未被接受/本步不加试剂/…） | 4（同上） |

- 拖拽/点击分配：exp01 仅第4步溶解=真拖；exp09 第2步酸入水 + 第5步加酚酞=真拖；exp03 第1步拖水=真拖但被拒收（DnD 示范）；其余（含 exp02/04/05/06/07/08/10）全部 click。
- 证据：`npx tsc --noEmit`=0；`npm run lint`=0 error / 15 warning（均为既有 scripts/*.mjs）；`npx vitest run`=36 files / 519 passed。
- 改了哪些文件：`lib/demo/director.ts`（拆分+字幕 hold+拖拽等待）、新增 `lib/demo/dom.ts`、`lib/demo/drag.ts`、`lib/demo/scripts/exp01.ts|exp03.ts|exp09.ts`、`docs/演示钩子.md`（§9 真拖拽+实测表+分配表）、notes/handoff。
- 下一步 / 阻塞：无名下阻塞；`/api/session` 401 若要清零需 workbench 在 demoReadonly 时跳过 fetch（workbench-ux 作用域）。
