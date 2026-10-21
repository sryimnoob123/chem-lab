/**
 * components/exp/guide/drop-resolve.ts —— 拖拽三段式里的"这一投算不算"（纯函数，无 React）。
 *
 * 用户口径（2026-10-21）：
 * - 拖动中 → 松手吸附 → 成功就**先把倒入动画播完**再推进步骤；失败就回弹 + 一句为什么，原地重试。
 * - 所以"算不算成功"必须在 drop 当帧同步判定出来，动画才知道往哪条分支走。
 *
 * 判定只看定义里的既有数据，不新增化学规则：
 * 1. 本步 choice 的 type 是"能倒进去"的原语（addDrops / dissolve / dilute / transfer / titrate）；
 * 2. 该 choice 的文案或 params.indicator 指向这瓶试剂；
 * 3. 有正确动作 → 通过；前置动作没做完 / 只有陷阱动作 / 本步不靠加试剂 → 拒收并给一句为什么。
 */

import type { ActionType, ChoiceDefinition, StepDefinition } from "@/lib/engine.types";
import { getSceneReagent } from "@/lib/scene/reagents";
import { ACTION_VERB, clip, firstClause } from "./copy";

/** 吸附落位（"我接住了"）：160ms，见 motion.css 的 --snap。 */
export const SNAP_MS = 160;
/** 倒入动画总时长：与 components/exp/scene/pour.tsx 的 TOTAL_MS 对齐。 */
export const POUR_MS = 700;
/** 拒收回弹 + 抖动：240ms，见 motion.css 的 --shake。 */
export const REJECT_MS = 240;

/** 物理上"把试剂倒进器皿"的动作原语；其它原语（读数/洗涤/称量）拖试剂进来只会被拒收。 */
const POURABLE_TYPES: ReadonlySet<ActionType> = new Set<ActionType>([
  "addDrops",
  "dissolve",
  "dilute",
  "transfer",
  "titrate",
]);

export type DropVerdict =
  | { kind: "accept"; choiceId: string; label: string }
  | {
      kind: "reject";
      /** 结果条/一处短提示那一行（≤24 字） */
      line: string;
      /** E1 拒收三行：①错在哪 ②为什么 ③怎么改（RejectHint 的固定结构） */
      lines: readonly [string, string, string];
      /** 拒收时的动作名，用于提示"这一步该做什么" */
      hint?: string;
    };

/** 拒收分支的类型别名（scene-stage / workbench / RejectHint 共用）。 */
export type DropReject = Extract<DropVerdict, { kind: "reject" }>;

/** 试剂 → 文案里可能出现的别名（定义文件写的是中文名或化学式，这里两者都试）。 */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  naoh: ["氢氧化钠"],
  hcl: ["盐酸"],
  phenolphthalein: ["酚酞"],
  methylorange: ["甲基橙"],
  water: ["蒸馏水"],
  "na2co3-solid": ["碳酸钠", "试样", "基准物"],
  "h2so4-conc": ["浓硫酸", "硫酸"],
  agno3: ["硝酸银"],
  bacl2: ["氯化钡"],
  cuso4: ["硫酸铜"],
  ki: ["碘化钾"],
  starch: ["淀粉"],
  na2co3: ["碳酸钠"],
  h2so4: ["硫酸"],
  nh3: ["氨水"],
  fecl3: ["氯化铁"],
  kscn: ["硫氰化钾"],
};

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/** 归一化：小写、下标转数字、去空格与化学式里的间隔点。 */
function norm(text: string): string {
  let output = "";
  for (const char of text.toLowerCase()) {
    const index = SUBSCRIPTS.indexOf(char);
    output += index >= 0 ? String(index) : char;
  }
  return output.replace(/[\s·・]/g, "");
}

/** 一瓶试剂在文案里的等价写法（名称 / 化学式 / 别名），过滤掉单字避免误匹配。 */
export function reagentTokens(reagentId: string): string[] {
  const tokens = new Set<string>();
  const reagent = getSceneReagent(reagentId);
  if (reagent) {
    tokens.add(norm(reagent.name));
    tokens.add(norm(reagent.formula));
  }
  for (const alias of ALIASES[reagentId] ?? []) tokens.add(norm(alias));
  return [...tokens].filter((token) => token.length >= 2);
}

function matchScore(
  choice: ChoiceDefinition,
  tokens: readonly string[],
  reagentId: string,
): number {
  if (!POURABLE_TYPES.has(choice.type)) return 0;
  if (choice.params?.indicator === reagentId) return 3;
  if (choice.params?.reagent === reagentId) return 3;
  const label = norm(choice.label);
  let best = 0;
  for (const token of tokens) {
    if (label.includes(token)) best = Math.max(best, token.length);
  }
  return best;
}

function prerequisitesMissing(
  choice: ChoiceDefinition,
  performed: ReadonlySet<string>,
): string[] {
  return (choice.requires ?? []).filter((id) => !performed.has(id));
}

function labelOf(step: StepDefinition, choiceId: string): string {
  const found = step.choices.find((choice) => choice.choiceId === choiceId);
  return found ? clip(firstClause(found.label), 10) : "";
}

function reagentName(reagentId: string): string {
  return getSceneReagent(reagentId)?.name ?? "这瓶试剂";
}

/**
 * 判定"把某瓶试剂投进锥形瓶"在本步是否成立。
 * 纯同步函数：拖拽松手当帧调用一次，结果决定播吸附+倒入还是回弹+抖动。
 */
export function resolveDrop(
  step: StepDefinition,
  reagentId: string,
  performed: ReadonlySet<string>,
): DropVerdict {
  const tokens = reagentTokens(reagentId);
  const scored = step.choices
    .map((choice) => ({ choice, score: matchScore(choice, tokens, reagentId) }))
    .filter((item) => item.score > 0);

  const correct = scored
    .filter((item) => item.choice.role === "correct")
    .sort((a, b) => b.score - a.score || a.choice.choiceId.localeCompare(b.choice.choiceId))[0];
  const trap = scored
    .filter((item) => item.choice.role === "trap")
    .sort((a, b) => b.score - a.score || a.choice.choiceId.localeCompare(b.choice.choiceId))[0];

  if (correct) {
    const missing = prerequisitesMissing(correct.choice, performed);
    if (missing.length === 0) {
      return { kind: "accept", choiceId: correct.choice.choiceId, label: correct.choice.label };
    }
    const missingLabel = labelOf(step, missing[0]) || "前置动作";
    return {
      kind: "reject",
      line: `先做「${missingLabel}」，再放${reagentName(reagentId)}`,
      lines: [
        `前置动作还没做完`,
        `本步要求先「${missingLabel}」，顺序不能跳`,
        `先做「${missingLabel}」，再把${reagentName(reagentId)}放进锥形瓶`,
      ],
    };
  }

  if (trap) {
    const feedback = trap.choice.hazard?.feedback;
    const why = feedback?.why ?? feedback?.title;
    const fix = feedback?.correct;
    /** 结果条第一行点明"错在哪"：优先 hazard 的 title 分句，其次退到 reagent 名。 */
    const what = feedback?.title ? clip(firstClause(feedback.title), 14) : "";
    return {
      kind: "reject",
      line: what ? `${what} · 换个做法` : `这一步不该加${reagentName(reagentId)}，换个做法`,
      lines: [
        `本步不该这样加${reagentName(reagentId)}`,
        why ? clip(firstClause(why), 40) : "这个做法有后果，换个做法",
        fix ? clip(firstClause(fix), 40) : "按「建议动作」做，别自己加量",
      ],
    };
  }

  const suggested =
    step.choices.find(
      (choice) =>
        choice.role === "correct" &&
        prerequisitesMissing(choice, performed).length === 0 &&
        !performed.has(choice.choiceId),
    ) ?? step.choices.find((choice) => choice.role === "correct");

  if (suggested && POURABLE_TYPES.has(suggested.type)) {
    const suggestedName = clip(firstClause(suggested.label), 16);
    return {
      kind: "reject",
      line: `本步该加：${suggestedName}`,
      lines: [
        `加错试剂了`,
        `本步要加的是「${suggestedName}」`,
        `把「${suggestedName}」拖进锥形瓶`,
      ],
    };
  }

  const verb = suggested ? ACTION_VERB[suggested.type] : "当前动作";
  const suggestedName = suggested ? clip(firstClause(suggested.label), 16) : "";
  return {
    kind: "reject",
    line: `这一步不加试剂，先${verb}`,
    lines: [
      `本步不加试剂`,
      `这一步要做的是「${verb}」，不是投试剂`,
      suggestedName ? `按「建议动作」做：${suggestedName}` : "按「建议动作」那一步做",
    ],
    hint: suggestedName || undefined,
  };
}

/**
 * 本步"下一步该用哪瓶试剂"——给试剂架 data-next 微亮、锥形瓶脉冲指示用。
 *
 * 和 resolveDrop 用同一套匹配（可倒类型 + 文案/化学式/别名 + 前置满足 + 本步没做过），
 * 只返回试剂 id，不返回判定：场景指引必须比"投错"更保守，拿不准就不点亮（返回 null）。
 */
export function nextReagentId(
  step: StepDefinition,
  performed: ReadonlySet<string>,
  rackIds: readonly string[],
): string | null {
  let best: { id: string; score: number } | null = null;
  for (const reagentId of rackIds) {
    const tokens = reagentTokens(reagentId);
    for (const choice of step.choices) {
      if (choice.role !== "correct") continue;
      if (performed.has(choice.choiceId)) continue;
      if (prerequisitesMissing(choice, performed).length > 0) continue;
      const score = matchScore(choice, tokens, reagentId);
      if (score > 0 && (!best || score > best.score)) best = { id: reagentId, score };
    }
  }
  return best?.id ?? null;
}

/** 倒入时给底部结果条的一句短说明（沿用原 DROP_COPY，避免两套文案）。 */export const REAGENT_DROP_COPY: Readonly<Record<string, string>> = {
  naoh: "NaOH 逐滴加入锥形瓶：局部出现浅粉红又褪去，说明还在终点前；继续半滴、摇匀。",
  hcl: "锥形瓶里已经是 HCl。再补酸只会让终点更晚，体积比会偏大。",
  phenolphthalein: "酚酞在酸性溶液中无色；等 NaOH 滴到终点，才会出现 30 s 不褪的浅粉红。",
  methylOrange: "甲基橙在酸性溶液中呈橙红；它和酚酞不能同时拿来判这个终点。",
  methylorange: "甲基橙在酸性溶液中呈橙红；它和酚酞不能同时拿来判这个终点。",
  "na2co3-solid": "Na₂CO₃ 试样：用药匙取用，称量纸折角盛放，不能直接倒在秤盘上。",
  water: "蒸馏水：沿玻璃棒或杯壁加入，别直接冲起沉淀；除杂阶段按 8 mL/g 粗盐取水。",
};

export function pourCopy(reagentId: string): string | undefined {
  return REAGENT_DROP_COPY[reagentId];
}
