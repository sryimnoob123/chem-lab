"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import { vars } from "./vars";
import type { FxProps } from "./types";

const meta = getFx("heavyMetal");

/** 重金属废液入水：暗色液滴落水 → 同心波纹 → 水体由蓝转墨绿。 */
export function FxHeavyMetal({ active, onDone, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs, onDone);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：重金属污染">
      <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
        <defs>
          <linearGradient id="fx-metal-tank" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DCE9F2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#C9D6E4" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* 水槽轮廓 */}
        <path
          d="M60 104 H260 V196 Q260 204 252 204 H68 Q60 204 60 196 Z"
          fill="url(#fx-metal-tank)"
          stroke="#16202C"
          strokeOpacity="0.7"
          strokeWidth="1.4"
        />
        <path d="M60 104 H260" stroke="#16202C" strokeOpacity="0.5" strokeWidth="1" />

        {/* 水体：fill 从蓝过渡到墨绿（pollute 动画终态即 #23402c） */}
        <rect className={styles.pollute} x="62" y="116" width="196" height="80" fill="#23402c" fillOpacity="0.72" />

        {/* 水位线 */}
        <ellipse cx="160" cy="116" rx="98" ry="7" fill="none" stroke="#16202C" strokeOpacity="0.35" strokeWidth="0.8" />

        {/* 液滴 */}
        <path className={styles.droplet} d="M160 56 C167 68 171 74 160 84 C149 74 153 68 160 56 Z" fill="#1B3A2A" />
        <path className={styles.droplet} d="M153.5 64 C155.5 68 156.5 71 153.5 74 C150.5 71 151.5 68 153.5 64 Z" fill="#fff" opacity="0.3" />

        {/* 同心波纹 */}
        {[
          { d: 0 },
          { d: 260 },
          { d: 520 },
        ].map((r, i) => (
          <ellipse
            key={i}
            className={styles.ripple}
            cx="160"
            cy="116"
            rx="12"
            ry="3.4"
            fill="none"
            stroke="#C5E1A5"
            strokeWidth="1.4"
            style={vars({ "--delay": `${r.d}ms` })}
          />
        ))}

        {/* 污染扩散：深色晕染 */}
        <ellipse cx="160" cy="152" rx="58" ry="16" fill="#23402c" opacity="0.55" />
        <ellipse cx="160" cy="180" rx="38" ry="9" fill="#1B3A2A" opacity="0.45" />
      </svg>
      <FxBadge text={meta.label} semantic={meta.semantic} position="bottom" />
    </FxLayer>
  );
}
