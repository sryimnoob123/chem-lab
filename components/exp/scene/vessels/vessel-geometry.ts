/**
 * 器皿几何（2.5D 玻璃质感）—— 路径与局部坐标。
 *
 * 坐标系沿用 public/instruments：锥形瓶 / 烧杯 160×200、滴定管 120×360、
 * 试管 40×200、容量瓶 160×200；外层由 VesselArt 做 translate + scale。
 * 纯数据 + 纯函数，不含 React。
 */

import type { SceneVesselKind } from "@/lib/scene/types";

export type DrawKind = Exclude<SceneVesselKind, "dish">;

/** 与 scene 舞台的既有比例一致（调小会跟包围盒错位）。 */
export const VESSEL_SCALE: Readonly<Record<SceneVesselKind, number>> = {
  flask: 0.8,
  beaker: 0.72,
  burette: 0.7,
  volumetric: 0.85,
  tube: 0.64,
  dish: 0.64,
};

export const FLASK_BODY = "M63 16 H97 V62 L128 178 Q128 184 122 184 H38 Q32 184 32 178 L63 62 Z";
export const BEAKER_BODY = "M26 41 V188 H134 V41 Z";
export const TUBE_BODY = "M7 10 V188 Q7 196 20 196 Q33 196 33 188 V10";
export const VOLUMETRIC_BODY =
  "M68 18 H92 V70 C92 80 128 102 132 134 Q136 162 116 176 Q98 188 80 188 Q62 188 44 176 Q24 162 28 134 C32 102 68 80 68 70 Z";
export const DISH_BODY = "M12 150 Q12 182 62 182 Q92 182 92 150 Z";

/** 玻璃主体的外轮廓（三层质感里的第一层，1.4px 淡墨）。 */
export function bodyPath(kind: SceneVesselKind): string {
  switch (kind) {
    case "flask":
      return FLASK_BODY;
    case "beaker":
      return BEAKER_BODY;
    case "volumetric":
      return VOLUMETRIC_BODY;
    case "tube":
      return TUBE_BODY;
    case "dish":
      return DISH_BODY;
    default:
      return "M45 14 H75 L73 20 V300 H47 V20 Z";
  }
}

export const MOUTH_Y: Readonly<Record<SceneVesselKind, number>> = {
  flask: 16,
  beaker: 41,
  tube: 10,
  volumetric: 10,
  dish: 150,
  burette: 14,
};

/** 液面高度（液体路径的上沿），液面高光椭圆画在这条线上。 */
export function liquidSurfaceY(kind: SceneVesselKind): number {
  switch (kind) {
    case "flask":
      return 116;
    case "beaker":
      return 114;
    case "volumetric":
      return 140;
    case "tube":
      return 102;
    case "burette":
      return 20;
    default:
      return 158;
  }
}

/** 液面椭圆半径（细椭圆：宽而扁）。 */
export function liquidSurfaceRx(kind: SceneVesselKind): number {
  switch (kind) {
    case "flask":
      return 45;
    case "beaker":
      return 51;
    case "volumetric":
      return 44;
    case "tube":
      return 11;
    default:
      return 40;
  }
}

/** 液体填充路径（与既有 scene 一致，改一处即可）。 */
export function liquidPath(kind: SceneVesselKind): string {
  if (kind === "flask") {
    const y = 116;
    const left = 63 - (31 / 116) * (y - 62);
    const right = 97 + (31 / 116) * (y - 62);
    return `M${left.toFixed(1)} ${y} H${right.toFixed(1)} L126 178 Q128 184 122 184 H38 Q32 184 34 178 Z`;
  }
  if (kind === "beaker") return "M29 114 H131 V186 H29 Z";
  if (kind === "volumetric") return "M36 140 H124 Q128 160 112 174 Q96 188 80 188 Q64 188 48 174 Q32 160 36 140 Z";
  if (kind === "dish") return "M12 158 H92 V178 Q92 182 62 182 Q12 182 12 178 Z";
  return "M9 102 H31 V188 Q31 194 20 194 Q9 194 9 188 Z";
}

/**
 * 底部弧形反光（第三层）：贴着器底的一条弧线，用淡墨 + 器皿主色，
 * 让玻璃"坐"在台面上，而不是飘着。
 */
export function reflectArc(kind: SceneVesselKind): string {
  switch (kind) {
    case "flask":
      return "M42 174 Q80 186 118 174";
    case "beaker":
      return "M30 182 Q80 190 130 182";
    case "volumetric":
      return "M42 176 Q80 188 118 176";
    case "tube":
      return "M9 186 Q20 192 31 186";
    case "dish":
      return "M24 174 Q52 180 80 174";
    default:
      return "M49 292 Q60 298 71 292";
  }
}

/** 滴定管刻度（11 条，既有口径）。 */
export const BURETTE_TICKS = 11;

/**
 * 器皿高光（左上一条细线）：纸白底上不用白色，改为 --exp-accent 低透明度，
 * 让每台实验的器皿都带上自己那一档主色。
 */
export function sheenPath(kind: SceneVesselKind): string {
  switch (kind) {
    case "flask":
      return "M67 72 L46 160";
    case "beaker":
      return "M31.5 56 V180";
    case "volumetric":
      return "M74 26 V60";
    case "tube":
      return "M9.5 18 V184";
    case "dish":
      return "M22 156 V174";
    default:
      return "M51 30 V292";
  }
}
