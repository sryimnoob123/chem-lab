/**
 * 玻璃器皿的旋转轮廓（LatheGeometry 的 profile）。
 *
 * 为什么用 Lathe（旋转体）而不是导入模型：
 *   一个 `.glb` 器皿动辄几百 KB，扣子上传有体积上限；而"器皿"本质是回转体，
 *   二十几个 Vector2 就能精确描述，几何由代码算出 —— 零资源、零下载、可无限缩放。
 *
 * 坐标约定：y 从 0（器底）往上，单位 = 1 ≈ 10 cm；x = 半径。
 * 每条 profile 从底心开始，沿外壁向上到瓶口，再由内壁回到瓶口内圈 ——
 * 这样 LatheGeometry 直接生成「有壁厚」的玻璃壳，而不是薄片。
 */

import * as THREE from "three";

/** 器皿类别：决定形状与默认尺寸 */
export type GlassKind = "beaker" | "tube" | "volumetric" | "cylinder" | "reagent";

const v2 = (x: number, y: number) => new THREE.Vector2(Math.max(x, 0), y);

/** 壁厚（视觉上用两层轮廓，不是真 offset —— 太薄会 z-fighting） */
const WALL = 0.045;

/**
 * 烧杯：直筒微外撇 + 圆底 + 倒液口（倒液口不做几何，靠杯口一道缺口贴图/skip）
 */
function beakerProfile(r: number, h: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  pts.push(v2(0, 0));
  pts.push(v2(r * 0.72, 0));
  // 圆底
  for (let i = 1; i <= 6; i += 1) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(v2(r * 0.72 + Math.sin(a) * (r * 0.28), r * 0.28 - Math.cos(a) * (r * 0.28)));
  }
  // 外壁（略外撇）
  for (let i = 1; i <= 8; i += 1) {
    const t = i / 8;
    pts.push(v2(r + t * r * 0.02, r * 0.28 + t * (h - r * 0.28)));
  }
  // 杯口 → 内壁下来
  pts.push(v2(r - WALL, h));
  for (let i = 8; i >= 1; i -= 1) {
    const t = i / 8;
    pts.push(v2(r - WALL - t * r * 0.01, r * 0.28 + t * (h - r * 0.28)));
  }
  pts.push(v2(r * 0.7, WALL * 1.4));
  return pts;
}

/** 试管：细长直筒 + 半球底 */
function tubeProfile(r: number, h: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  pts.push(v2(0, 0));
  pts.push(v2(r * 0.4, 0));
  for (let i = 1; i <= 8; i += 1) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(v2(Math.sin(a) * r, r - Math.cos(a) * r));
  }
  for (let i = 1; i <= 6; i += 1) {
    pts.push(v2(r, r + (i / 6) * (h - r)));
  }
  pts.push(v2(r - WALL, h));
  for (let i = 6; i >= 1; i -= 1) {
    pts.push(v2(r - WALL, r + (i / 6) * (h - r)));
  }
  pts.push(v2(r * 0.4, WALL));
  return pts;
}

/** 容量瓶：梨形瓶身 + 细颈 + 刻度线位置在颈部 */
function volumetricProfile(r: number, h: number): THREE.Vector2[] {
  const neckR = r * 0.24;
  const neckH = h * 0.34;
  const bodyH = h - neckH;
  const pts: THREE.Vector2[] = [];
  pts.push(v2(0, 0));
  pts.push(v2(r * 0.5, 0));
  // 瓶身：从底到肩，半径按余弦收
  for (let i = 1; i <= 12; i += 1) {
    const t = i / 12;
    const y = t * bodyH;
    const radius = r * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(t * 1.15, 1)) * (1 - t * 0.15));
    pts.push(v2(Math.max(radius, neckR), y));
  }
  // 颈
  for (let i = 1; i <= 6; i += 1) {
    pts.push(v2(neckR, bodyH + (i / 6) * neckH));
  }
  // 口 → 内壁
  pts.push(v2(neckR - WALL * 0.7, h));
  for (let i = 6; i >= 1; i -= 1) {
    pts.push(v2(neckR - WALL * 0.7, bodyH + (i / 6) * neckH));
  }
  for (let i = 12; i >= 1; i -= 1) {
    const t = i / 12;
    const y = t * bodyH;
    const radius = r * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(t * 1.15, 1)) * (1 - t * 0.15));
    pts.push(v2(Math.max(radius - WALL, neckR - WALL * 0.7), y));
  }
  pts.push(v2(r * 0.5 - WALL, WALL));
  return pts;
}

/** 量筒：细直筒 + 六角底座 + 刻度 */
function cylinderProfile(r: number, h: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  pts.push(v2(0, 0));
  pts.push(v2(r * 1.5, 0));
  pts.push(v2(r * 1.5, h * 0.045));
  pts.push(v2(r, h * 0.075));
  for (let i = 1; i <= 8; i += 1) {
    pts.push(v2(r, h * 0.075 + (i / 8) * (h - h * 0.075)));
  }
  pts.push(v2(r - WALL, h));
  for (let i = 8; i >= 1; i -= 1) {
    pts.push(v2(r - WALL, h * 0.075 + (i / 8) * (h - h * 0.075)));
  }
  pts.push(v2(r * 0.9, WALL));
  return pts;
}

/** 试剂瓶：肩宽 + 短颈 + 瓶盖（试剂瓶的识别特征是有盖） */
function reagentProfile(r: number, h: number): THREE.Vector2[] {
  const neckR = r * 0.36;
  const shoulderY = h * 0.78;
  const pts: THREE.Vector2[] = [];
  pts.push(v2(0, 0));
  pts.push(v2(r * 0.86, 0));
  for (let i = 1; i <= 8; i += 1) {
    pts.push(v2(r, (i / 8) * shoulderY));
  }
  // 肩部收口
  for (let i = 1; i <= 5; i += 1) {
    const t = i / 5;
    pts.push(v2(r * (1 - t) + neckR * t, shoulderY + t * (h * 0.12)));
  }
  for (let i = 1; i <= 3; i += 1) {
    pts.push(v2(neckR, shoulderY + h * 0.12 + (i / 3) * (h * 0.1)));
  }
  pts.push(v2(neckR - WALL * 0.6, h));
  for (let i = 3; i >= 1; i -= 1) {
    pts.push(v2(neckR - WALL * 0.6, shoulderY + h * 0.12 + (i / 3) * (h * 0.1)));
  }
  for (let i = 5; i >= 1; i -= 1) {
    const t = i / 5;
    pts.push(v2((r - WALL) * (1 - t) + neckR * t, shoulderY + t * (h * 0.12)));
  }
  for (let i = 8; i >= 1; i -= 1) {
    pts.push(v2(r - WALL, (i / 8) * shoulderY));
  }
  pts.push(v2(r * 0.86 - WALL, WALL));
  return pts;
}

/** 默认尺寸（单位 ≈ 10 cm，和台面比例对齐） */
export const GLASS_SIZE: Record<GlassKind, { r: number; h: number }> = {
  beaker: { r: 0.62, h: 1.15 },
  tube: { r: 0.17, h: 1.5 },
  volumetric: { r: 0.6, h: 2.1 },
  cylinder: { r: 0.3, h: 2.4 },
  reagent: { r: 0.5, h: 1.55 },
};

/** 生成器皿几何（每次新建，dispose 由调用方负责） */
export function glassGeometry(kind: GlassKind): THREE.LatheGeometry {
  const { r, h } = GLASS_SIZE[kind];
  const profile =
    kind === "beaker"
      ? beakerProfile(r, h)
      : kind === "tube"
        ? tubeProfile(r, h)
        : kind === "volumetric"
          ? volumetricProfile(r, h)
          : kind === "cylinder"
            ? cylinderProfile(r, h)
            : reagentProfile(r, h);
  // 24 段：低端机也扛得住；器皿是回转体，24 段在 2.5D 视角下看不出棱
  return new THREE.LatheGeometry(profile, 24);
}

/** 液体几何：同轮廓内缩一圈，只取到液面高度（由调用方 scaleY） */
export function liquidGeometry(kind: GlassKind, level = 1): THREE.BufferGeometry {
  const { r, h } = GLASS_SIZE[kind];
  /**
   * 液体不能直接用 r：梨形的容量瓶在中段收窄，用满半径会穿出瓶壁（截图里像个方块浮在瓶里）。
   * 取瓶身最细处的比例做上限，宁可液体略细，也不让它露到玻璃外面。
   */
  const TAPER: Record<GlassKind, number> = { beaker: 0.94, tube: 0.9, volumetric: 0.62, cylinder: 0.9, reagent: 0.86 };
  const inner = (r - WALL * 1.1) * TAPER[kind];
  const height = Math.max(h * level, 0.001);
  return new THREE.CylinderGeometry(inner, inner * 0.97, height, 24, 1, false);
}

/** 刻度线：贴在器壁上的细环（用薄圆环代替纹理，零资源） */
export function graduationRing(kind: GlassKind): THREE.RingGeometry {
  const { r } = GLASS_SIZE[kind];
  const inner = Math.max(r - WALL * 1.15, 0.01);
  return new THREE.RingGeometry(inner, inner + 0.012, 24);
}
