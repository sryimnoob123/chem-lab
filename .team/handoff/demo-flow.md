# handoff · demo-flow（演示编排 · 2026-10-22 04:40）

## 状态
- task-6 已交付；本轮追加「真拖拽」：exp01/exp09 成功拖拽、exp03 拒收拖拽。
- 验收：`npx tsc --noEmit`=0；`npm run lint`=0 error（15 warning 均在既有 scripts/*.mjs）；`npx vitest run`=36 files / 519 passed。
- :3001 已 rebuild + restart（含 workbench 修复、CSS `:global(.ix)`、本轨道改动）。

## 实测（Playwright 无头，`/demo?autoplay=1`，04:36 构建）
| 实验 | 秒数 | 报告页 | console errors |
|---|---|---|---|
| exp01 | 67s | ✅ /exp/exp01/report?demo=1 | 4（全 `/api/session` 401，匿名预期） |
| exp09 | 72s | ✅ /exp/exp09/report?demo=1 | 4（同上） |
| exp03 | 58s | ✅ /exp/exp03/report?demo=1 | 4（同上） |

## 真拖拽 / 点击
- exp01 真拖：第 4 步溶解（水 → 器皿）；其余 click。
- exp09 真拖：第 2 步酸入水（浓盐酸 → 烧杯）、第 5 步加酚酞（酚酞 → 锥形瓶）；其余 click。
- exp03 真拖：第 1 步拖水 → **被拒收**（回弹+抖动+三行），其余 click（本实验无可成功拖拽，见 docs §9.2）。
- exp02/04/05/06/07/08/10：全部 click。

## 文件
- `lib/demo/scripts/exp01.ts`、`exp03.ts`、`exp09.ts`（drag 步骤 + 文案）
- `lib/demo/director.ts`（175 行；字幕 hold 900ms；拖拽后 380+340ms 再读结果条）
- `lib/demo/dom.ts`（新增，79 行）、`lib/demo/drag.ts`（新增，87 行）
- `docs/演示钩子.md` §9（拖拽规则 + 实测表 + 真拖/点击分配）

## 待办 / 已知
- 可选：`/api/session` 在 demoReadonly 下仍请求，匿名 401 → 每次演示 4 条 console error；清零需 workbench 跳过该 fetch（workbench-ux 作用域）。
- exp03 若要做“成功拖拽”，需改 `rack-ids.ts` 或定义文案（不在 lib/demo 写作用域，等 Lead 拍板）。
- 演示测试入口：`/demo?autoplay=1`；`autodemo=1` 参数不存在，别再用。
