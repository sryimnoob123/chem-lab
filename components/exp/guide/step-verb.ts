/**
 * components/exp/guide/step-verb.ts —— "现在该___了"里的动词。
 *
 * 为什么不能直接用 ACTION_VERB[suggested.type]：
 * suggested 是"当前最该点的那一个动作"，它的 type 未必代表整步。
 * exp01 第 1 步「仪器认领、洗涤与干燥」的建议动作是"观察"，于是显示成
 * "现在该观察了"；exp03 第 1 步「配母液与安全操作」、第 6 步「数据处理与电极保养」
 * 都显示成"现在该装配了"（红队 2026-10-21 报）。
 *
 * 所以先按步骤标题派生，标题推不出来再退回动作类型。
 */

/** 标题关键词 → 动词。顺序即优先级（一句标题里可能同时出现"配"和"稀释"）。 */
const TITLE_VERBS: readonly (readonly [RegExp, string])[] = [
  [/检漏/, "检漏"],
  [/认领|核对/, "认领"],
  [/称量|称取|称重|称\s|称[A-Za-z0-9]/, "称量"],
  [/润洗|洗涤|清洗/, "洗涤"],
  [/干燥|晾干|烘干/, "干燥"],
  [/母液|配制|配约|配成|稀释/, "配制"],
  [/标定/, "标定"],
  [/移取|移液/, "移取"],
  [/装液|排气|调零/, "装液"],
  [/滴定/, "滴定"],
  [/终点/, "判断终点"],
  [/数据处理|计算|记录|平行测定/, "处理数据"],
  [/保养|维护/, "保养"],
  [/组装|装配/, "装配"],
  [/观察/, "观察"],
];

/** 从步骤标题里派生一个短动词；推不出来返回 null。 */
export function verbFromTitle(title: string): string | null {
  const text = title.trim();
  if (!text) return null;
  for (const [pattern, verb] of TITLE_VERBS) {
    if (pattern.test(text)) return verb;
  }
  return null;
}

/**
 * 进度行动词：标题优先，回退到动作类型名。
 * @param title 当前步骤标题
 * @param fallbackType 动作类型（suggested.type），可能为 undefined
 * @param typeVerbs 动作类型 → 动词表（ACTION_VERB）
 */
export function stepVerb(
  title: string,
  fallbackType: string | undefined,
  typeVerbs: Readonly<Record<string, string>>,
): string {
  const fromTitle = verbFromTitle(title);
  if (fromTitle) return fromTitle;
  if (fallbackType && typeVerbs[fallbackType]) return typeVerbs[fallbackType];
  return "操作";
}
