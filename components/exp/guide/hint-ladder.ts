/**
 * components/exp/guide/hint-ladder.ts —— 提示三级阶梯的唯一口径（纯常量 + 纯函数）。
 *
 * 用户 2026-10-22 口径：
 * - L1 方向（往哪想，不给具体操作）→ L2 具体（点哪个/做什么）→ L3 高亮（直接在目标元素上描边+箭头）；
 * - 每步最多 3 级，第 4 次不再给（灯泡置灰 + "本步提示已用完"）；
 * - 扣分递增：L1 −1 / L2 −3 / L3 −5。
 *
 * 文案来源：definition 的 hints.h0（L1）/ h1（L2）/ h2（L3）。
 * 结算侧（lib/pedagogy/scoring.ts、lib/persist/score.ts、报告页）请复用同一张
 * `HINT_DEDUCT` 表，不要另写一套阈值。
 */

export type HintTier = 1 | 2 | 3;

export const MAX_HINTS_PER_STEP = 3;

export const HINT_DEDUCT: Readonly<Record<HintTier, number>> = { 1: 1, 2: 3, 3: 5 };

/** 提示阶梯的短名（给读屏/提示条用）。 */
export const HINT_TIER_LABEL: Readonly<Record<HintTier, string>> = {
  1: "L1 · 往哪想",
  2: "L2 · 具体做什么",
  3: "L3 · 高亮目标",
};

/** 本步第 used 次取提示 → 档次；返回 null 表示本步已经用完（第 4 次不再给）。 */
export function hintTierFor(used: number): HintTier | null {
  if (!Number.isFinite(used) || used < 0) return null;
  if (used >= MAX_HINTS_PER_STEP) return null;
  return (Math.floor(used) + 1) as HintTier;
}

/** 某一档提示扣多少分（越界/未知一律 0，避免出现负数或 NaN）。 */
export function hintDeductFor(level: number): number {
  if (level === 1 || level === 2 || level === 3) return HINT_DEDUCT[level];
  return 0;
}

/** definition 的 hints 下标：L1→h0、L2→h1、L3→h2（与 engine 的 hint ladder 同源）。 */
export function hintIndexFor(level: number): 0 | 1 | 2 {
  if (level <= 1) return 0;
  if (level === 2) return 1;
  return 2;
}

export function isHintExhausted(used: number): boolean {
  return used >= MAX_HINTS_PER_STEP;
}
