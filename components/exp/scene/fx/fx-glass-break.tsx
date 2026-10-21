"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import { vars } from "./vars";
import type { FxProps } from "./types";

const meta = getFx("glassBreak");

const IMPACT = { x: 160, y: 104 };

/** 12 条从撞击点放射的裂纹（折线，逐条 stroke-dashoffset 画出）。 */
const CRACKS: readonly string[] = [
  "160,104 151,74 143,56",
  "160,104 174,72 186,58",
  "160,104 194,96 212,92",
  "160,104 186,116 206,126",
  "160,104 169,144 176,168",
  "160,104 147,142 137,166",
  "160,104 128,114 108,120",
  "160,104 136,94 114,82",
  "160,104 159,68 161,46",
  "160,104 188,84 202,68",
  "160,104 144,112 126,104",
  "160,104 176,104 196,112",
];

const FRAGMENTS = [
  { points: "150,128 162,122 158,140", fall: 64, rot: 46, d: 320 },
  { points: "172,134 182,128 180,146", fall: 82, rot: -58, d: 380 },
  { points: "136,142 146,138 141,154", fall: 70, rot: 92, d: 440 },
  { points: "190,142 198,136 197,152", fall: 88, rot: -84, d: 500 },
  { points: "160,150 170,146 166,162", fall: 56, rot: 30, d: 560 },
  { points: "126,150 134,146 131,160", fall: 78, rot: -40, d: 620 },
  { points: "176,158 184,154 182,166", fall: 66, rot: 110, d: 680 },
  { points: "148,160 156,156 153,170", fall: 74, rot: -120, d: 740 },
];

export function FxGlassBreak({ active, onDone, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs, onDone);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：器皿破裂">
      <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
        <defs>
          <clipPath id="fx-glass-clip">
            <path d="M112 78 H208 V192 Q208 200 200 200 H120 Q112 200 112 192 Z" />
          </clipPath>
        </defs>
        {/* 器皿轮廓：杯身 */}
        <path
          d="M112 78 H208 V192 Q208 200 200 200 H120 Q112 200 112 192 Z"
          fill="#fff"
          fillOpacity="0.35"
          stroke="#16202C"
          strokeOpacity="0.7"
          strokeWidth="1.4"
        />
        <ellipse cx="160" cy="78" rx="48" ry="6" fill="none" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />

        {/* 撞击点 */}
        <circle cx={IMPACT.x} cy={IMPACT.y} r="4" fill="#DCE9F2" stroke="#16202C" strokeOpacity="0.8" strokeWidth="1.2" />
        <circle cx={IMPACT.x} cy={IMPACT.y} r="1.6" fill="#16202C" fillOpacity="0.8" />

        {/* 放射裂纹（裁在杯壁内，不飞出器皿） */}
        <g clipPath="url(#fx-glass-clip)">
          {CRACKS.map((points, i) => (
          <polyline
            key={points}
            className={styles.crack}
            points={points}
            fill="none"
            stroke="#16202C"
            strokeOpacity="0.78"
            strokeWidth="1.2"
            strokeLinejoin="round"
            strokeLinecap="round"
              style={vars({ "--delay": `${i * 34}ms` })}
            />
          ))}
        </g>

        {/* 碎片下落 */}
        {FRAGMENTS.map((f, i) => (
          <polygon
            key={i}
            className={styles.fall}
            points={f.points}
            fill="#DCE9F2"
            fillOpacity="0.85"
            stroke="#16202C"
            strokeOpacity="0.7"
            strokeWidth="1"
            style={vars({ "--fall": `${f.fall}px`, "--rot": `${f.rot}deg`, "--delay": `${f.d}ms` })}
          />
        ))}

        {/* 试液飞溅 */}
        {[
          { x: 146, y: 118, r: 2.4 },
          { x: 176, y: 126, r: 1.8 },
          { x: 132, y: 132, r: 1.5 },
          { x: 190, y: 140, r: 2 },
        ].map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#9FD2EC" opacity="0.75" />
        ))}
      </svg>
      <FxBadge text={meta.label} semantic={meta.semantic} />
    </FxLayer>
  );
}
