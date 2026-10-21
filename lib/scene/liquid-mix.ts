/**
 * 液体混色 —— 按**化学语义**决定器皿里液体的颜色，不是 RGB 平均。
 *
 * 为什么需要：旧实现（`reagents.ts` 的 `liquidColorFor`）只返回"最后一次加入的试剂颜色"，
 * 导致"红 + 黄倒进去还是同一种颜色"，学生看不出反应发生了。
 *
 * 优先级（高 → 低）：
 *   1. 沉淀 / 气体（改变外观最明显）
 *   2. 指示剂变色（依赖酸碱环境）
 *   3. 配位变色（Cu²⁺ + 过量 NH₃ 深蓝、Fe³⁺ + SCN⁻ 血红）
 *   4. 有色基础液（KMnO₄ 紫、CuSO₄ 蓝…）
 *   5. 全部无色 → 水色提示（否则白液白瓶看不见）
 *
 * 纯函数、无副作用，可直接单测。
 */

/** 无色溶液在液面/瓶身里的提示色（与 reagents.ts 保持一致）。 */
export const WATER_TINT = "#DCE9F2";

export type PhenomenonKind = "precipitate" | "indicator" | "complex" | "base" | "none";

export interface LiquidMix {
  /** 最终液体填充色 */
  color: string;
  /** 液体不透明度（沉淀更浑厚） */
  opacity: number;
  kind: PhenomenonKind;
  /** 一句话现象（≤24 字）；没有明显现象时不返回 */
  note?: string;
}

/** 强酸 / 强碱 / 指示剂，用集合判断命中，避免写成一大串 if。 */
const ACIDS = new Set(["hcl", "h2so4", "hac", "h2so3"]);
const BASES = new Set(["naoh", "nh3", "koh", "baoh2"]);
const INDICATORS = new Set(["phenolphthalein", "methylorange", "starch", "litmus"]);

/** 试剂架用的变体 id → 物质 id（`na2co3-solid` → `na2co3`）。 */
const ALIASES: Readonly<Record<string, string>> = {
  water: "distilledwater",
  "na2co3-solid": "na2co3",
  "h2so4-conc": "h2so4",
  methylorange: "methylorange",
  distilledwater: "distilledwater",
};

function normalize(id: string): string {
  const lower = id.toLowerCase();
  return ALIASES[lower] ?? lower.replace(/-(solid|conc|solution)$/, "");
}

export function normalizeLiquidIds(ids: readonly string[]): string[] {
  return ids.map(normalize);
}

/** 沉淀表：两种物质相遇 → 沉淀色。顺序无关。 */
const PRECIPITATES: readonly {
  pair: readonly [string, string];
  color: string;
  note: string;
  opaque?: number;
}[] = [
  { pair: ["agno3", "nacl"], color: "#FFFFFF", note: "白色 AgCl 凝乳状沉淀", opaque: 0.72 },
  { pair: ["agno3", "hcl"], color: "#FFFFFF", note: "白色 AgCl 凝乳状沉淀", opaque: 0.72 },
  { pair: ["agno3", "kcl"], color: "#FFFFFF", note: "白色 AgCl 沉淀", opaque: 0.72 },
  { pair: ["agno3", "ki"], color: "#FFF59D", note: "黄色 AgI 沉淀", opaque: 0.8 },
  { pair: ["agno3", "kbr"], color: "#FFF9C4", note: "淡黄色 AgBr 沉淀", opaque: 0.75 },
  { pair: ["agno3", "na2s"], color: "#212121", note: "黑色 Ag₂S 沉淀", opaque: 0.85 },
  { pair: ["bacl2", "na2so4"], color: "#FFFFFF", note: "白色 BaSO₄ 沉淀", opaque: 0.74 },
  { pair: ["bacl2", "na2co3"], color: "#FFFFFF", note: "白色 BaCO₃ 沉淀", opaque: 0.74 },
  { pair: ["cacl2", "na2co3"], color: "#FFFFFF", note: "白色 CaCO₃ 沉淀", opaque: 0.72 },
  { pair: ["cacl2", "na2hpo4"], color: "#FFFFFF", note: "白色 Ca₃(PO₄)₂ 沉淀", opaque: 0.7 },
  { pair: ["cuso4", "naoh"], color: "#4FC3F7", note: "浅蓝色 Cu(OH)₂ 絮状沉淀", opaque: 0.82 },
  { pair: ["fecl3", "naoh"], color: "#8D6E63", note: "红褐色 Fe(OH)₃ 沉淀", opaque: 0.82 },
  { pair: ["mgcl2", "naoh"], color: "#FFFFFF", note: "白色 Mg(OH)₂ 沉淀", opaque: 0.7 },
  { pair: ["na2s", "hcl"], color: "#B0BEC5", note: "逸出 H₂S 气体（臭鸡蛋味）", opaque: 0.5 },
  { pair: ["na2co3", "hcl"], color: "#E3F2FD", note: "逸出 CO₂ 气泡", opaque: 0.45 },
  { pair: ["nahco3", "hcl"], color: "#E3F2FD", note: "逸出 CO₂ 气泡", opaque: 0.45 },
];

/** 有色基础液（没有反应时，倒进去就该是这个颜色）。越靠前越"有辨识度"。 */
const BASE_COLORS: readonly { id: string; color: string; opacity: number }[] = [
  { id: "kmno4", color: "#B39DDB", opacity: 0.42 },
  { id: "k2cr2o7", color: "#FF7043", opacity: 0.46 },
  { id: "k2cro4", color: "#FDD835", opacity: 0.44 },
  { id: "cuso4", color: "#81D4FA", opacity: 0.44 },
  { id: "fecl3", color: "#BCAAA4", opacity: 0.4 },
  { id: "i2", color: "#8D6E63", opacity: 0.46 },
  { id: "cocl2", color: "#F48FB1", opacity: 0.42 },
  { id: "aluminon", color: "#EF5350", opacity: 0.4 },
  { id: "na3co(no2)6", color: "#FFB74D", opacity: 0.42 },
];

function has(ids: readonly string[], id: string): boolean {
  return ids.includes(id);
}

function hasAny(ids: readonly string[], set: ReadonlySet<string>): boolean {
  for (const id of ids) if (set.has(id)) return true;
  return false;
}

/**
 * 计算器皿里液体的最终外观。
 * @param rawIds 器皿内物质 id（按加入顺序，可含试剂架变体 id）
 */
export function mixLiquids(rawIds: readonly string[]): LiquidMix {
  const ids = normalizeLiquidIds(rawIds);

  // 1. 沉淀 / 气体：先看有没有能生成沉淀的组合
  for (const item of PRECIPITATES) {
    const [a, b] = item.pair;
    if (has(ids, a) && has(ids, b)) {
      return {
        color: item.color,
        opacity: item.opaque ?? 0.75,
        kind: "precipitate",
        note: item.note,
      };
    }
  }

  // 2. 指示剂变色（依赖酸碱环境）
  const acid = hasAny(ids, ACIDS);
  const base = hasAny(ids, BASES);

  if (has(ids, "phenolphthalein")) {
    if (base) return { color: "#F48FB1", opacity: 0.5, kind: "indicator", note: "酚酞遇碱变浅粉红" };
    return { color: WATER_TINT, opacity: 0.34, kind: "indicator", note: "酚酞在酸/中性溶液中无色" };
  }
  if (has(ids, "methylorange")) {
    if (acid) return { color: "#E53935", opacity: 0.46, kind: "indicator", note: "甲基橙遇酸变红" };
    if (base) return { color: "#FDD835", opacity: 0.46, kind: "indicator", note: "甲基橙遇碱变黄" };
    return { color: "#FB8C00", opacity: 0.44, kind: "indicator", note: "甲基橙在中性溶液呈橙色" };
  }
  if (has(ids, "starch") && has(ids, "i2")) {
    return { color: "#1A237E", opacity: 0.62, kind: "indicator", note: "淀粉遇碘变深蓝" };
  }

  // 3. 配位变色
  if (has(ids, "cuso4") && has(ids, "nh3")) {
    return { color: "#1565C0", opacity: 0.52, kind: "complex", note: "Cu²⁺ 与过量氨生成深蓝配合物" };
  }
  if (has(ids, "fecl3") && has(ids, "kscn")) {
    return { color: "#B71C1C", opacity: 0.5, kind: "complex", note: "Fe³⁺ 与 SCN⁻ 显血红色" };
  }

  // 4. 有色基础液：取最有辨识度的那一种
  for (const item of BASE_COLORS) {
    if (has(ids, item.id)) {
      return { color: item.color, opacity: item.opacity, kind: "base" };
    }
  }

  // 5. 无色 → 水色提示（否则白液白瓶看不见）
  const onlyWater = ids.length === 0 || ids.every((id) => id === "distilledwater" || id === "water");
  return {
    color: WATER_TINT,
    opacity: onlyWater ? 0.3 : 0.34,
    kind: ids.length ? "base" : "none",
  };
}

/** 试剂 id 列表里是否包含指示剂（用于决定是否播放"变色"这一刻）。 */
export function hasIndicator(ids: readonly string[]): boolean {
  return normalizeLiquidIds(ids).some((id) => INDICATORS.has(id));
}
