/**
 * 器皿几何（2.5D 玻璃，画法照 preview/drag-pour.html）—— 纯数据 + 纯函数，不含 React。
 *
 * 坐标：沿用 public/instruments 的局部画布（锥形瓶 / 烧杯 / 容量瓶 160×200、试管 40×200、
 * 滴定管 120×360），外层由 glass-vessel.tsx 做 translate + scale。
 *
 * drag-pour 那套画法的三个要点（本文件提供全部几何）：
 *   1. 液体 = 一个矩形 + 液面椭圆，两层都塞进 `clipPath`（器皿主体路径）里裁出来 ——
 *      锥形瓶的收腰、试管的圆底、容量瓶的圆肚都由裁切自动得到，不用手写液体路径；
 *   2. 液面椭圆压在矩形上沿、同色、不透明度更高，看起来是「有厚度的液面」；
 *   3. 液位 `level`（0..1）只决定矩形上沿 y，所以液面能随倒液连续上升。
 */

import type { SceneVesselKind } from "@/lib/scene/types";

export type DrawKind = Exclude<SceneVesselKind, "dish">;

/** 与 scene 舞台的既有比例一致（调小会跟包围盒错位）。
 *  2026-10-23：除滴定管外统一 ×1.7 —— 原尺寸下器皿只占舞台高度 23%，
 *  中间一大片空；配套 palette 的 w/h 与 y 同步放大，底边仍压在 340 台面线。
 *  滴定管本来就 239 高，再放大会把 viewBox 顶到负值、整屏被压小，故不动。 */
export const VESSEL_SCALE: Readonly<Record<SceneVesselKind, number>> = {
  flask: 1.16,
  beaker: 1.044,
  burette: 0.7,
  volumetric: 1.2325,
  tube: 0.928,
  dish: 0.928,
};

/* ---------------- 主体轮廓 ----------------
   底部圆角照 drag-pour 的烧杯（Q 收口）画，玻璃才有「厚壁」而不是一个纸盒。 */

export const FLASK_BODY = "M63 16 H97 V62 L128 178 Q128 184 122 184 H38 Q32 184 32 178 L63 62 Z";
export const BEAKER_BODY = "M26 41 V180 Q26 188 34 188 H126 Q134 188 134 180 V41";
export const TUBE_BODY = "M7 10 V188 Q7 196 20 196 Q33 196 33 188 V10";
export const VOLUMETRIC_BODY =
  "M68 18 H92 V70 C92 80 128 102 132 134 Q136 162 116 176 Q98 188 80 188 Q62 188 44 176 Q24 162 28 134 C32 102 68 80 68 70 Z";
export const DISH_BODY = "M12 150 Q12 182 62 182 Q92 182 92 150 Z";
export const BURETTE_BODY = "M45 14 H75 L73 20 V300 H47 V20 Z";

/** 玻璃主体的外轮廓（drag-pour 的 `.glass` 那一条 path）。 */
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
      return BURETTE_BODY;
  }
}

/* ---------------- 瓶口椭圆（2.5D 的关键：口是椭圆的，能看见「里面」） ---------------- */

/**
 * 视角压缩比 K = ry / rx，直接等于俯角的正弦值。
 *   0.13（旧值）≈ 俯视 7.5° —— 几乎平视，口部只剩一条缝，这是「没有透视感」的根因；
 *   0.50 ≈ 30°，0.62 ≈ 38°（本版本），0.71 ≈ 45°，1.0 = 90° 纯俯视。
 * 用户 2026-10-23 要求 30°~45° 俯视，取中偏上 0.62。
 * 所有椭圆（口沿 / 液面 / 器底）的 ry 都从这里推，改一个数全场景一起变。
 */
export const VIEW_K = 0.62;

export type VesselMouth = { cx: number; y: number; rx: number; ry: number };

/** 口沿半径（rx）写死，ry 由 VIEW_K 推 —— 不再手填扁平的 3.2 / 7。 */
export function mouthOf(kind: SceneVesselKind): VesselMouth {
  const mouth: Record<SceneVesselKind, { cx: number; y: number; rx: number }> = {
    flask: { cx: 80, y: 16, rx: 17 },
    beaker: { cx: 80, y: 41, rx: 54 },
    volumetric: { cx: 80, y: 18, rx: 12 },
    tube: { cx: 20, y: 10, rx: 13 },
    dish: { cx: 52, y: 150, rx: 40 },
    burette: { cx: 60, y: 14, rx: 15 },
  };
  const m = mouth[kind];
  return { ...m, ry: Number((m.rx * VIEW_K).toFixed(2)) };
}

/** 瓶口中心 y（局部坐标）—— 倾倒时瓶口要对准这里。 */
export const MOUTH_Y: Readonly<Record<SceneVesselKind, number>> = {
  flask: 16,
  beaker: 41,
  tube: 10,
  volumetric: 18,
  dish: 150,
  burette: 14,
};

/** 中轴 x（局部坐标）。 */
export const CENTER_X: Readonly<Record<SceneVesselKind, number>> = {
  flask: 80,
  beaker: 80,
  volumetric: 80,
  tube: 20,
  dish: 52,
  burette: 60,
};

/** 器底 y（局部坐标）。 */
export const BASE_Y: Readonly<Record<SceneVesselKind, number>> = {
  flask: 184,
  beaker: 188,
  volumetric: 188,
  tube: 194,
  dish: 182,
  burette: 344,
};

/* ---------------- 液体：矩形 + 液面 ---------------- */

export type LiquidBox = {
  /** 液体矩形左沿 / 宽度（比玻璃窄 3 单位左右 = 壁厚） */
  x: number;
  w: number;
  /** 器内底（矩形下沿） */
  bottom: number;
  /** level = 1 时液面能到的最高处（不进瓶颈） */
  topMax: number;
  cx: number;
};

const LIQUID_BOX: Readonly<Record<SceneVesselKind, LiquidBox>> = {
  flask: { x: 36, w: 88, bottom: 182, topMax: 74, cx: 80 },
  beaker: { x: 29, w: 102, bottom: 186, topMax: 52, cx: 80 },
  volumetric: { x: 34, w: 92, bottom: 184, topMax: 80, cx: 80 },
  tube: { x: 9, w: 22, bottom: 192, topMax: 34, cx: 20 },
  dish: { x: 14, w: 76, bottom: 178, topMax: 156, cx: 52 },
  burette: { x: 47, w: 26, bottom: 298, topMax: 20, cx: 60 },
};

export function liquidBox(kind: SceneVesselKind): LiquidBox {
  return LIQUID_BOX[kind];
}

/** level（0..1）→ 液面上沿 y（局部坐标）。level ≤ 0 时等于器内底 = 没有液体。 */
export function levelTopY(box: LiquidBox, level: number): number {
  const clamped = Math.max(0, Math.min(1, level));
  const span = box.bottom - box.topMax;
  return Number((box.bottom - span * clamped).toFixed(2));
}

/**
 * 液面椭圆半径：液面越靠下，瓶身越宽（锥形瓶 / 容量瓶的收腰）；
 * 分段的折线近似足够——液面椭圆只有几个像素高，形状画准了也看不出来。
 */
export function surfaceRxAt(kind: SceneVesselKind, y: number): number {
  switch (kind) {
    case "flask": {
      const half = 17 + (31 / 116) * (y - 62);
      return Number(Math.min(47, Math.max(17, half)).toFixed(1));
    }
    case "volumetric": {
      if (y <= 72) return 12;
      const grow = 12 + (40 / 62) * (y - 72);
      const taper = y > 150 ? Math.max(20, 52 - (y - 150) * 0.45) : 52;
      return Number(Math.min(taper, grow).toFixed(1));
    }
    case "tube":
      return 11;
    case "dish":
      return 38;
    case "burette":
      return 13;
    default:
      return 51;
  }
}

/** 液面椭圆的扁度：按同一视角压缩比推（ry = rx × VIEW_K）。
 *  2026-10-23 之前是常数 4.4 —— 不管器皿多宽都一条扁线，读不出俯视，已删。 */
export function surfaceRyAt(rx: number): number {
  return Number((rx * VIEW_K).toFixed(2));
}

/** 默认液位（有液体但没数过体积时）：看得出「里面有水」，又不至于像满瓶。 */
export function defaultLevel(hasLiquid: boolean): number {
  return hasLiquid ? 0.38 : 0;
}

/** 满液位口径的液面上沿（动作层锚点用，含义不变）。 */
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

/** 液面椭圆半径（满液位口径，旧接口保留）。 */
export function liquidSurfaceRx(kind: SceneVesselKind): number {
  return surfaceRxAt(kind, liquidSurfaceY(kind));
}

/* ---------------- 玻璃五层：Tint / Specular rim / Sheen ----------------
   2026-10-23（B1）：玻璃从「一层平涂 + 一条淡墨线」改成按液态玻璃分层画。
   三层都用**同一个主体轮廓**（`bodyPath`）裁住，所以收腰、圆底、锥形瓶的斜壁自动成立；
   颜色全走 token（`--canvas-glass-*`），不在组件里写字面量。 */

/**
 * 器皿主体的局部包围盒（160×200 / 40×200 / 120×360 那套局部坐标）。
 *
 * 用途：Tint 的竖向渐变、Sheen 的 45° 斜向渐变都要一个「从瓶口到器底」的参考框。
 * 不从 palette 取：palette 是**舞台坐标**（x=1040 这种），这里是器皿自己的局部坐标。
 * 数值 = 主体 path 的极值（见各 `*_BODY` 常量），改动轮廓时一起改，有单测守着。
 */
export const BODY_BOX: Readonly<
  Record<SceneVesselKind, { x: number; y: number; w: number; h: number }>
> = {
  flask: { x: 32, y: 16, w: 96, h: 168 }, // 32..128 / 16..184
  beaker: { x: 26, y: 41, w: 108, h: 147 }, // 26..134 / 41..188
  volumetric: { x: 24, y: 18, w: 112, h: 170 }, // 24..136 / 18..188
  tube: { x: 7, y: 10, w: 26, h: 186 }, // 7..33 / 10..196
  dish: { x: 12, y: 150, w: 80, h: 32 }, // 12..92 / 150..182
  burette: { x: 45, y: 14, w: 30, h: 330 }, // 45..75 / 14..344
};

export function bodyBox(kind: SceneVesselKind): { x: number; y: number; w: number; h: number } {
  return BODY_BOX[kind];
}

/**
 * 瓶口内沿的高光弧 —— 只画**上半圈**。
 *
 * 为什么是上半圈：2.5D 俯视下口沿的「远侧」（画面上方那条）正对光，是整台器皿最亮的地方；
 * 近侧那半圈背光。整圈都描亮会读成「瓶口贴了一圈白胶带」。
 * 半径取口沿的 86%：高光在玻璃壁内侧，不是压在描边上（压上去会被外描边的深墨吃掉）。
 */
export function mouthRimArc(kind: SceneVesselKind): string {
  const m = mouthOf(kind);
  const rx = Number((m.rx * 0.86).toFixed(2));
  const ry = Number((m.ry * 0.86).toFixed(2));
  return `M ${Number((m.cx - rx).toFixed(2))} ${m.y} A ${rx} ${ry} 0 0 1 ${Number((m.cx + rx).toFixed(2))} ${m.y}`;
}

/* ---------------- 装饰细节 ---------------- */


/**
 * 底部弧形反光：贴着器底的一条弧线，让玻璃「坐」在台面上。
 * 只留一条淡墨线，不再叠主色（drag-pour 的器底就是一条淡弧）。
 */
export function reflectArc(kind: SceneVesselKind): string {
  switch (kind) {
    case "flask":
      return "M42 174 Q80 186 118 174";
    case "beaker":
      return "M32 180 Q80 188 128 180";
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

/** 器皿高光：左上一条淡墨细线（drag-pour 的 `.shine`，纸白底不用白色高光）。 */
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
