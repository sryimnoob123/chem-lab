"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import { vars } from "./vars";
import type { FxProps } from "./types";

const meta = getFx("boilOver");

/** 暴沸溢出：液面升至杯口、沿外壁流下、底部鼓泡加速、台面积液扩散。 */
export function FxBoilOver({ active, onDone, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs, onDone);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：暴沸溢出">
      <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
        {/* 杯壁 */}
        <path
          d="M108 72 H212 V196 Q212 204 204 204 H116 Q108 204 108 196 Z"
          fill="#fff"
          fillOpacity="0.5"
          stroke="#16202C"
          strokeOpacity="0.7"
          strokeWidth="1.4"
        />
        {/* 液面（已到杯口） */}
        <path d="M110 78 H210 V196 Q210 202 204 202 H116 Q110 202 110 196 Z" fill="#FFF59D" fillOpacity="0.55" />
        <path d="M110 78 H210" stroke="#16202C" strokeOpacity="0.35" strokeWidth="0.8" />

        {/* 沿外壁流下的液流（从杯口翻出） */}
        <path
          className={styles.pour}
          d="M108 74 C99 82 95 94 95 108 C95 136 91 176 91 218 L101 218 C101 176 105 134 105 108 C105 96 110 82 114 76 Z"
          fill="#FFF59D"
          fillOpacity="0.9"
          style={vars({ "--drop": "12px", "--delay": "120ms" })}
        />
        <path
          className={styles.pour}
          d="M212 74 C221 82 225 96 225 110 C225 138 229 178 229 218 L219 218 C219 176 215 134 215 110 C215 98 210 82 206 76 Z"
          fill="#FFF59D"
          fillOpacity="0.9"
          style={vars({ "--drop": "18px", "--delay": "240ms" })}
        />

        {/* 底部鼓泡加速 */}
        {[
          { x: 128, d: 0 },
          { x: 148, d: 70 },
          { x: 168, d: 140 },
          { x: 188, d: 210 },
          { x: 158, d: 280 },
          { x: 178, d: 350 },
        ].map((b, i) => (
          <circle
            key={i}
            className={styles.rise}
            cx={b.x}
            cy={190 - (i % 2) * 8}
            r={i % 2 === 0 ? 4.4 : 3.2}
            fill="#fff"
            fillOpacity="0.85"
            style={vars({ "--dy": "-72px", "--dur": "420ms", "--delay": `${b.d}ms` })}
          />
        ))}

        {/* 台面湿渍 */}
        <ellipse className={styles.puddle} cx="160" cy="214" rx="58" ry="7" fill="#FFF59D" />
        <ellipse cx="160" cy="214" rx="58" ry="7" fill="none" stroke="#D98324" strokeOpacity="0.4" strokeWidth="1" />
      </svg>
      <FxBadge text={meta.label} semantic={meta.semantic} />
    </FxLayer>
  );
}
