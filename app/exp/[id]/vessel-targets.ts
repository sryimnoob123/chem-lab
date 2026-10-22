/**
 * vessel-targets.ts —— 「这一步的试剂该倒进哪一台器皿」（纯函数，无 React）。
 *
 * 为什么需要它：拖拽以前只有一个大热区，倒进哪台器皿都算同一件事，
 * 学生把 Na₂CO₃ 倒进容量瓶也不会被提醒（用户 2026-10-22：
 * 「有一个大的方块，效果很差」「倒进去了，也不知道倒进哪里了」）。
 *
 * 判定只用定义里已有的文案，不新增化学规则：
 * 1. 本步的推荐动作（第一个没做过、前置已满足的 correct）文案里点名了哪台器皿（烧杯 / 容量瓶 /
 *    锥形瓶 / 称量瓶），就以那台为准；
 * 2. 文案没点名时按动作原语兜底：滴定类 → 锥形瓶；溶解 → 烧杯；定容 → 容量瓶；
 * 3. 仍拿不准就返回 null —— 宁可不判定（任何可倒器皿都接受），也不要瞎判把学生挡在门外。
 *
 * 判定「宽松优先」是刻意的：演示现场卡住比「倒错没提醒」更糟。
 */

import type { ActionType, StepDefinition } from "@/lib/engine.types";

/** 能「把试剂倒进去」的动作原语，与 guide/drop-resolve 的 POURABLE_TYPES 同源口径。 */
const POUR_TYPES: ReadonlySet<ActionType> = new Set<ActionType>([
  "addDrops",
  "dissolve",
  "dilute",
  "transfer",
  "titrate",
]);

/** 器皿 label 里的量程/空格不影响匹配：只留汉字。 */
function hanOnly(text: string): string {
  return text.replace(/[^\u4e00-\u9fa5]/g, "");
}

/** 动作原语 → 优先器皿（按顺序找第一个在台面上的）。 */
const TYPE_PREFERENCE: Partial<Record<ActionType, readonly string[]>> = {
  titrate: ["flask", "beaker"],
  addDrops: ["flask", "beaker"],
  dissolve: ["beaker", "flask"],
  dilute: ["volumetric", "beaker"],
  transfer: ["volumetric", "beaker", "flask"],
};

export type VesselLike = { id: string; label: string };

/** 本步的推荐动作：第一个没做过、前置已满足的 correct（与 workbench 的 suggested 同序）。 */
export function recommendedChoice(step: StepDefinition, performed: ReadonlySet<string>) {
  const usable = step.choices.filter(
    (choice) =>
      choice.role === "correct" &&
      !performed.has(choice.choiceId) &&
      !(choice.requires ?? []).some((id) => !performed.has(id)),
  );
  return usable[0] ?? step.choices.find((choice) => choice.role === "correct") ?? step.choices[0];
}

/**
 * 本步目标器皿 id；null = 本步不限定（或拿不准，按宽松处理）。
 * `vessels` 传台面上实际摆出来的那几台（被裁剪掉的器皿不该被返回）。
 */
export function expectedVesselId(
  step: StepDefinition,
  performed: ReadonlySet<string>,
  vessels: readonly VesselLike[],
): string | null {
  const choice = recommendedChoice(step, performed);
  if (!choice) return null;
  if (!POUR_TYPES.has(choice.type)) return null;

  const label = hanOnly(choice.label);
  // ① 溶解只可能在烧杯里做（容量瓶不能搅拌/加热），文案即使后面又提到容量瓶，
  //    这一步手上要动的也是烧杯 —— 先于「点名」判定，避免判到容量瓶上去。
  if (choice.type === "dissolve" && vessels.some((vessel) => vessel.id === "beaker")) {
    return "beaker";
  }
  // ② 文案点名：文案里出现哪台器皿的名字，就是它（最长匹配优先，避免「量筒」吃掉「容量瓶」）
  const named = [...vessels]
    .filter((vessel) => {
      const word = hanOnly(vessel.label);
      return word.length >= 2 && label.includes(word);
    })
    .sort((a, b) => hanOnly(b.label).length - hanOnly(a.label).length)[0];
  if (named) return named.id;

  // ② 按动作原语兜底
  for (const id of TYPE_PREFERENCE[choice.type] ?? []) {
    if (vessels.some((vessel) => vessel.id === id)) return id;
  }
  return null;
}

/** 落错器皿时那句后果说明：一句话说清「哪里错 + 会怎样」，不留空洞的"操作错误"。 */
export function wrongVesselLine(
  droppedLabel: string,
  expectedLabel: string,
  reagentName: string,
): { line: string; lines: readonly [string, string, string] } {
  return {
    line: `这瓶要倒进${expectedLabel}，不是${droppedLabel}`,
    lines: [
      `倒错器皿：${reagentName}进了${droppedLabel}`,
      `${droppedLabel}不是这一步该用的器皿，后面体积/浓度会对不上`,
      `把${reagentName}倒进${expectedLabel}，重新拖一次`,
    ],
  };
}
