/**
 * 计分与折算（Scoring）
 *
 * 契约 docs/接口契约.md §7；判分口径 docs/实验库/exp09.md §10、_模板.md §10。
 *
 * 一、操作分（满分 100）— 契约 §7
 *   opScore = clamp(100 - Σviolation.deduct - Σincident.deduct - independentDeduct, 0, 100)
 *   independentDeduct = 用到 H2 及以上提示的次数 × 1（契约 §6 / exp09 §10）
 *   L4 事故触发即终止：操作分记 0（exp09 §10）。
 *
 * 二、三项折算（合计 100%）— 契约 §7
 *   | 分项 | 权重 | 来源 |
 *   |------|------|------|
 *   | 预习 | 10%  | 前测（exp09 前测 3 题全对方可进操作台） |
 *   | 操作 | 40%  | opScore |
 *   | 报告 | 50%  | 数据完整性 30% + 计算正确 30% + 误差分析 20% + 安全复盘 20% |
 *   折算后总分 = 预习 × 0.10 + 操作 × 0.40 + 报告 × 0.50（各分项先 clamp 到 0~100）。
 *
 * 三、课程目标达成度（统一折算到 0~1，便于教师端汇总）— 契约 §7
 *   | 目标 | 契约口径 | 本实现 |
 *   |------|----------|--------|
 *   | 目标1 知识 | 前测 + 后测平均 | (preTest + postTest) / 200 |
 *   | 目标2 能力 | opScore + mastery(S*) | (opScore/100 + mean(skill masteries)) / 2 |
 *   | 目标3 素质 | 1 - 事故率 | 1 - L2 及以上事故次数 / max(1, attemptCount) |
 *   - S* 由调用方传入本实验覆盖的技能能力点；为空时目标2 = opScore/100。
 *   - 事故率只统计 L2 及以上：契约 §5 中 L1 只是"提示，可继续"，不改数据、不计事故。
 *   - 所有达成度结果 clamp 到 [0, 1]。
 */

import type { CompetencyCode } from "./competency";
import { INDEPENDENT_DEDUCT_MIN_LEVEL, type HintLevel, type HintUsage } from "./hints";

export type IncidentLevel = "L1" | "L2" | "L3" | "L4";

export interface ViolationRecord {
  ruleId: string;
  competency: CompetencyCode;
  deduct: number;
  stepIndex?: number;
}

export interface IncidentRecord {
  incidentId: string;
  level: IncidentLevel;
  deduct: number;
  terminate: boolean;
  competency?: CompetencyCode;
  stepIndex?: number;
}

export interface OperationScoreInput {
  violations: readonly ViolationRecord[];
  incidents: readonly IncidentRecord[];
  /** 实际展示过的提示；H0/H1 不扣分，H2 及以上每条 -1。 */
  hints?: readonly HintUsage[];
}

export interface OperationScore {
  violationDeduct: number;
  incidentDeduct: number;
  independentDeduct: number;
  /** 扣分前的线性结果（可能为负，便于教师端看原始值）。 */
  rawScore: number;
  /** clamp 到 0~100 后、可入档的操作分；L4 终止时为 0。 */
  score: number;
  terminated: boolean;
}

export interface ReportParts {
  /** 数据完整性（0~100）。 */
  dataCompleteness: number;
  /** 计算正确（0~100）。 */
  calculation: number;
  /** 误差分析（0~100）。 */
  errorAnalysis: number;
  /** 安全复盘（0~100）。 */
  safetyReview: number;
}

export interface ThreePartScores {
  /** 预习/前测 0~100。 */
  preview: number;
  /** 操作 0~100。 */
  operation: number;
  /** 报告 0~100。 */
  report: number;
}

export interface WeightedTotal {
  /** 各分项折算后的贡献分。 */
  preview: number;
  operation: number;
  report: number;
  total: number;
  /** 三项权重之和，恒为 1（测试锁定）。 */
  weightsSum: number;
}

export interface ObjectiveInput {
  preTest: number;
  postTest: number;
  operationScore: number;
  /** 本实验覆盖的技能能力点 mastery（0~1）。 */
  skillMasteries: readonly number[];
  incidents: readonly Pick<IncidentRecord, "level">[];
  /** 本实验的总尝试次数（correct + wrong），事故率的分母。 */
  attemptCount: number;
}

export interface ObjectiveAttainment {
  objective1: number;
  objective2: number;
  objective3: number;
}

/** 分项满分。 */
export const MAX_SCORE = 100;
export const MIN_SCORE = 0;
/** 操作分起评线。 */
export const BASE_OPERATION_SCORE = 100;

/** 契约 §6：H2 及以上每次 independentDeduct += 1。 */
export const INDEPENDENT_DEDUCT_PER_HINT = 1;

/** 三项折算权重，依据契约 §7 与课程大纲。 */
export const WEIGHT_PREVIEW = 0.1;
export const WEIGHT_OPERATION = 0.4;
export const WEIGHT_REPORT = 0.5;

/** 报告分内部权重，依据 exp09 §10 / _模板 §10。 */
export const REPORT_WEIGHT_DATA = 0.3;
export const REPORT_WEIGHT_CALCULATION = 0.3;
export const REPORT_WEIGHT_ERROR = 0.2;
export const REPORT_WEIGHT_SAFETY = 0.2;

/** 事故率从哪一级起算：L1 仅是提示，不算事故。 */
export const ACCIDENT_MIN_LEVEL: IncidentLevel = "L2";

/** 触发终止的级别：契约 §5 规定 L4 一律 terminate。 */
export const TERMINATING_LEVEL: IncidentLevel = "L4";

export const OBJECTIVE_MIN = 0;
export const OBJECTIVE_MAX = 1;

const INCIDENT_LEVEL_ORDER: Record<IncidentLevel, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

function clampScore(value: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));
}

function clamp01(value: number): number {
  return Math.min(OBJECTIVE_MAX, Math.max(OBJECTIVE_MIN, value));
}

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** 逐条累加扣分；不是有限值的按 0 处理，避免 NaN 污染总分。 */
export function sumDeductions(records: readonly { deduct: number }[]): number {
  return records.reduce((sum, record) => sum + sanitizeNumber(record.deduct), 0);
}

/** 用到 H2 及以上的提示条数（每条折 1 分）。 */
export function computeIndependentDeduct(hints: readonly { level: HintLevel }[]): number {
  return (
    hints.filter((hint) => hint.level >= INDEPENDENT_DEDUCT_MIN_LEVEL).length *
    INDEPENDENT_DEDUCT_PER_HINT
  );
}

/** 统计 L2 及以上事故次数（事故率分子）。 */
export function countAccidents(incidents: readonly Pick<IncidentRecord, "level">[]): number {
  return incidents.filter(
    (incident) => INCIDENT_LEVEL_ORDER[incident.level] >= INCIDENT_LEVEL_ORDER[ACCIDENT_MIN_LEVEL],
  ).length;
}

/** 操作分聚合。 */
export function computeOperationScore(input: OperationScoreInput): OperationScore {
  const violationDeduct = sumDeductions(input.violations);
  const incidentDeduct = sumDeductions(input.incidents);
  const independentDeduct = computeIndependentDeduct(input.hints ?? []);
  const rawScore =
    BASE_OPERATION_SCORE - violationDeduct - incidentDeduct - independentDeduct;
  const terminated = input.incidents.some(
    (incident) => incident.terminate || incident.level === TERMINATING_LEVEL,
  );
  return {
    violationDeduct,
    incidentDeduct,
    independentDeduct,
    rawScore,
    score: terminated ? 0 : clampScore(rawScore),
    terminated,
  };
}

/** 报告分：四部分按 30/30/20/20 加权。 */
export function computeReportScore(parts: ReportParts): number {
  const score =
    clampScore(parts.dataCompleteness) * REPORT_WEIGHT_DATA +
    clampScore(parts.calculation) * REPORT_WEIGHT_CALCULATION +
    clampScore(parts.errorAnalysis) * REPORT_WEIGHT_ERROR +
    clampScore(parts.safetyReview) * REPORT_WEIGHT_SAFETY;
  return clampScore(score);
}

/** 三项折算：各分项 clamp 后按 10/40/50 加权。 */
export function computeWeightedTotal(scores: ThreePartScores): WeightedTotal {
  const preview = clampScore(scores.preview) * WEIGHT_PREVIEW;
  const operation = clampScore(scores.operation) * WEIGHT_OPERATION;
  const report = clampScore(scores.report) * WEIGHT_REPORT;
  return {
    preview,
    operation,
    report,
    total: preview + operation + report,
    weightsSum: WEIGHT_PREVIEW + WEIGHT_OPERATION + WEIGHT_REPORT,
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + clamp01(sanitizeNumber(value)), 0) / values.length;
}

/** 课程目标 1/2/3 达成度，均折算到 0~1。 */
export function computeObjectiveAttainment(input: ObjectiveInput): ObjectiveAttainment {
  const pre = clampScore(sanitizeNumber(input.preTest));
  const post = clampScore(sanitizeNumber(input.postTest));
  const operation = clampScore(sanitizeNumber(input.operationScore)) / MAX_SCORE;

  const skillPart =
    input.skillMasteries.length === 0 ? operation : average(input.skillMasteries);
  const accidentRate = countAccidents(input.incidents) / Math.max(1, input.attemptCount);

  return {
    objective1: clamp01((pre + post) / (2 * MAX_SCORE)),
    objective2: clamp01((operation + skillPart) / 2),
    objective3: clamp01(1 - accidentRate),
  };
}

export interface CourseResultInput {
  preview: number;
  postTest: number;
  violations: readonly ViolationRecord[];
  incidents: readonly IncidentRecord[];
  hints?: readonly HintUsage[];
  report: ReportParts;
  skillMasteries: readonly number[];
  attemptCount: number;
}

export interface CourseResult {
  operation: OperationScore;
  reportScore: number;
  threePart: ThreePartScores;
  weighted: WeightedTotal;
  objectives: ObjectiveAttainment;
}

/**
 * 一次实验的完整结算：操作分聚合 → 报告分 → 三项折算 → 目标达成度。
 * exp09 假数据可核对结果见 lib/pedagogy/scoring.test.ts 的 EXP09_CASE。
 */
export function computeCourseResult(input: CourseResultInput): CourseResult {
  const operation = computeOperationScore({
    violations: input.violations,
    incidents: input.incidents,
    hints: input.hints,
  });
  const reportScore = computeReportScore(input.report);
  const threePart: ThreePartScores = {
    preview: input.preview,
    operation: operation.score,
    report: reportScore,
  };
  return {
    operation,
    reportScore,
    threePart,
    weighted: computeWeightedTotal(threePart),
    objectives: computeObjectiveAttainment({
      preTest: input.preview,
      postTest: input.postTest,
      operationScore: operation.score,
      skillMasteries: input.skillMasteries,
      incidents: input.incidents,
      attemptCount: input.attemptCount,
    }),
  };
}
