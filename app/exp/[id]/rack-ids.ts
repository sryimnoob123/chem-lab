/**
 * app/exp/[id]/rack-ids.ts —— 每个实验「试剂架上摆哪几瓶」（纯数据，无 React）。
 *
 * 从 scene-stage.tsx 抽出来，好让 workbench 也能算"下一步该用哪瓶"（data-next 高亮），
 * 场景与看板因此指向同一个动作。加实验时只改这里。
 */

type RackIds = readonly string[];

/** exp09 那套四瓶（也是未登记实验的默认）。 */
export const DEFAULT_RACK_IDS: RackIds = ["naoh", "hcl", "phenolphthalein", "methylOrange"];
const RACK_IDS = DEFAULT_RACK_IDS;
// exp01 七步用到的全部试剂：认领/洗涤（蒸馏水）、溶解定容（蒸馏水）、
// 第 7 步稀释浓硫酸（h2so4-conc，原本不在架上 → 那一步无法从场景复现）
const EXP01_RACK_IDS: RackIds = ["na2co3-solid", "water", "h2so4-conc"];
const EXP02_RACK_IDS: RackIds = ["na2co3-solid", "water"];
const EXP03_RACK_IDS: RackIds = ["water"];
const EXP04_RACK_IDS: RackIds = ["na2co3-solid", "water"];
const EXP08_RACK_IDS: RackIds = ["na2co3-solid"];

const BY_EXP: Readonly<Record<string, RackIds>> = {
  exp01: EXP01_RACK_IDS,
  exp02: EXP02_RACK_IDS,
  exp03: EXP03_RACK_IDS,
  exp04: EXP04_RACK_IDS,
  exp08: EXP08_RACK_IDS,
};

/** 该实验的试剂架顺序（未登记的实验用 exp09 那套四瓶）。 */
export function rackIdsFor(expId: string | undefined): RackIds {
  if (!expId) return RACK_IDS;
  return BY_EXP[expId] ?? RACK_IDS;
}
