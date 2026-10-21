"use client";

/**
 * StreakPill —— 连续正确计数（正反馈"记录落笔"的轻量提示）。
 *
 * 规格（STYLE-20261021 §3.2）：仅在 ≥2 连对时出现，`.ix-pop` 180ms，不闪烁。
 * 实现：外层 pill 常驻，只让内层随 count 换 key 重播一次 ix-pop——
 * 不隐藏/不卸载外层，所以不会闪；reduced-motion 下由 motion.css 统一静音。
 * 数字与文案都由调用方给（组件内不写化学解释）。
 */

import { useReducedMotion } from "./use-reduced-motion";
import styles from "./feedback.module.css";

export interface StreakPillProps {
  /** 连续正确次数；< 2 时不渲染（"1 连对"没有信息量） */
  count: number;
  /** 计数后的短词，默认「连对」 */
  label?: string;
  demoId?: string;
  className?: string;
}

export function StreakPill({ count, label = "连对", demoId, className }: StreakPillProps) {
  const reduced = useReducedMotion();

  if (!Number.isFinite(count) || count < 2) return null;

  const shownCount = Math.floor(count);

  return (
    <span
      className={[styles.streak, className].filter(Boolean).join(" ")}
      data-demo-id={demoId}
      data-count={shownCount}
      data-reduced={reduced ? "true" : undefined}
      role="status"
    >
      <span key={reduced ? "static" : shownCount} className={`${styles.streakInner} ix-pop`}>
        <span className={styles.streakCount}>{shownCount}</span>
        <span className={styles.streakLabel}>{label}</span>
      </span>
    </span>
  );
}
