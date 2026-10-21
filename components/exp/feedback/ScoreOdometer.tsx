"use client";

/**
 * ScoreOdometer —— 分数 / 读数数字滚动（正反馈 L3 的"读数变准"层）。
 *
 * 规格（STYLE-20261021 §2.1 / §3.2）：600~900ms ease-out，tabular-nums，
 * 进入视口触发一次；`prefers-reduced-motion` 直接显示终值。
 * 之后 `value` 变化时从当前显示值滚到新值（用于实时分数），不重播入场。
 *
 * 信息不丢：动画数字 aria-hidden，旁边常驻一份终值文本给读屏与截图。
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";
import styles from "./feedback.module.css";

export interface ScoreOdometerProps {
  /** 目标值 */
  value: number;
  /** 起始值，默认 0 */
  from?: number;
  /** 滚动时长（ms），设计口径 600~900，默认 800 */
  duration?: number;
  /** 单位/后缀，如 "分"、"mL" */
  suffix?: string;
  /** 小数位，0~3，默认 0 */
  decimals?: number;
  /** 值下方的小标签 */
  label?: string;
  demoId?: string;
  className?: string;
}

/** 与 feedback.module.css 的 --fb-odometer 对齐（设计口径 600~900ms） */
const DEFAULT_DURATION = 800;
const MAX_DECIMALS = 3;

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function toFixedSafe(raw: number, digits: number): string {
  const scale = 10 ** digits;
  const snapped = Math.abs(raw) * scale < 0.5 ? 0 : raw;
  return snapped.toFixed(digits);
}

export function ScoreOdometer({
  value,
  from = 0,
  duration = DEFAULT_DURATION,
  suffix,
  decimals = 0,
  label,
  demoId,
  className,
}: ScoreOdometerProps) {
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const displayRef = useRef(from);
  const [display, setDisplay] = useState(from);
  const [entered, setEntered] = useState(false);
  const digits = Math.min(MAX_DECIMALS, Math.max(0, Math.round(decimals)));

  // 进入视口只触发一次
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setEntered(true));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setEntered(true);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 滚动：只在已进入视口且未开启减动效时跑；reduced 时直接渲染终值
  useEffect(() => {
    if (!entered || reduced) return;
    const startValue = displayRef.current;
    if (startValue === value) return;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
      const next = startValue + (value - startValue) * easeOutCubic(progress);
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      displayRef.current = value;
      setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [entered, reduced, value, duration]);

  const shown = reduced ? value : display;

  return (
    <span
      ref={hostRef}
      className={[styles.odometer, className].filter(Boolean).join(" ")}
      data-demo-id={demoId}
      data-reduced={reduced ? "true" : undefined}
    >
      <span className={styles.odometerValue} aria-hidden="true">
        {toFixedSafe(shown, digits)}
        {suffix ? <span className={styles.odometerSuffix}>{suffix}</span> : null}
      </span>
      <span className={styles.srOnly}>{`${toFixedSafe(value, digits)}${suffix ?? ""}`}</span>
      {label ? <span className={styles.odometerLabel}>{label}</span> : null}
    </span>
  );
}
