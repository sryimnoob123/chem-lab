/**
 * 跨实验通用素材库（asset-pipeline 独占 `lib/scene/**`）
 *
 * 用户的"素材库"= 实验台左侧可拖的试剂架。这里列的是 exp04/05/06/07 鉴定反应
 * 都会用到的通用试剂 + exp09 滴定所需指示剂；颜色一律取 `lib/chem/substances.ts`
 * 的真实溶液色（无色给水色提示，否则白瓶白液看不见）。
 *
 * `demoId` 直接给试剂瓶 DOM 用，脚本/演示按它定位：
 * `data-demo-id="demo-scene-reagent-<id>"`。
 */

import { getSubstance, requireSubstance } from "@/lib/chem/substances";
import type { SceneReagent } from "./types";

/** 无色溶液在瓶身/液面里的提示色。 */
export const WATER_TINT = "#DCE9F2";

export type ReagentGroup = "exp09" | "exp01" | "common";

export type SceneReagentDef = SceneReagent & {
  /** 试剂架分组：exp09 = 本实验滴定用；common = 跨实验通用。 */
  group: ReagentGroup;
  /** 演示脚本/截图定位用，等于 data-demo-id。 */
  demoId: string;
};

function make(id: string, unit: string, group: ReagentGroup): SceneReagentDef {
  const s = requireSubstance(id);
  return {
    id: s.id,
    name: s.nameZh,
    formula: s.formula,
    colorHex: s.color.toUpperCase() === "#FFFFFF" ? WATER_TINT : s.color,
    ghs: [...s.hazards],
    unit,
    group,
    demoId: `demo-scene-reagent-${s.id}`,
  };
}

/** 同一种物质在货架上需要第二条（固体/浓溶液）时用显式 id，避免改旧 id。 */
function makeCustom(id: string, substanceId: string, unit: string, group: ReagentGroup, colorHex?: string): SceneReagentDef {
  const s = requireSubstance(substanceId);
  const base = make(substanceId, unit, group);
  return { ...base, id, colorHex: colorHex ?? base.colorHex, demoId: `demo-scene-reagent-${id}` };
}

/** 试剂架全量（顺序即展示顺序）。 */
export const REAGENTS: readonly SceneReagentDef[] = [
  // exp09 滴定
  make("naoh", "0.1 mol/L", "exp09"),
  make("hcl", "0.1 mol/L", "exp09"),
  make("phenolphthalein", "0.1% 乙醇溶液", "exp09"),
  make("methylorange", "0.1% 水溶液", "exp09"),
  // exp01 配制（固体 Na₂CO₃ / 浓硫酸 / 蒸馏水；旧 id 一律保留）
  makeCustom("na2co3-solid", "na2co3", "无水固体 AR", "exp01", "#F4F1E8"),
  makeCustom("h2so4-conc", "h2so4", "98%，18.4 mol/L", "exp01"),
  makeCustom("water", "distilledWater", "蒸馏水", "exp01"),
  // 跨实验通用（exp04 沉淀 / exp05 氧化还原 / exp06 配位 / exp07 鉴定）
  make("agno3", "0.1 mol/L", "common"),
  make("bacl2", "0.1 mol/L", "common"),
  make("cuso4", "0.1 mol/L", "common"),
  make("ki", "0.1 mol/L", "common"),
  make("starch", "0.5% 溶液", "common"),
  make("na2co3", "0.1 mol/L", "common"),
  make("h2so4", "0.5 mol/L（稀）", "common"),
  make("nh3", "6 mol/L", "common"),
  make("fecl3", "0.1 mol/L", "common"),
  make("kscn", "0.1 mol/L", "common"),
];

export const REAGENT_GROUPS: readonly { id: ReagentGroup; label: string }[] = [
  { id: "exp09", label: "本实验（滴定）" },
  { id: "exp01", label: "实验 01（配制）" },
  { id: "common", label: "通用鉴定试剂" },
];

export function getSceneReagent(id: string): SceneReagentDef | undefined {
  return REAGENTS.find((r) => r.id === id);
}

/** 器皿当前内容 → 一行可读文本，如 "NaCl + AgNO3"。 */
export function describeContents(ids: readonly string[]): string {
  if (ids.length === 0) return "空";
  return ids
    .map((id) => {
      const s = getSubstance(id);
      return s ? s.formula : id;
    })
    .join(" + ");
}

/** 内容主色（取最后加入的物质；无色给水色提示）。 */
export function liquidColorFor(ids: readonly string[]): string | null {
  if (ids.length === 0) return null;
  const last = getSubstance(ids[ids.length - 1]);
  if (!last) return WATER_TINT;
  return last.color.toUpperCase() === "#FFFFFF" ? WATER_TINT : last.color;
}
