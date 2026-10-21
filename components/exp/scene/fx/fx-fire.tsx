"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import { vars } from "./vars";
import type { FxProps } from "./types";

const meta = getFx("fire");

/** 酒精灯翻倒 / 有机溶剂起火：三层焰舌 + 火星，循环播放。 */
export function FxFire({ active, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：起火">
      <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
        <defs>
          <radialGradient id="fx-fire-glow">
            <stop offset="0%" stopColor="#E8B33A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E8B33A" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="160" cy="188" rx="86" ry="40" fill="url(#fx-fire-glow)" />

        {/* 灯身 */}
        <path d="M120 206 L132 176 H188 L200 206 Z" fill="#DCE9F2" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
        <rect x="154" y="166" width="12" height="12" fill="#4A5768" />
        <path d="M132 176 H188" stroke="#16202C" strokeOpacity="0.45" strokeWidth="1" />

        {/* 三层焰舌：外橙 / 中黄 / 内白，逐层抖动 */}
        <g className={styles.flicker}>
          <path d="M136 168 C132 142 144 110 160 84 C176 110 188 142 184 168 Z" fill="#D98324" />
        </g>
        <g className={styles.flicker} style={{ animationDelay: "90ms" }}>
          <path d="M144 168 C142 148 151 126 160 108 C169 126 178 148 176 168 Z" fill="#E8B33A" />
        </g>
        <g className={styles.flicker} style={{ animationDelay: "180ms" }}>
          <path d="M152 168 C151 156 156 146 160 136 C164 146 169 156 168 168 Z" fill="#fff" />
        </g>

        {/* 火星 */}
        {[
          { x: 142, d: 0 },
          { x: 158, d: 160 },
          { x: 174, d: 320 },
          { x: 150, d: 480 },
          { x: 168, d: 640 },
        ].map((s, i) => (
          <circle
            key={i}
            className={styles.rise}
            cx={s.x}
            cy={150 - i * 6}
            r={2.2}
            fill="#E8B33A"
            style={vars({ "--dy": "-64px", "--dur": "900ms", "--delay": `${s.d}ms` })}
          />
        ))}
      </svg>
      <FxBadge text={meta.label} semantic={meta.semantic} />
    </FxLayer>
  );
}
