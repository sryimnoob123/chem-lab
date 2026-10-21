# handoff — error-states（错误/事故反馈 + L1~L4 视觉分级）

## 做完了
- `IncidentBanner` 四级：L1 细边+琥珀左 3px+单行「怎么改」/1.6s；L2 图标+扣分跳动+单行/2.4s；L3 局部暗场+280ms 轻震+三行；L4 全屏压暗（z=8）+红框+「本次实验终止」+「重做本步/查看原因」44px+三行。L1/L2 收成细条，避免与结果条/右栏三重复读。
- fx：L3 只暗场景块（`stageDim`）；不再整页震；余波 1.2s；reduced-motion 全静止信息不丢。L4 压暗不依赖 fx（exp01-H1 无 fx 也有终止视觉）。
- 真实链路截图（:3001，prod build 04:42，workbench 已接 level/deduction/onRetry）：`%TEMP%\chemlab-shots\incident-real-L{1..4}-*.png`。

## props（index.ts 全导出）
- `IncidentBanner{open, level?="L2", title, lines:[3], deduction?, placement?="bottom", autoHideMs?, onDismiss?, onRetry?, onExplain?, demoId?, className?}`
- `RejectHint{open, lines:[3], anchorRef?, point?, autoHideMs=2800, onDismiss?, demoId?}`
- `ErrorToast{open, message, detail?, action?{label,onClick,demoId?}, onDismiss, autoHideMs=3500, demoId?}`
- `RetryBar{onRetry, label?="重做本步", hint?, secondary?, disabled?, demoId?, className?}`
- `messages: errorMessage(unknown)->{kind,message,retryable}; sanitizeForStudents(text,fallback?); retryLabel(kind)`

## 接线注意
- L1/L2 的 violation（`incident=false`）也出条：workbench 用 `ui.event?.level` 判断；自动收在组件内，ResultBar 常驻，两者职责不同。
- `onExplain` 可不传：组件默认展开并滚到 `demo-feedback-detail`（找不到 no-op）。
- 改完要 `npm run build` + `.\scripts\restart-prod.ps1`；standalone 运行时会锁 `.next\standalone`，必须先停 3001 再 build。
- 证据：`npx tsc --noEmit` CLEAN；`npm run lint` 0 error；`npx vitest run` 36 files/519 passed；重启后 /dev=200、/exp/exp01=200。
- 截图断言：事故条与任务看板/右栏/结果条 0 重叠；L3 暗场 .18；L4 dim .34、红框 2px、两按钮 44px 且 elementFromPoint 命中；pageerror 0。
