# handoff — error-states（错误/事故反馈 + L1~L4 视觉分级）

## 做完了
- `IncidentBanner` 四级：L1 细边+琥珀左 3px/1.6s 自动收；L2 图标+扣分数值跳动/2.4s；L3 `--bench-ink-dark` 局部暗场+280ms 轻震；L4 全屏压暗（z=8，低于 rail 10/看板 12/Dock 27/顶栏 30）+红框+「本次实验终止」+「重做本步/查看原因」44px。L4 不依赖 fx（exp01-H1 无 fx 也有终止视觉）。
- fx：L3 只暗场景块（`stageDim`）；不再整页震；余波 1.2s；reduced-motion 全静止信息不丢。
- 验收截图：`%TEMP%\chemlab-shots\incident-L{1..4}-*.png`；临时路由 `app/dev/incident-preview` 已删。

## props（index.ts 全导出）
- `IncidentBanner{open, level?="L2", title, lines:[3], deduction?, placement?="bottom", autoHideMs?, onDismiss?, onRetry?, onExplain?, demoId?, className?}`
- `RejectHint{open, lines:[3], anchorRef?, point?, autoHideMs=2800, onDismiss?, demoId?}`
- `ErrorToast{open, message, detail?, action?{label,onClick,demoId?}, onDismiss, autoHideMs=3500, demoId?}`
- `RetryBar{onRetry, label?="重做本步", hint?, secondary?, disabled?, demoId?, className?}`
- `messages: errorMessage(unknown)->{kind,message,retryable}; sanitizeForStudents(text,fallback?); retryLabel(kind)`

## 接线注意
- workbench 还差 3 处（已发 Lead）：`incidentEvent = ui.event?.level ? ui.event : null`；传 `level`/`deduction`；`onRetry={terminate ? retry : undefined}`。不传 level 会全变 L2。
- L1/L2 的 `ui.event.incident=false`（violation），旧条件会滤掉；`ui.event.level` 对违规也有值。
- `onExplain` 可不传：组件默认展开并滚到 `demo-feedback-detail`（找不到 no-op）。
- 证据：`npx tsc --noEmit` CLEAN；`npm run lint` 0 error；`npx vitest run` 36 files/519 passed；scoped eslint 0/0。
- 截图断言：事故条与左上任务看板/右栏 0 重叠；L3 stageDim .18；L4 dim .34、红框 2px、两按钮 44px 且 elementFromPoint 命中；pageerror 0。
