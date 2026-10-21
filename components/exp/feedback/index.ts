/**
 * 正反馈组件库（components/exp/feedback/）。
 *
 * 三级正反馈语言的实现层，接线由工作台负责：
 * - L1 微反馈：SuccessBurst(level="L1") + StreakPill + 结果条竖条
 * - L2 步骤完成：SuccessBurst(level="L2"/"L3") + EndingFlash
 * - L3 里程碑：ScoreOdometer + EndingFlash + SuccessBurst(level="L3")
 *
 * 约束：0 依赖、只动 transform/opacity/filter、时长全走 CSS 变量、
 * prefers-reduced-motion 下静止但信息不丢。
 */

export { SuccessBurst, type SuccessBurstProps, type SuccessBurstLevel } from "./SuccessBurst";
export { ScoreOdometer, type ScoreOdometerProps } from "./ScoreOdometer";
export { StreakPill, type StreakPillProps } from "./StreakPill";
export { EndingFlash, type EndingFlashProps, type EndingFlashTone } from "./EndingFlash";
export { useReducedMotion } from "./use-reduced-motion";
