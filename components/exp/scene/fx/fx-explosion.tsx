"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import { vars } from "./vars";
import type { FxProps } from "./types";

const meta = getFx("explosion");

/** 12 片碎玻璃：起点在爆心，终点由 --dx/--dy/--rot 决定（确定性常量，避免 hydration 抖动）。 */
const SHARDS = [
  { dx: -92, dy: -62, rot: 150, d: 180 },
  { dx: 80, dy: -72, rot: -130, d: 240 },
  { dx: 104, dy: 12, rot: 88, d: 160 },
  { dx: -100, dy: 20, rot: -96, d: 220 },
  { dx: 50, dy: 78, rot: 58, d: 280 },
  { dx: -58, dy: 80, rot: -62, d: 150 },
  { dx: 24, dy: -94, rot: 24, d: 300 },
  { dx: -32, dy: -90, rot: -36, d: 200 },
  { dx: 112, dy: -26, rot: 122, d: 260 },
  { dx: -112, dy: -32, rot: -118, d: 240 },
  { dx: 68, dy: 50, rot: 176, d: 320 },
  { dx: -72, dy: 54, rot: -172, d: 280 },
];

/** 从爆心射出的冲击火花。 */
const SPARKS = [
  { x2: 256, y2: 66, d: 120 },
  { x2: 276, y2: 132, d: 160 },
  { x2: 232, y2: 196, d: 140 },
  { x2: 150, y2: 210, d: 180 },
  { x2: 82, y2: 186, d: 150 },
  { x2: 52, y2: 104, d: 130 },
  { x2: 96, y2: 54, d: 170 },
  { x2: 160, y2: 36, d: 110 },
];

export function FxExplosion({ active, onDone, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs, onDone);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：装置爆炸">
      <div className={styles.shake}>
        <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
          <defs>
            <radialGradient id="fx-blast-glow">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.98" />
              <stop offset="35%" stopColor="#E8B33A" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#D98324" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#C0392B" stopOpacity="0" />
            </radialGradient>
            <filter id="fx-blast-blur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* 冲击环 */}
          <circle className={styles.ring} cx="160" cy="120" r="24" fill="none" stroke="#D98324" strokeWidth="7" />
          <circle className={styles.ring} cx="160" cy="120" r="24" fill="none" stroke="#E8B33A" strokeWidth="3" style={{ animationDelay: "110ms" }} />
          <circle className={styles.ringGhost} cx="160" cy="120" r="40" fill="none" stroke="#D98324" strokeWidth="1.5" />

          {/* 核心火球 */}
          <circle cx="160" cy="120" r="66" fill="url(#fx-blast-glow)" className={styles.flash} style={{ animationDuration: "900ms" }} />

          {/* 冲击火花 */}
          {SPARKS.map((s, i) => (
            <line
              key={i}
              className={styles.spark}
              x1="160"
              y1="120"
              x2={s.x2}
              y2={s.y2}
              stroke={i % 2 === 0 ? "#E8B33A" : "#fff"}
              strokeWidth="2.4"
              strokeLinecap="round"
              style={vars({ "--delay": `${s.d}ms` })}
            />
          ))}

          {/* 烟团 */}
          <g filter="url(#fx-blast-blur)">
            <circle className={styles.smoke} cx="118" cy="118" r="22" fill="#A08D7C" style={vars({ "--dx": "-34px", "--dy": "-32px", "--delay": "40ms" })} />
            <circle className={styles.smoke} cx="204" cy="112" r="26" fill="#8C7A6B" style={vars({ "--dx": "38px", "--dy": "-34px", "--delay": "120ms" })} />
            <circle className={styles.smoke} cx="160" cy="150" r="30" fill="#9A8676" style={vars({ "--dx": "0px", "--dy": "-18px", "--delay": "90ms" })} />
          </g>

          {/* 白闪 */}
          <circle className={styles.flash} cx="160" cy="120" r="26" fill="#fff" filter="url(#fx-blast-blur)" style={{ animationDuration: "520ms" }} />

          {/* 碎玻璃 */}
          <g transform="translate(160 120)">
            {SHARDS.map((s, i) => (
              <polygon
                key={i}
                className={styles.debris}
                points="0,0 15,-7 10,13"
                fill="#DCE9F2"
                stroke="#16202C"
                strokeOpacity="0.7"
                strokeWidth="1.2"
                style={vars({
                  "--dx": `${s.dx}px`,
                  "--dy": `${s.dy}px`,
                  "--rot": `${s.rot}deg`,
                  "--delay": `${s.d}ms`,
                })}
              />
            ))}
          </g>
        </svg>
      </div>
      <FxBadge text={meta.label} semantic={meta.semantic} />
    </FxLayer>
  );
}
