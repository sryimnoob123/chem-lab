/**
 * 器皿 2.5D 质感 · 纯数据（asset-pipeline 独占 `lib/scene/**`）
 *
 * 只算"气泡该出现在哪、多久升一次"，不碰 React / DOM，可直接单测。
 * 伪随机用固定种子推进：同一 kind 每次渲染结果一致，SSR 与客户端不会水合不一致。
 */

import type { SceneVesselKind } from "./types";

export interface BubbleSpec {
  /** 局部坐标（器皿自身 160×200 / 40×200 画布）里的圆心。 */
  cx: number;
  cy: number;
  r: number;
  /** 上浮距离 px（CSS translateY 取负）。 */
  rise: number;
  /** 起始延迟 ms。 */
  delayMs: number;
  /** 单次上浮周期 ms（6~9s）。 */
  durationMs: number;
}

/** 气泡上浮周期区间（STYLE §2.2：环境循环 1.8~12s，这里取 6~9s）。 */
export const BUBBLE_MIN_MS = 6000;
export const BUBBLE_MAX_MS = 9000;
/** 每个器皿的常驻气泡数（3~6 个，按组算 1 个环境循环）。 */
export const BUBBLE_COUNT = 5;

/** 液体可上浮的纵向范围：起点 cy，向上 rise px。 */
const BUBBLE_FIELD: Readonly<Record<SceneVesselKind, { x0: number; spread: number; cy: number; rise: number } | null>> = {
  flask: { x0: 40, spread: 74, cy: 168, rise: 54 },
  beaker: { x0: 52, spread: 54, cy: 178, rise: 66 },
  volumetric: { x0: 40, spread: 80, cy: 176, rise: 46 },
  tube: { x0: 13, spread: 13, cy: 182, rise: 74 },
  dish: { x0: 20, spread: 40, cy: 170, rise: 30 },
  /* 滴定管是细长量器，常驻气泡会像"液柱在抖"，不画。 */
  burette: null,
};

/** 固定线性同余种子：不用 Math.random，保证服务端/客户端一致。 */
function pseudoRandom(index: number, salt: number): number {
  const value = (index * 9301 + salt * 49297 + 233280) % 233280;
  return value / 233280;
}

/**
 * 某类器皿的常驻气泡序列。空数组 = 这类器皿不画常驻气泡（滴定管）。
 */
export function vesselBubbles(kind: SceneVesselKind): readonly BubbleSpec[] {
  const field = BUBBLE_FIELD[kind];
  if (!field) return [];
  const rScale = kind === "tube" ? 1.9 : 1;
  return Array.from({ length: BUBBLE_COUNT }, (_, index) => ({
    // 分层均匀分布 + 少量抖动：避免几颗小圆挤成一条斜线
    cx:
      field.x0 +
      ((index + 0.5) / BUBBLE_COUNT) * field.spread +
      (pseudoRandom(index, 1) - 0.5) * field.spread * 0.3,
    cy: field.cy + pseudoRandom(index, 2) * 4,
    r: (1.5 + pseudoRandom(index, 3) * 1.3) * rScale,
    rise: field.rise * (0.72 + pseudoRandom(index, 4) * 0.28),
    delayMs: Math.round(pseudoRandom(index, 5) * 4200),
    durationMs: Math.round(BUBBLE_MIN_MS + pseudoRandom(index, 6) * (BUBBLE_MAX_MS - BUBBLE_MIN_MS)),
  }));
}
