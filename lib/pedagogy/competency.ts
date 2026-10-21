/**
 * 能力点账本（Competency Ledger）
 *
 * 契约 docs/接口契约.md §2 / §7：
 *   mastery(c) = clamp((correct(c) - 1.5 * wrong(c) - 3 * incidents(c)) / max(1, attempts(c)), 0, 1)
 *
 * 口径说明：
 * - attempts(c) = correct(c) + wrong(c)；事故(incidents)是独立惩罚项，不计入尝试次数。
 *   依据：契约把 incidents 单独乘 3 放在分子，若同时计入分母会重复惩罚。
 * - 0 次尝试：分子为 0、分母取 max(1, 0) = 1，mastery = 0。
 * - 一次 correct/wrong 只记一个能力点；错误动作属于哪个能力点由定义文件给出。
 */

/**
 * 能力点编码。契约 §2：K 知识 / S 技能 / A 素养，数量固定。
 * 注意：这里不 import 其他轨道的类型，避免并行开发时互相阻塞。
 */
export type CompetencyCode =
  | `K${1 | 2 | 3 | 4 | 5}`
  | `S${1 | 2 | 3 | 4 | 5}`
  | `A${1 | 2 | 3}`;

export type CompetencyCategory = "knowledge" | "skill" | "attitude";

/** 契约允许的全部能力点，雷达图默认轴。 */
export const ALL_COMPETENCIES: readonly CompetencyCode[] = [
  "K1",
  "K2",
  "K3",
  "K4",
  "K5",
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "A1",
  "A2",
  "A3",
];

/** 契约 §7 公式系数：一次错误折 1.5 次正确。 */
export const MASTERY_WRONG_WEIGHT = 1.5;

/** 契约 §7 公式系数：一次事故折 3 次正确。 */
export const MASTERY_INCIDENT_WEIGHT = 3;

/** 契约 §7 分母下限：max(1, attempts)。 */
export const MASTERY_MIN_DENOMINATOR = 1;

export const MASTERY_MIN = 0;
export const MASTERY_MAX = 1;

/** 账本事件类型；incident 与 wrong 分开，因为公式权重不同。 */
export type CompetencyOutcome = "correct" | "wrong" | "incident";

export interface CompetencyEvent {
  competency: CompetencyCode;
  outcome: CompetencyOutcome;
  /** 0-based 步骤；统计不依赖它，保留用于追溯。 */
  stepIndex?: number;
  /** 同一步内序号，便于与 timeline 对齐。 */
  seq?: number;
}

export interface CompetencyLedger {
  readonly events: readonly CompetencyEvent[];
}

export interface CompetencyTally {
  code: CompetencyCode;
  correct: number;
  wrong: number;
  incidents: number;
  /** correct + wrong；事故不计入。 */
  attempts: number;
  mastery: number;
}

export interface RadarAxis {
  code: CompetencyCode;
  category: CompetencyCategory;
  mastery: number;
  correct: number;
  wrong: number;
  incidents: number;
  attempts: number;
}

export interface RadarData {
  axes: RadarAxis[];
  /** 所有轴 mastery 的算术平均（0~1）。 */
  overall: number;
}

function clamp01(value: number): number {
  return Math.min(MASTERY_MAX, Math.max(MASTERY_MIN, value));
}

/** 计数消毒：非有限值或负数按 0 处理，保证公式不会吐 NaN。 */
function sanitizeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function createCompetencyLedger(): CompetencyLedger {
  return { events: [] };
}

/** 记一条事件，返回新账本（纯函数，不修改入参）。 */
export function recordOutcome(
  ledger: CompetencyLedger,
  event: CompetencyEvent,
): CompetencyLedger {
  return { events: [...ledger.events, event] };
}

/** 批量记账，顺序保留。 */
export function recordOutcomes(
  ledger: CompetencyLedger,
  events: readonly CompetencyEvent[],
): CompetencyLedger {
  return { events: [...ledger.events, ...events] };
}

/** 契约 §7 的 mastery 公式，参数为原始计数。 */
export function computeMastery(correct: number, wrong: number, incidents: number): number {
  const c = sanitizeCount(correct);
  const w = sanitizeCount(wrong);
  const i = sanitizeCount(incidents);
  const attempts = c + w;
  const denominator = Math.max(MASTERY_MIN_DENOMINATOR, attempts);
  return clamp01((c - MASTERY_WRONG_WEIGHT * w - MASTERY_INCIDENT_WEIGHT * i) / denominator);
}

export function competencyCategory(code: CompetencyCode): CompetencyCategory {
  if (code.startsWith("K")) return "knowledge";
  if (code.startsWith("S")) return "skill";
  return "attitude";
}

/** 单能力点计数 + mastery。 */
export function tallyCompetency(
  ledger: CompetencyLedger,
  code: CompetencyCode,
): CompetencyTally {
  let correct = 0;
  let wrong = 0;
  let incidents = 0;
  for (const event of ledger.events) {
    if (event.competency !== code) continue;
    if (event.outcome === "correct") correct += 1;
    else if (event.outcome === "wrong") wrong += 1;
    else incidents += 1;
  }
  return {
    code,
    correct,
    wrong,
    incidents,
    attempts: correct + wrong,
    mastery: computeMastery(correct, wrong, incidents),
  };
}

export function masteryOf(ledger: CompetencyLedger, code: CompetencyCode): number {
  return tallyCompetency(ledger, code).mastery;
}

/** 导出雷达图数据；codes 为空时用契约全量能力点。 */
export function buildRadarData(
  ledger: CompetencyLedger,
  codes: readonly CompetencyCode[] = ALL_COMPETENCIES,
): RadarData {
  const axes: RadarAxis[] = codes.map((code) => {
    const tally = tallyCompetency(ledger, code);
    return {
      code,
      category: competencyCategory(code),
      mastery: tally.mastery,
      correct: tally.correct,
      wrong: tally.wrong,
      incidents: tally.incidents,
      attempts: tally.attempts,
    };
  });
  const overall =
    axes.length === 0
      ? 0
      : clamp01(axes.reduce((sum, axis) => sum + axis.mastery, 0) / axes.length);
  return { axes, overall };
}
