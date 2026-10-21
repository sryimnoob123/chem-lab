/**
 * 提示阶梯（Hint Ladder）状态机 — 契约 docs/接口契约.md §6
 *
 * 规则（阈值为具名常量，依据见各常量注释）：
 * - 同一步同一能力点第 1 次错 → H0（只给后果）
 * - 第 2 次 → H1（指向性问题）
 * - 第 3 次 → H2（概念提示）
 * - 第 4 次及以后 → H3（动作演示）
 * - 同一能力点连续 3 次错、且跨至少 2 个步骤 → H4（元认知提示）
 *
 * 设计约束：
 * - 纯函数：无 IO、无 React、无随机、不读时钟；同输入必得同输出。
 * - 能力点隔离：其他 competency 的错误既不推进本能力点的 H0→H3，
 *   也会打断"连续同类错误"计数（H4 的语义是同一类错误反复出现）。
 * - 调用方在某能力点被正确通过后，应调用 clearCompetencyHistory 清掉该点的错误史，
 *   否则"连续"会被上一段已完成的学习过程污染。
 */

import type { CompetencyCode } from "./competency";

/** 提示级别，契约 §6 固定为 0~4。 */
export type HintLevel = 0 | 1 | 2 | 3 | 4;

/** 全部级别，供 UI 遍历/校验使用。 */
export const HINT_LEVELS: readonly HintLevel[] = [0, 1, 2, 3, 4];

/** H0→H3 的最高级别（同一步内不自动跳到 H4）。契约 §6。 */
export const HINT_MAX_LEVEL_BEFORE_META: HintLevel = 3;

/** 元认知提示级别。契约 §6：连续 3 次同类错误给 H4。 */
export const METACOGNITIVE_LEVEL: HintLevel = 4;

/**
 * 触发元认知提示所需的连续同类错误次数。
 * 依据：契约 §6"连续 3 次同类错误（跨步同 competency）→ H4"。
 */
export const METACOGNITIVE_STREAK = 3;

/**
 * 元认知提示要求错误至少跨过的不同步骤数。
 * 依据：契约 §6 括号中的"跨步"；同一步内反复试错只走到 H3（动作演示），
 * 跨步骤仍犯同类错误才升级为"学习方法"层面的元认知干预。
 */
export const METACOGNITIVE_MIN_DISTINCT_STEPS = 2;

/**
 * 从哪一级提示开始计"独立完成度"扣分。
 * 依据：契约 §6 / §7，用到 H2 及以上每次 independentDeduct += 1。
 */
export const INDEPENDENT_DEDUCT_MIN_LEVEL: HintLevel = 2;

/** 一次错误在提示历史里的最小记录（按发生顺序排列）。 */
export interface HintErrorRecord {
  competency: CompetencyCode;
  /** 0-based，与 ExperimentState.stepIndex 对齐。 */
  stepIndex: number;
}

/** 一次提示被实际展示给学生的记录，供计分聚合使用。 */
export interface HintUsage {
  competency: CompetencyCode;
  stepIndex: number;
  level: HintLevel;
}

export interface HintRequest {
  /** 实验 id，如 "exp09"，用于拼文案键。 */
  expId: string;
  competency: CompetencyCode;
  /** 当前出错步骤，0-based。 */
  stepIndex: number;
  /** 本次错误之前的历史（只含错误，按发生顺序）。 */
  history: readonly HintErrorRecord[];
}

export interface HintDecision {
  level: HintLevel;
  /** 文案键，形如 `hint.exp09.step3.H1`；H4 为 `hint.exp09.meta.H4`。 */
  textKey: string;
  competency: CompetencyCode;
  stepIndex: number;
  /** 本步同一能力点第几次错（含本次，从 1 开始）。 */
  stepAttempt: number;
  /** 含本次的连续同类错误次数（不同 competency 会打断）。 */
  competencyStreak: number;
  /** 本次是否由"连续同类错误"触发 H4。 */
  metacognitive: boolean;
  /** 本次是否计入 independentDeduct（level >= H2）。 */
  shouldDeduct: boolean;
}

/** 本步第 n 次错（n 从 1 起）对应的 H0~H3，n>4 封顶 H3。 */
export function levelForStepAttempt(stepAttempt: number): HintLevel {
  if (!Number.isFinite(stepAttempt) || stepAttempt <= 1) return 0;
  const level = Math.min(Math.floor(stepAttempt) - 1, HINT_MAX_LEVEL_BEFORE_META);
  return level as HintLevel;
}

/**
 * 文案键约定（与 strings.ts 解耦，键名稳定即可）：
 * - H0~H3：`hint.<expId>.step<1-based>.H<level>`，例 `hint.exp09.step3.H1`
 * - H4：`hint.<expId>.meta.H4`（元认知提示跨步骤复用，不绑定单步）
 */
export function hintTextKey(expId: string, stepIndex: number, level: HintLevel): string {
  if (level === METACOGNITIVE_LEVEL) return `hint.${expId}.meta.H4`;
  return `hint.${expId}.step${stepIndex + 1}.H${level}`;
}

/** 该级别是否计入"独立完成度"扣分（H2 及以上）。 */
export function isDeductibleHint(level: HintLevel): boolean {
  return level >= INDEPENDENT_DEDUCT_MIN_LEVEL;
}

/** 根据错误历史给出本次提示决策；不修改历史。 */
export function decideHint(request: HintRequest): HintDecision {
  const { expId, competency, stepIndex, history } = request;

  const stepAttempt =
    1 +
    history.filter((record) => record.competency === competency && record.stepIndex === stepIndex)
      .length;

  let streak = 0;
  const distinctSteps = new Set<number>([stepIndex]);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const record = history[i];
    if (record === undefined || record.competency !== competency) break;
    streak += 1;
    distinctSteps.add(record.stepIndex);
  }
  const competencyStreak = streak + 1;
  const metacognitive =
    competencyStreak >= METACOGNITIVE_STREAK &&
    distinctSteps.size >= METACOGNITIVE_MIN_DISTINCT_STEPS;

  const level: HintLevel = metacognitive ? METACOGNITIVE_LEVEL : levelForStepAttempt(stepAttempt);

  return {
    level,
    textKey: hintTextKey(expId, stepIndex, level),
    competency,
    stepIndex,
    stepAttempt,
    competencyStreak,
    metacognitive,
    shouldDeduct: isDeductibleHint(level),
  };
}

/** 追加一条错误记录，返回新数组（不修改入参）。 */
export function appendError(
  history: readonly HintErrorRecord[],
  record: HintErrorRecord,
): HintErrorRecord[] {
  return [...history, { competency: record.competency, stepIndex: record.stepIndex }];
}

/** 状态机便捷入口：决策本次提示，并把本次错误写入历史。 */
export function recordErrorAndDecide(request: HintRequest): {
  history: HintErrorRecord[];
  decision: HintDecision;
} {
  const decision = decideHint(request);
  const history = appendError(request.history, {
    competency: request.competency,
    stepIndex: request.stepIndex,
  });
  return { history, decision };
}

/** 某能力点被正确通过后，清掉它的错误史（保留其他能力点）。 */
export function clearCompetencyHistory(
  history: readonly HintErrorRecord[],
  competency: CompetencyCode,
): HintErrorRecord[] {
  return history.filter((record) => record.competency !== competency);
}

/** 把决策转成计分层认识的 HintUsage。 */
export function toHintUsage(decision: HintDecision): HintUsage {
  return {
    competency: decision.competency,
    stepIndex: decision.stepIndex,
    level: decision.level,
  };
}
