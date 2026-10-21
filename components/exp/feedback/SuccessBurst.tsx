"use client";

/**
 * SuccessBurst —— 器皿周围一圈短刻度环扩散（正反馈 L1/L2/L3 的"器皿发光"层）。
 *
 * 规格（STYLE-20261021 §3.2）：8~12 段短线，opacity + scale，360ms，--jade-600。
 * 一次性：挂载播一次；`replayKey` 变化时只重播刻度环，不重挂子结构。
 * `prefers-reduced-motion` 下不播动画，保留一圈静态 jade 刻度（信息不丢）。
 *
 * 定位：自身是 `position: relative` 的正方形盒子，不含任何定位偏移；
 * Lead 把它放进器皿外层的 absolute 容器并用 className 调位置即可。
 */

import type { CSSProperties } from "react";
import { useReducedMotion } from "./use-reduced-motion";
import styles from "./feedback.module.css";

export type SuccessBurstLevel = "L1" | "L2" | "L3";

export interface SuccessBurstProps {
  /** 反馈级别：L1 微反馈 / L2 步骤完成 / L3 里程碑；决定默认刻度数 8/10/12 */
  level?: SuccessBurstLevel;
  /** 刻度环直径（px），默认 96；建议略大于器皿外接圆 */
  size?: number;
  /** 覆盖默认刻度数，最终夹在 8~12 */
  segments?: number;
  /** 变化即重播一次（传事件 id 或计数）；不传则挂载时播一次 */
  replayKey?: string | number;
  demoId?: string;
  className?: string;
}

const LEVEL_SEGMENTS: Record<SuccessBurstLevel, number> = { L1: 8, L2: 10, L3: 12 };
const MIN_SEGMENTS = 8;
const MAX_SEGMENTS = 12;

function clampSegments(raw: number): number {
  if (!Number.isFinite(raw)) return LEVEL_SEGMENTS.L1;
  return Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(raw)));
}

export function SuccessBurst({
  level = "L1",
  size = 96,
  segments,
  replayKey,
  demoId,
  className,
}: SuccessBurstProps) {
  const reduced = useReducedMotion();
  const count = clampSegments(segments ?? LEVEL_SEGMENTS[level]);
  const diameter = Math.max(24, size);
  const ringVars = {
    "--fb-radius": `${diameter * 0.36}px`,
    "--fb-tick": `${Math.max(6, Math.round(diameter * 0.1))}px`,
  } as CSSProperties;

  return (
    <span
      className={[styles.burst, className].filter(Boolean).join(" ")}
      style={{ width: diameter, height: diameter, ...ringVars }}
      data-level={level}
      data-demo-id={demoId}
      data-reduced={reduced ? "true" : undefined}
      aria-hidden="true"
    >
      <span key={replayKey ?? "once"} className={styles.burstRing}>
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            className={styles.burstTick}
            style={{ "--fb-angle": `${(360 / count) * index}deg` } as CSSProperties}
          />
        ))}
      </span>
    </span>
  );
}
