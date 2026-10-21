"use client";

/**
 * 扣分数字跳动（L2）：0 → 扣分值，420ms ease-out，不引库。
 *
 * - 用 requestAnimationFrame 改数字，只影响文本内容，不改布局；
 * - `prefers-reduced-motion` 直接显示终值（信息不丢）；
 * - 初始渲染为 0，水合后第一帧开始跳，避免 SSR 数字闪烁；
 * - setState 只在 rAF 回调里发生，不触发 react-hooks/set-state-in-effect。
 */

import { useEffect, useState } from "react";

export function useCountUp(target: number, durationMs = 420): number {
  const end = Math.max(0, Math.round(target));
  const [value, setValue] = useState(0);

  useEffect(() => {
    const finish = Math.max(0, Math.round(target));
    if (finish === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = window.requestAnimationFrame(() => setValue(finish));
      return () => window.cancelAnimationFrame(frame);
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(finish * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return Math.min(value, end);
}
