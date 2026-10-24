"use client";

/**
 * 器皿合成层：玻璃（三层质感 + 液体 + 常驻气泡）+ 现象图层 + 一次性动画 key。
 * 几何全部来自 ./vessel-geometry，气泡计划来自 lib/scene/vessel-paint（可单测）。
 *
 * 2026-10-24（第五轮）：包一层 `memo`。
 * 台面上每次「拿起试剂 / 投放」都会整棵 BenchScene 重渲染，玻璃器皿本身没变 ——
 * 8 台器皿各画几十个 SVG 元素，开发构建下光这一步就 ~16ms/次渲染。
 * props 全是原始值或稳定引用（contents 走 EMPTY_CONTENTS），所以 memo 生效。
 */

import { memo } from "react";
import type { SceneOutcome, SceneVessel } from "@/lib/scene/types";
import { GlassVessel } from "./glass-vessel";
import { OutcomeFx } from "./outcome-fx";
import styles from "../scene.module.css";

/** 稳定的空内容引用：`contents[id] ?? EMPTY_CONTENTS`，别再每次渲染新建 `[]`（否则 memo 失效） */
export const EMPTY_CONTENTS: readonly string[] = [];

export type VesselArtProps = {
  vessel: SceneVessel;
  contents: readonly string[];
  outcome: SceneOutcome | null;
  /** 每次拖放自增：用作 key，让一次性动画重播。 */
  fxKey: number;
  /** 液面颜色覆盖（如变色反应的终态色）。 */
  liquidOverride?: string | null;
  /** 液位 0..1（倒液时由 bench-scene 记账，液面随倒随涨）。 */
  level?: number;
};

function VesselArtBase({ vessel, contents, outcome, fxKey, liquidOverride, level }: VesselArtProps) {
  const showLiquid = vessel.kind !== "burette" && contents.length > 0;
  // 变色反应的终态色优先；没有才回到混色表（旧行为保持一致）
  const finalLiquid = liquidOverride ?? outcome?.phenomena.colorChange?.toHex ?? null;

  return (
    <g className={styles.vesselArt} data-vessel-kind={vessel.kind}>
      <GlassVessel vessel={vessel} contents={contents} liquidOverride={finalLiquid} level={level} />
      <g key={fxKey}>
        <OutcomeFx vessel={vessel} outcome={outcome} showLiquid={showLiquid} />
      </g>
    </g>
  );
}

export const VesselArt = memo(VesselArtBase);
