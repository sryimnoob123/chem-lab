/**
 * 拖放判定（asset-pipeline 独占 `lib/scene/**`）
 *
 * 纯函数：不读 DOM、不发请求、不改入参。化学口径全部来自
 * `lib/chem/phenomena.ts` 的显式现象表——命中就照表出结果，
 * 未命中给温和提示，绝不现场编反应。
 */

import { lookup, type LookupHit } from "@/lib/chem/phenomena";
import { getSubstance } from "@/lib/chem/substances";
import { equationFor } from "./equations";
import type {
  SceneColorChange,
  SceneFx,
  SceneGas,
  SceneOutcome,
  ScenePhenomena,
  ScenePrecipitate,
  SceneReagent,
  SceneVessel,
} from "./types";

/** 未命中时给学生看的一句话（Lead 口径）。 */
export const MISS_CAPTION = "这两者在本课程范围内没有明显现象，注意观察。";

const BURETTE_CAPTION = "滴定管只装标准溶液，不能直接投加试剂——请把试剂拖到锥形瓶、烧杯或试管上。";

/** 现象表里 colorChange 用的是中文色名；这里翻成 CSS 色供液面过渡。 */
const COLOR_HEX: Readonly<Record<string, string>> = {
  无色: "#EAF2F8",
  近无色: "#EAF2F8",
  白: "#FFFFFF",
  白色: "#FFFFFF",
  黄: "#FFF59D",
  黄色: "#FFF59D",
  黄棕: "#C8A200",
  棕黄: "#C8A200",
  橙: "#FB8C00",
  橙色: "#FB8C00",
  红: "#C62828",
  血红: "#8B0000",
  粉红: "#F48FB1",
  浅蓝: "#81D4FA",
  蓝: "#1E88E5",
  深蓝: "#1E88E5",
  紫: "#6A1B9A",
  紫红: "#6A1B9A",
  黄绿: "#C5E1A5",
  黄绿色: "#C5E1A5",
};

function toHex(colorName: string, fallback: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorName)) return colorName;
  return COLOR_HEX[colorName.trim()] ?? fallback;
}

function buildPhenomena(hit: LookupHit): ScenePhenomena {
  const out: ScenePhenomena = {};

  if (hit.precipitate) {
    const s = getSubstance(hit.precipitate.substance);
    const precipitate: ScenePrecipitate = {
      color: hit.precipitate.color,
      formula: s?.formula ?? hit.precipitate.substance,
      label: `${s?.nameZh ?? hit.precipitate.substance}${hit.precipitate.appearance ? `（${hit.precipitate.appearance}）` : ""}${hit.precipitate.dissolvesInExcess ? "，过量后溶解" : ""}`,
    };
    out.precipitate = precipitate;
  }

  if (hit.gas) {
    const s = getSubstance(hit.gas.substance);
    const gas: SceneGas = {
      formula: s?.formula ?? hit.gas.substance,
      label: `${s?.nameZh ?? hit.gas.substance}（${s?.formula ?? hit.gas.substance}）${hit.gas.bubbles ? "气泡" : "气体"}`,
    };
    out.gas = gas;
  }

  if (hit.colorChange) {
    const cc: SceneColorChange = {
      from: hit.colorChange.from,
      to: hit.colorChange.to,
      fromHex: toHex(hit.colorChange.from, "#EAF2F8"),
      toHex: toHex(hit.colorChange.to, "#EAF2F8"),
    };
    out.colorChange = cc;
  }

  if (hit.heat) out.heat = true;
  return out;
}

/** 一条现象只选一个主动画：可见气体 → 沉淀 → 气泡 → 变色 → 放热。 */
function pickFx(hit: LookupHit): SceneFx {
  if (hit.gas?.substance === "cl2") return "smoke";
  if (hit.precipitate && !hit.precipitate.dissolvesInExcess) return "precipitate";
  if (hit.gas?.bubbles) return "bubbles";
  if (hit.colorChange) return "color";
  if (hit.heat) return "heat";
  return "none";
}

function fallbackCaption(hit: LookupHit): string {
  const formulas = hit.reagents.map((id) => getSubstance(id)?.formula ?? id).join(" + ");
  return `${formulas} → ${hit.note}`;
}

/**
 * 判定一次拖放。
 *
 * @param vessel    目标器皿（滴定管会被拒绝投加）
 * @param reagent   拖进来的试剂（来自试剂架）
 * @param alreadyIn 器皿里已有的物质 id（第一次拖拽时通常就是种子溶液）
 */
export function resolveDrop(
  vessel: SceneVessel,
  reagent: SceneReagent,
  alreadyIn: readonly string[] = [],
): SceneOutcome {
  if (vessel.kind === "burette") {
    return { ok: false, phenomena: {}, caption: BURETTE_CAPTION, fx: "none", hint: "burette-not-target" };
  }

  const contents = [...new Set([...alreadyIn, reagent.id].filter((id) => id.trim().length > 0))];
  const result = lookup(contents);

  if (!result.matched) {
    return {
      ok: false,
      phenomena: {},
      caption: MISS_CAPTION,
      fx: "none",
      hint: result.hint,
    };
  }

  const caption = equationFor(result.id) ?? fallbackCaption(result);
  return {
    ok: true,
    phenomena: buildPhenomena(result),
    caption,
    fx: pickFx(result),
    matchedId: result.id,
    note: result.note,
  };
}
