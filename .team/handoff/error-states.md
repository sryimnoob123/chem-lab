# handoff — error-states（错误/事故反馈，task-3）

## 做完了
- E1/E3 组件 + E2 条 + 重做条：`components/exp/incident/`（portal、三行文案、44px、reduced-motion 全就绪，待接线）
- fx 增强：只抖实验台/场景层（不再抖 body）+ 600ms 后 1.2s 余波 + reduced-motion 静止，见 `components/exp/scene/fx/fx-impact.module.css`
- `lib/scene/fx.ts` 只加可选 `aftermath` 字段 + `getFxAftermath()`；fx-keys 既有断言未动

## props
- RejectHint{open, lines:[string,string,string], anchorRef?, point?, autoHideMs=2800, onDismiss?, demoId?}
- ErrorToast{open, message, detail?, action?{label,onClick,demoId?}, onDismiss, autoHideMs=3500, demoId?}
- IncidentBanner{open, title, lines:[3], placement?:"top"|"bottom", onDismiss?, demoId?, className?}
- RetryBar{onRetry, label?="重做本步", hint?, secondary?{label,onClick,demoId?}, disabled?, demoId?, className?}
- messages: errorMessage(unknown)->{kind,message,retryable}; sanitizeForStudents(text,fallback?); retryLabel(kind)

## 接线注意
- RejectHint/ErrorToast 自己 portal 到 body：只控制 open；ErrorToast 同一时刻只挂一条
- IncidentBanner 是 absolute：放进 stage（position: relative）内，top/bottom 12px，别放页面根
- FxByKey props 未变；事故后不再抖整页（motion.css 的 body.fx-impact-* 现为死规则，可后续清）
- 证据：eslint 我的文件 0/0；vitest 29 files/458 passed；全项目 `npx tsc --noEmit` CLEAN（此前两次报错均为其他角色写入中间态，已由 Lead/owner 修复）
- 遗留（不在我作用域）：`npm run lint` 全项目 2 error，在 `app/exp/[id]/workbench.tsx:545-546`（react-hooks/preserve-manual-memoization，音效接线块），另 108 行 `rejectSeq` 未使用（刚接线 RejectHint 用）；需 Lead/接线 owner 处理
