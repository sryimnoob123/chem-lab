/**
 * 实验台引擎 · 器材注册表（数据驱动层）。
 *
 * 目的（用户 2026-10-23）：不要「一个实验写一套场景」。10 个实验 + 以后的自由实验，
 * 都从这张表里挑器材、按槽位摆到台面上，渲染由 renderer 统一负责。
 * 加一个新器材 = 在这张表里加一条 + 在 geometry 里给一个轮廓，不改渲染器。
 *
 * 单位：世界单位 1 ≈ 10 cm（玻璃器皿直径 12 cm → r = 0.6）。
 * 坐标：台面 x 横向 [-1, 1] 归一化，z 纵深（0 = 台面中线，正值靠前）。
 */

export type LabItemCategory = "glass" | "instrument" | "support";

export interface LabItemDef {
  /** 唯一 id，同时也是几何轮廓的 key */
  kind: string;
  /** 界面上显示的名字 */
  label: string;
  category: LabItemCategory;
  /** 外廓尺寸（世界单位，半径 × 高度） */
  size: { r: number; h: number };
  /** 能否装液体（决定要不要画液面） */
  holdsLiquid: boolean;
  /** 默认摆放：台面横向归一化位置，0 = 正中，越负越靠左 */
  slot: number;
  /** 是否带刻度（画刻度环） */
  graduated?: boolean;
  /** 是否支撑物（支架/铁架台，不参与液体交互） */
  note?: string;
}

/**
 * 器材表。只登记**场景里会出现**的器材；学生能拖进台面的那些在 lib/plan/pieces.ts，
 * 两者靠 kind 对齐（拼接方案的块 → 场景器材）。
 */
export const LAB_ITEMS: readonly LabItemDef[] = [
  { kind: "beaker", label: "烧杯", category: "glass", size: { r: 0.62, h: 1.15 }, holdsLiquid: true, slot: -0.62, graduated: true },
  { kind: "tube", label: "试管", category: "glass", size: { r: 0.17, h: 1.5 }, holdsLiquid: true, slot: -0.34 },
  { kind: "volumetric", label: "容量瓶", category: "glass", size: { r: 0.6, h: 2.1 }, holdsLiquid: true, slot: 0.04, graduated: true },
  { kind: "cylinder", label: "量筒", category: "glass", size: { r: 0.3, h: 2.4 }, holdsLiquid: true, slot: 0.34, graduated: true },
  { kind: "reagent", label: "试剂瓶", category: "glass", size: { r: 0.5, h: 1.55 }, holdsLiquid: true, slot: 0.66 },
  { kind: "flask", label: "锥形瓶", category: "glass", size: { r: 0.52, h: 1.35 }, holdsLiquid: true, slot: 0.2, graduated: true },
  { kind: "burette", label: "滴定管", category: "glass", size: { r: 0.11, h: 3.6 }, holdsLiquid: true, slot: 0.5, graduated: true, note: "需支架/滴定台，悬空" },
  { kind: "balance", label: "分析天平", category: "instrument", size: { r: 0.9, h: 0.42 }, holdsLiquid: false, slot: 0.86 },
  { kind: "stand", label: "铁架台", category: "support", size: { r: 0.5, h: 2.2 }, holdsLiquid: false, slot: -0.86 },
  { kind: "wash", label: "洗瓶", category: "instrument", size: { r: 0.3, h: 1.1 }, holdsLiquid: true, slot: -0.1 },
] as const;

const BY_KIND = new Map(LAB_ITEMS.map((item) => [item.kind, item]));

export function labItem(kind: string): LabItemDef | undefined {
  return BY_KIND.get(kind);
}

/** 台面：宽度按「最多摆几件」算，深度固定 */
/**
 * 台面（真实尺寸，世界单位 1 = 10 cm）：
 *   宽 18 = 1.8 m，深 6 = 60 cm，台高 9 = 90 cm，台板厚 0.4 = 4 cm。
 * 之前写成 5.6 宽（56 cm）导致器皿相对巨大 —— 比例错，视角怎么调都不对。
 */
export const BENCH_SPEC = { width: 18, depth: 6, top: 9, thickness: 0.4 } as const;

/** 槽位 → 世界坐标（x），slot 归一化到 ±1 */
export function slotToX(slot: number): number {
  return (slot * BENCH_SPEC.width) / 2 * 0.86;
}

export interface PlacedItem {
  def: LabItemDef;
  x: number;
  z: number;
}

/**
 * 按器材清单排台面：给了 slot 用 slot，没给就沿台面均匀铺开。
 * 液体会用的器材统一往前放一点（z），避免和后排天平视觉重叠。
 */
export function placeOnBench(kinds: readonly string[], options?: { z?: number }): PlacedItem[] {
  const z = options?.z ?? 0.18;
  const known = kinds.map((kind) => BY_KIND.get(kind)).filter((d): d is LabItemDef => Boolean(d));
  const explicit = known.filter((d) => d.slot !== 0);
  const rest = known.filter((d) => d.slot === 0);

  const placed: PlacedItem[] = explicit.map((def) => ({ def, x: slotToX(def.slot), z }));

  // 没指定槽位的：在空档里均匀插入（不做碰撞检测，器皿少时够用）
  rest.forEach((def, index) => {
    const t = rest.length === 1 ? 0 : index / (rest.length - 1);
    const x = (t - 0.5) * BENCH_SPEC.width * 0.7;
    placed.push({ def, x, z });
  });

  return placed.sort((a, b) => a.x - b.x);
}
