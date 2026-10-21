# handoff · demo-flow（演示编排）

## 状态
- task-6 完成：10/10 实验有一键演示脚本；覆盖表 + 钩子文档落 `docs/演示钩子.md`。
- 验收：`npx tsc --noEmit`=0；我的文件 `npm run lint` 0 error；`npx vitest run` 444 passed（未退化）。
- 遗留：`app/exp/[id]/use-drop-flow.ts:67` 有 1 个 lint error（workbench-ux 作用域，非本轨道）。

## 交付物
- `lib/demo/scripts/exp01.ts ~ exp10.ts`（exp09 重写）：正确路径 → 中途 1 次 L3 事故 → `demo-retry-N` 重做 → 走完 → `demo-finish` 交卷看报告。
- `lib/demo/director.ts`：跨 realm 修复（旧版在 iframe 里 `instanceof HTMLElement` 恒 false，等于找不到任何目标）；自动展开「其他做法」details；点击 = 位移 320ms + 目标高亮 180ms + 按下 ripple + 结果条 380ms 后按 ok/fail 给反馈环；新增 `waitFor` step kind。
- `lib/demo/cursor.ts`：`ringAt`/`outline`，destroy 按 `data-demo-fx` 全清（退出不留脏 DOM）。
- `lib/demo/types.ts`：`waitFor` + `timeout` 字段。
- `lib/demo/scripts/index.ts`：`DEMO_SCRIPTS`（17 场）+ `DEMO_ORDER`（由 DEMO_SCRIPTS 派生，单一来源）。
- 越界改动（Lead 授权 B）：`components/demo/demo-overlay.tsx` 仅 import + `ORDER`→`DEMO_ORDER` 两处。
- 文档：`docs/演示钩子.md`（覆盖表 §2、动效清单 §3、时序规则 §4、钩子清单 §5）。

## 规则 / 顺序
- DEMO_ORDER：home, login, catalog, exp09, report, fx, teacher, exp01…exp08, exp10（原 7 个在前、home 仍开场）。
- 字幕时序：先操作、后字幕；caption/wait 是段导语（立即播）；拖拽路径必须 `waitFor` 结果条或等 ≥800ms 再继续。
- 失败分支：L3 事故 → 结果条三行 + 特效 → `demo-retry-N`，重做回该步开头；L4 终止类不入脚本。
- 需要 Lead 接线的新钩子（可选、不阻塞）：`demo-other-ways-toggle`、`demo-step-dot-N`、`demo-scene-stage`（详见 docs/演示钩子.md §5.2）。

## 待办
- 浏览器点测（需起 dev）：每场演示应看到 光标位移 / 目标高亮 / 按下 ripple / 结果条 / 事故特效；建议先看 exp09 与 exp08。
