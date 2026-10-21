"use client";

/**
 * 器皿内的现象图层（沉淀 / 气泡 / 放热 / 雾气）。
 * 结构沿用旧 vessel-art.tsx，颜色改走 token；每次拖放换 key 重播。
 */

import type { CSSProperties } from "react";
import type { SceneOutcome, SceneVessel } from "@/lib/scene/types";
import styles from "../scene.module.css";

const INK = "var(--glass-outline)";

/** 沉淀：底部沉积两层 + 颗粒感，并给一层极淡描边，白沉淀在白玻璃上也能看出。 */
function precipitateShape(kind: SceneVessel["kind"], color: string) {
  const speckles = (cx: number, cy: number, rx: number) =>
    [0.18, 0.34, 0.5, 0.66, 0.82].map((t, i) => (
      <circle
        key={i}
        cx={cx - rx + t * rx * 2}
        cy={cy - (i % 2 === 0 ? 1.5 : 3.5)}
        r={1.1 + (i % 3) * 0.35}
        fill={color}
        stroke={INK}
        strokeOpacity="0.16"
        strokeWidth="0.5"
      />
    ));
  if (kind === "flask") {
    return (
      <>
        <ellipse cx="80" cy="180" rx="45" ry="5.4" fill={color} stroke={INK} strokeOpacity="0.14" strokeWidth="0.8" />
        <ellipse cx="80" cy="176" rx="28" ry="3.6" fill={color} />
        {speckles(80, 173, 24)}
      </>
    );
  }
  if (kind === "beaker") {
    return (
      <>
        <ellipse cx="80" cy="185" rx="49" ry="4.8" fill={color} stroke={INK} strokeOpacity="0.14" strokeWidth="0.8" />
        <ellipse cx="80" cy="181" rx="30" ry="3.2" fill={color} />
        {speckles(80, 178, 26)}
      </>
    );
  }
  if (kind === "volumetric") {
    return (
      <>
        <ellipse cx="80" cy="184" rx="46" ry="5" fill={color} stroke={INK} strokeOpacity="0.14" strokeWidth="0.8" />
        <ellipse cx="80" cy="180" rx="30" ry="3.4" fill={color} />
        {speckles(80, 177, 26)}
      </>
    );
  }
  return (
    <>
      <rect x="9" y="184" width="22" height="8" fill={color} rx="1" stroke={INK} strokeOpacity="0.14" strokeWidth="0.6" />
      {speckles(20, 181, 9)}
    </>
  );
}

function bubbleGeo(kind: SceneVessel["kind"]) {
  if (kind === "flask") return { x0: 40, spread: 74, cy: 168, rise: 54 };
  if (kind === "beaker") return { x0: 52, spread: 54, cy: 178, rise: 66 };
  if (kind === "volumetric") return { x0: 40, spread: 80, cy: 176, rise: 46 };
  return { x0: 14, spread: 12, cy: 182, rise: 74 };
}

/** 反应冒泡：一次性 1.5s，stagger 由 --bubble-delay 控制（与常驻气泡分开）。 */
function ReactionBubbles({ kind }: { kind: SceneVessel["kind"] }) {
  const g = bubbleGeo(kind);
  const rScale = kind === "tube" ? 1.9 : 1;
  const count = kind === "tube" ? 9 : 7;
  const stagger = kind === "tube" ? 90 : 130;
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          className={styles.bubble}
          cx={g.x0 + ((i * 37) % g.spread)}
          cy={g.cy}
          r={(i % 2 === 0 ? 2.4 : 1.7) * rScale}
          fill="var(--glass-inner)"
          fillOpacity="0.85"
          style={
            {
              "--bubble-rise": `${g.rise}px`,
              "--bubble-delay": `${i * stagger}ms`,
            } as CSSProperties
          }
        />
      ))}
    </g>
  );
}

/** 放热：器口上方 3 条波浪线，opacity 呼吸（循环）。 */
function HeatWaves({ kind }: { kind: SceneVessel["kind"] }) {
  const top = kind === "beaker" ? 29 : kind === "volumetric" ? 8 : kind === "flask" ? 10 : 0;
  const x = kind === "tube" ? 2 : 56;
  return (
    <g className={styles.heat} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${x} ${top - i * 13} q8 -7 16 0 t16 0 t16 0`}
          fill="none"
          stroke="var(--warn)"
          strokeOpacity="0.7"
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{ animationDelay: `${i * 260}ms` }}
        />
      ))}
    </g>
  );
}

/** 雾气：器口上方上浮并变淡（可见气体 / 加热蒸汽）。 */
function Smoke({ kind }: { kind: SceneVessel["kind"] }) {
  const cy = kind === "beaker" ? 35 : kind === "tube" ? 10 : kind === "volumetric" ? 10 : 16;
  const cx = kind === "tube" ? 20 : 80;
  return (
    <g aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          className={styles.smokePuff}
          cx={cx + (i - 1) * 14}
          cy={cy - 8}
          rx={9 + i * 2}
          ry={6 + i}
          fill="var(--ink-2)"
          fillOpacity="0.4"
          style={{ animationDelay: `${i * 220}ms` }}
        />
      ))}
    </g>
  );
}

export interface OutcomeFxProps {
  vessel: SceneVessel;
  outcome: SceneOutcome | null;
  showLiquid: boolean;
}

export function OutcomeFx({ vessel, outcome, showLiquid }: OutcomeFxProps) {
  const fx = outcome?.fx ?? "none";
  return (
    <>
      {fx === "precipitate" && outcome?.phenomena.precipitate ? (
        <g className={styles.precipitate}>
          {precipitateShape(
            vessel.kind,
            outcome.phenomena.precipitate.color.toUpperCase() === "#FFFFFF"
              ? "#EDEAE1"
              : outcome.phenomena.precipitate.color,
          )}
        </g>
      ) : null}
      {fx === "bubbles" && showLiquid ? <ReactionBubbles kind={vessel.kind} /> : null}
      {fx === "heat" ? <HeatWaves kind={vessel.kind} /> : null}
      {fx === "smoke" ? <Smoke kind={vessel.kind} /> : null}
    </>
  );
}
