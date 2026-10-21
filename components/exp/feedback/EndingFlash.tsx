"use client";

/**
 * EndingFlash —— 滴定终点 / 反应完成的一次性高光（正反馈 L2/L3 的"现象发生"层）。
 *
 * 规格（STYLE-20261021 §3.2）：`filter: brightness(1→1.06→1)` 700ms，
 * 液色过渡 600ms（用一层 accent 淡入淡出实现，只动 opacity）；
 * 只播一次，播完即静，不循环、不大面积闪光、不缩放整页。
 *
 * `prefers-reduced-motion`：不播动画，改为静态 accent 内描边 —— "终点到了"这个信息仍在。
 * 需要重播时由调用方换 key 重新挂载（组件本身不提供循环入口）。
 */

import type { ReactNode } from "react";
import { useReducedMotion } from "./use-reduced-motion";
import styles from "./feedback.module.css";

export type EndingFlashTone = "ok" | "endpoint";

export interface EndingFlashProps {
  /** ok = 反应完成（jade）；endpoint = 滴定终点（酚酞粉） */
  tone?: EndingFlashTone;
  children: ReactNode;
  demoId?: string;
  className?: string;
}

export function EndingFlash({ tone = "ok", children, demoId, className }: EndingFlashProps) {
  const reduced = useReducedMotion();

  return (
    <div
      className={[styles.flash, className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-demo-id={demoId}
      data-reduced={reduced ? "true" : undefined}
    >
      {children}
      <span className={styles.flashWash} aria-hidden="true" />
    </div>
  );
}
