/**
 * 错误 / 事故反馈组件库（components/exp/incident/）。
 *
 * 三级错误语言的实现层（STYLE-20261021 §4），接线由工作台负责：
 * - E1 拒收：RejectHint（目标虚线框 + shake 由目标自己播 .ix-shake）
 * - E2 事故：FxByKey（components/exp/scene/fx）+ IncidentBanner（事故名 + 三行）
 * - E3 系统错误：ErrorToast（role="alert"）+ RetryBar（重做本步）
 *
 * 约束：0 新增依赖、只动 transform/opacity/filter、时长全走 CSS 变量、
 * prefers-reduced-motion 下静止但错误信息不丢；组件不编化学解释，文案全由调用方给。
 */

export { RejectHint, type RejectHintProps } from "./RejectHint";
export { ErrorToast, type ErrorToastProps, type ErrorToastAction } from "./ErrorToast";
export { IncidentBanner, type IncidentBannerProps } from "./IncidentBanner";
export { RetryBar, type RetryBarProps, type RetryBarAction } from "./RetryBar";
export {
  errorMessage,
  sanitizeForStudents,
  retryLabel,
  type StudentErrorKind,
  type StudentErrorCopy,
} from "./messages";
