"use client";

import { getFx } from "@/lib/scene/fx";
import { FxBadge } from "./fx-badge";
import { FxLayer } from "./fx-layer";
import styles from "./fx.module.css";
import { useFxTimer } from "./use-fx-timer";
import type { FxProps } from "./types";

const meta = getFx("burn");

/** 化学灼伤：皮肤底 + 噪点纹理 + 由中心扩大的红痕。 */
export function FxBurn({ active, onDone, scale = "inline" }: FxProps) {
  useFxTimer(active, meta.durationMs, onDone);
  if (!active) return null;

  return (
    <FxLayer scale={scale} label="事故特效：化学灼伤">
      <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
        <defs>
          <radialGradient id="fx-skin">
            <stop offset="0%" stopColor="#F3D2B4" />
            <stop offset="100%" stopColor="#DFA981" />
          </radialGradient>
          <radialGradient id="fx-burn">
            <stop offset="0%" stopColor="#7A0E08" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#C0392B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C0392B" stopOpacity="0" />
          </radialGradient>
          <pattern id="fx-skin-noise" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.4" r="0.7" fill="#8B5E3C" opacity="0.3" />
            <circle cx="4.6" cy="4.2" r="0.6" fill="#fff" opacity="0.28" />
            <circle cx="2.6" cy="5.4" r="0.45" fill="#8B5E3C" opacity="0.22" />
          </pattern>
        </defs>

        {/* 皮肤底 */}
        <rect x="88" y="70" width="144" height="102" rx="22" fill="url(#fx-skin)" />
        <rect x="88" y="70" width="144" height="102" rx="22" fill="url(#fx-skin-noise)" opacity="0.55" />
        <rect
          x="88"
          y="70"
          width="144"
          height="102"
          rx="22"
          fill="none"
          stroke="#8B5E3C"
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />

        {/* 灼伤红痕：从中心扩大 */}
        <ellipse className={styles.burnMark} cx="160" cy="120" rx="40" ry="29" fill="url(#fx-burn)" />
        <ellipse cx="160" cy="120" rx="24" ry="17" fill="#8B0000" opacity="0.5" />
        {/* 水泡 */}
        {[
          { x: 148, y: 112, r: 4 },
          { x: 168, y: 124, r: 3.2 },
          { x: 158, y: 134, r: 2.6 },
          { x: 174, y: 108, r: 2.2 },
        ].map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#F6E3D2" opacity="0.75" />
        ))}
      </svg>
      <FxBadge text={meta.label} semantic={meta.semantic} />
    </FxLayer>
  );
}
