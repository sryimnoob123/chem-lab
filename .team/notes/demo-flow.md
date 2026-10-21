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
