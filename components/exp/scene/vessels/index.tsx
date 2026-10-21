"use client";

/**
 * 器皿合成层：玻璃（三层质感 + 液体 + 常驻气泡）+ 现象图层 + 一次性动画 key。
 * 几何全部来自 ./vessel-geometry，气泡计划来自 lib/scene/vessel-paint（可单测）。
 */

import type { SceneOutcome, SceneVessel } from "@/lib/scene/types";
import { GlassVessel } from "./glass-vessel";
import { OutcomeFx } from "./outcome-fx";
import styles from "../scene.module.css";

export type VesselArtProps = {
  vessel: SceneVessel;
  contents: readonly string[];
  outcome: SceneOutcome | null;
  /** 每次拖放自增：用作 key，让一次性动画重播。 */
  fxKey: number;
  /** 液面颜色覆盖（如变色反应的终态色）。 */
  liquidOverride?: string | null;
};

export function VesselArt({ vessel, contents, outcome, fxKey, liquidOverride }: VesselArtProps) {
  const showLiquid = vessel.kind !== "burette" && contents.length > 0;
  // 变色反应的终态色优先；没有才回到混色表（旧行为保持一致）
  const finalLiquid = liquidOverride ?? outcome?.phenomena.colorChange?.toHex ?? null;

  return (
    <g className={styles.vesselArt} data-vessel-kind={vessel.kind}>
      <GlassVessel vessel={vessel} contents={contents} liquidOverride={finalLiquid} />
      <g key={fxKey}>
        <OutcomeFx vessel={vessel} outcome={outcome} showLiquid={showLiquid} />
      </g>
    </g>
  );
}
