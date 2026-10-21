"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import { vars } from "./vars";
import type { FxProps } from "./types";

const meta = getFx("toxicGas");

const PUFFS = [
  { cx: 150, cy: 156, r: 15, dx: -30, dy: -34, delay: 0 },
  { cx: 172, cy: 154, r: 18, dx: 26, dy: -44, delay: 110 },
  { cx: 160, cy: 146, r: 22, dx: -6, dy: -62, delay: 220 },
  { cx: 136, cy: 150, r: 13, dx: -52, dy: -52, delay: 330 },
  { cx: 188, cy: 148, r: 15, dx: 50, dy: -40, delay: 440 },
  { cx: 160, cy: 128, r: 20, dx: 2, dy: -84, delay: 560 },
];

/** 有毒气体（Cl₂/SO₂/H₂S）：从器口涌出、上升扩散，角标提示撤离。 */
export function FxToxicGas({ active, onDone, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs, onDone);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：有毒气体逸出">
      <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
        <defs>
          <filter id="fx-fog-blur" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <radialGradient id="fx-fog-core">
            <stop offset="0%" stopColor="#E8F3C8" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#C5E1A5" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#5F7A3A" stopOpacity="0.15" />
          </radialGradient>
        </defs>

        {/* 器皿：气体从器口逸出（锥形瓶剪影） */}
        <g>
          <path
            d="M146 96 H174 V138 L200 196 Q202 204 194 204 H126 Q118 204 120 196 L146 138 Z"
            fill="#fff"
            fillOpacity="0.55"
            stroke="#16202C"
            strokeOpacity="0.7"
            strokeWidth="1.4"
          />
          <line x1="144" y1="96" x2="176" y2="96" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
          <path d="M128 182 H192 L196 194 Q197 199 191 199 H129 Q123 199 124 194 Z" fill="#C5E1A5" fillOpacity="0.55" />
        </g>

        <g filter="url(#fx-fog-blur)">
          {PUFFS.map((p, i) => (
            <circle
              key={i}
              className={styles.smoke}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill="url(#fx-fog-core)"
              style={vars({
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
                "--delay": `${p.delay}ms`,
              })}
            />
          ))}
          <ellipse className={styles.smoke} cx="160" cy="152" rx="34" ry="12" fill="#5F7A3A" style={vars({ "--dx": "0px", "--dy": "-20px", "--delay": "180ms" })} />
        </g>

        {/* 上升的方向线 */}
        {[138, 160, 182].map((x, i) => (
          <path
            key={x}
            className={styles.smoke}
            d={`M${x} 150 C${x - 10} 122 ${x + 10} 104 ${x} 72`}
            fill="none"
            stroke="#5F7A3A"
            strokeOpacity="0.5"
            strokeWidth="2"
            strokeLinecap="round"
            style={vars({ "--dx": "0px", "--dy": "-24px", "--delay": `${280 + i * 150}ms` })}
          />
        ))}

        {/* 气体标识 */}
        <text x="160" y="70" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="#3F5627" opacity="0.75">
          Cl₂ / SO₂ / H₂S
        </text>
      </svg>
      <FxBadge text={meta.label} semantic={meta.semantic} />
    </FxLayer>
  );
}
