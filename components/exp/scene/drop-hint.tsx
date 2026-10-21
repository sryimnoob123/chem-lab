"use client";

import type { SceneVessel } from "@/lib/scene/types";
import styles from "./scene.module.css";

/**
 * 拖近/点选后的目标高亮：2px 虚线环 + 提示标签。
 * 纯 SVG 元素，放在器皿 g 里，不拦截指针事件。
 */
export function DropHint({ vessel, mode }: { vessel: SceneVessel; mode: "drag" | "click" }) {
  const padX = 8;
  const padTop = 12;
  const label = mode === "drag" ? "松手加入" : "点击加入";
  const cx = vessel.x + vessel.w / 2;

  return (
    <g className={styles.dropHint} aria-hidden="true">
      <rect
        className={styles.dropRing}
        x={vessel.x - padX}
        y={vessel.y - padTop}
        width={vessel.w + padX * 2}
        height={vessel.h + padTop + 10}
        rx={6}
      />
      <g transform={`translate(${cx} ${vessel.y - padTop - 18})`}>
        <rect className={styles.dropTagBg} x={-40} y={-11} width={80} height={20} rx={2} />
        <text className={styles.dropTag} x={0} y={3} textAnchor="middle">
          {label}
        </text>
      </g>
    </g>
  );
}
