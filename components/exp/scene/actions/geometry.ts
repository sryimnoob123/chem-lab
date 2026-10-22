/**
 * 器皿锚点（可复用底层的坐标层）
 *
 * 场景里所有"动作动画"（冲水、倾倒、搅拌、移液、称量）都画在实验台同一个 SVG 里，
 * 因此都需要知道器皿的瓶口 / 液面 / 器底在 viewBox 里的绝对坐标。
 * 这里把 `SCENE_VESSELS`（包围盒）+ `vessel-geometry`（局部路径）合成一份锚点，
 * 新增实验只要在 palette 里加一行器皿，动作动画自动可用。
 *
 * 纯函数、不碰 DOM，可单测。
 */

import { SCENE_VESSELS } from "@/lib/scene/palette";
import type { SceneVesselKind } from "@/lib/scene/types";
import {
  MOUTH_Y,
  VESSEL_SCALE,
  bodyPath,
  liquidSurfaceRx,
  liquidSurfaceY,
} from "../vessels/vessel-geometry";

/** 器皿局部坐标里的中轴 x（与 glass-vessel.tsx 的 CENTER_X 同一口径）。 */
const CENTER_X: Readonly<Record<SceneVesselKind, number>> = {
  flask: 80,
  beaker: 80,
  volumetric: 80,
  tube: 20,
  dish: 52,
  burette: 60,
};

/** 器底 y（局部坐标）。 */
const BASE_Y: Readonly<Record<SceneVesselKind, number>> = {
  flask: 184,
  beaker: 188,
  volumetric: 188,
  tube: 194,
  dish: 182,
  burette: 344,
};

export type VesselOffset = { dx: number; dy: number };

export type VesselAnchor = {
  id: string;
  kind: SceneVesselKind;
  /** 器皿左上角（viewBox 绝对坐标，已含拖动偏移） */
  x: number;
  y: number;
  scale: number;
  /** 瓶口中心 */
  mouthX: number;
  mouthY: number;
  /** 满液位（现有画法的液面上沿） */
  surfaceY: number;
  /** 器底 */
  baseY: number;
  /** 液面椭圆半径 */
  rx: number;
  /** 玻璃主体路径（局部坐标，需要外面套 translate/scale） */
  bodyD: string;
  /** 包围盒（viewBox 单位，未含偏移） */
  w: number;
  h: number;
  offset: VesselOffset;
};

/** 器皿 id → 锚点；找不到返回 null（不认识的器皿不画动作，绝不瞎猜坐标）。 */
export function anchorOf(id: string, offset?: VesselOffset | null): VesselAnchor | null {
  const vessel = SCENE_VESSELS.find((item) => item.id === id);
  if (!vessel) return null;
  const scale = VESSEL_SCALE[vessel.kind];
  const dx = offset?.dx ?? 0;
  const dy = offset?.dy ?? 0;
  const x = vessel.x + dx;
  const y = vessel.y + dy;
  return {
    id: vessel.id,
    kind: vessel.kind,
    x,
    y,
    scale,
    mouthX: x + CENTER_X[vessel.kind] * scale,
    mouthY: y + MOUTH_Y[vessel.kind] * scale,
    surfaceY: y + liquidSurfaceY(vessel.kind) * scale,
    baseY: y + BASE_Y[vessel.kind] * scale,
    rx: liquidSurfaceRx(vessel.kind) * scale,
    bodyD: bodyPath(vessel.kind),
    w: vessel.w,
    h: vessel.h,
    offset: { dx, dy },
  };
}

/** 器皿内容器（玻璃主体）的 transform，用于 clipPath。 */
export function bodyTransform(a: VesselAnchor): string {
  return `translate(${a.x} ${a.y}) scale(${a.scale})`;
}

/** 液面 0..1 → 需要给"满液位画法"的液体层做多少 translateY。 */
export function levelShift(a: VesselAnchor, level: number): number {
  const span = a.baseY - a.surfaceY;
  const clamped = Math.max(0, Math.min(1, level));
  return Number((span * (1 - clamped)).toFixed(2));
}
