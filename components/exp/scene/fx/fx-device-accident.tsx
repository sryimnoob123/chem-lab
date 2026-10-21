"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import { vars } from "./vars";
import type { FxProps } from "./types";

const meta = getFx("deviceAccident");

const SPARKS = [
  { x: 96, y: 82, dx: -34, dy: -22, d: 180 },
  { x: 224, y: 88, dx: 38, dy: -18, d: 240 },
  { x: 224, y: 132, dx: 42, dy: 12, d: 300 },
  { x: 160, y: 76, dx: 8, dy: -30, d: 360 },
  { x: 100, y: 150, dx: -28, dy: 22, d: 420 },
];

/** 仪器损坏：屏幕爆错（红字闪烁）+ 火花 + 机身抖动。 */
export function FxDeviceAccident({ active, onDone, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs, onDone);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：仪器损坏">
      <div className={styles.shake}>
        <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
          <g transform="translate(160 140) scale(1.55) translate(-160 -140)">
          {/* 天平机身 */}
          <rect x="92" y="150" width="136" height="34" rx="3" fill="#1A2531" stroke="#2A3644" strokeWidth="1.2" />
          <rect x="104" y="158" width="52" height="6" rx="1" fill="#2A3644" />
          <rect x="164" y="158" width="50" height="6" rx="1" fill="#2A3644" />
          {/* 屏幕边框 */}
          <rect x="96" y="74" width="128" height="80" rx="4" fill="#0E1620" stroke="#2A3644" strokeWidth="1.4" />

          {/* 屏幕爆错：红色文本块闪烁 */}
          <g className={styles.blink}>
            <rect x="108" y="88" width="104" height="10" rx="1" fill="#C0392B" opacity="0.9" />
            <rect x="108" y="104" width="72" height="8" rx="1" fill="#C0392B" opacity="0.7" />
            <rect x="108" y="118" width="88" height="8" rx="1" fill="#D98324" opacity="0.75" />
            <rect x="108" y="132" width="46" height="8" rx="1" fill="#C0392B" opacity="0.55" />
          </g>
          <text
            x="196"
            y="98"
            textAnchor="end"
            fontFamily="var(--font-mono)"
            fontSize="11"
            fontWeight="600"
            fill="#C0392B"
            className={styles.blink}
          >
            ERR
          </text>
          <text x="196" y="130" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8" fill="#E8B33A">
            OVERLOAD
          </text>

          {/* 火花 */}
          {SPARKS.map((s, i) => (
            <line
              key={i}
              className={styles.spark}
              x1={s.x}
              y1={s.y}
              x2={s.x + (s.dx > 0 ? 8 : -8)}
              y2={s.y}
              stroke="#E8B33A"
              strokeWidth="2"
              strokeLinecap="round"
              style={vars({ "--dx": `${s.dx}px`, "--dy": `${s.dy}px`, "--delay": `${s.d}ms` })}
            />
          ))}
          </g>
        </svg>
      </div>
      <FxBadge text={meta.label} semantic={meta.semantic} />
    </FxLayer>
  );
}
