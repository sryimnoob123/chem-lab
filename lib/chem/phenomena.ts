/**
 * 现象查表（chem-model 独占文件）
 *
 * 设计：不写化学推理引擎，只维护一张**显式数据表**（数据在 ./phenomena-table.ts）——
 * 每条现象由"试剂组合 + 条件"精确命中，查不到就返回 `{ unknown: true }` 并给提示。
 * 这样每种颜色/沉淀/气体都能被单测钉住，也符合"现象必须对"的交付要求。
 */

import { resolveSubstanceId, requireSubstance } from "./substances";
import {
  PHENOMENA,
  type LookupHit,
  type LookupMiss,
  type LookupResult,
  type Medium,
  type ObserveMethod,
  type PhenomenaCondition,
  type Temperature,
} from "./phenomena-table";

export type {
  ColorChangeSpec,
  GasSpec,
  LookupHit,
  LookupMiss,
  LookupResult,
  Medium,
  ObserveMethod,
  PhenomenaCondition,
  PhenomenaEntry,
  Phenomenon,
  PrecipitateSpec,
  Temperature,
} from "./phenomena-table";
export { PHENOMENA } from "./phenomena-table";

const CONDITION_KEYS = ["temperature", "medium", "excessOf", "method"] as const;

function normalizeCondition(condition: PhenomenaCondition): PhenomenaCondition {
  const out: { temperature?: Temperature; medium?: Medium; excessOf?: string; method?: ObserveMethod } = {};
  if (condition.temperature) out.temperature = condition.temperature;
  if (condition.medium) out.medium = condition.medium;
  if (condition.method) out.method = condition.method;
  if (condition.excessOf) {
    out.excessOf = resolveSubstanceId(condition.excessOf) ?? condition.excessOf;
  }
  return out;
}

function conditionMatches(required: PhenomenaCondition | undefined, given: PhenomenaCondition): boolean {
  if (!required) return true;
  return CONDITION_KEYS.every((k) => required[k] === undefined || required[k] === given[k]);
}

function specificity(condition: PhenomenaCondition | undefined): number {
  if (!condition) return 0;
  return CONDITION_KEYS.filter((k) => condition[k] !== undefined).length;
}

function sameReagentSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function suggestFor(resolved: readonly string[]): readonly string[] {
  return PHENOMENA
    .map((entry) => ({ entry, overlap: entry.reagents.filter((r) => resolved.includes(r)).length }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map((x) => x.entry.id);
}

const nameOf = (id: string): string => {
  const s = requireSubstance(id);
  return `${s.nameZh}(${s.id})`;
};

/**
 * 现象查表：`reagents` 可写物质 id / 化学式 / 中文名（大小写、下标、空格不敏感），
 * 顺序无关。`condition` 用于消歧（酸/碱介质、加热、某试剂过量、焰色观察方式）。
 * 查不到返回 `{ unknown: true, hint, suggestions }`，绝不瞎编。
 */
export function lookup(reagents: readonly string[], condition: PhenomenaCondition = {}): LookupResult {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const raw of reagents) {
    const id = resolveSubstanceId(raw);
    if (id) {
      if (!resolved.includes(id)) resolved.push(id);
    } else {
      unresolved.push(raw);
    }
  }
  if (resolved.length === 0) {
    return {
      matched: false,
      unknown: true,
      hint: `未识别任何试剂：${unresolved.join("、") || "（空输入）"}。请用物质 id（如 agno3）或化学式（AgNO3）。`,
      suggestions: [],
    };
  }
  if (unresolved.length > 0) {
    return {
      matched: false,
      unknown: true,
      hint: `未收录的物质：${unresolved.join("、")}。请核对 id/化学式，或先在 lib/chem/substances.ts 补录。`,
      suggestions: suggestFor(resolved),
    };
  }

  const given = normalizeCondition(condition);
  const candidates = PHENOMENA
    .filter((e) => sameReagentSet(e.reagents, resolved) && conditionMatches(e.condition, given))
    .sort((a, b) => specificity(b.condition) - specificity(a.condition));

  const hit = candidates[0];
  if (!hit) {
    const names = resolved.map(nameOf).join(" + ");
    const sug = suggestFor(resolved);
    const condText = CONDITION_KEYS.some((k) => given[k] !== undefined) ? "（给定条件下）" : "";
    return {
      matched: false,
      unknown: true,
      hint: `未收录 ${names} 的组合现象${condText}。已收录的相关条目：${sug.length > 0 ? sug.join("、") : "无"}。` +
        "可尝试补充条件（medium: acidic/basic、temperature: heated、excessOf、method: flameTest）。",
      suggestions: sug,
    };
  }

  return { ...hit, matched: true, unknown: false };
}

/** 某物质参与的全部已收录现象（UI 试剂卡"可能的现象"提示用）。 */
export function phenomenaFor(substanceId: string): readonly import("./phenomena-table").PhenomenaEntry[] {
  const id = resolveSubstanceId(substanceId) ?? substanceId.toLowerCase();
  return PHENOMENA.filter((e) => e.reagents.includes(id));
}

/** 类型守卫：查表命中时收窄为 PhenomenaEntry。 */
export function isHit(result: LookupResult): result is LookupHit {
  return result.matched;
}

/** 类型守卫：未命中时收窄为 LookupMiss。 */
export function isUnknown(result: LookupResult): result is LookupMiss {
  return result.unknown;
}
