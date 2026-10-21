/**
 * lib/persist/score.ts —— 交卷结算（调用 lib/pedagogy/scoring.ts，不自己发明公式）
 *
 * 口径：
 * - 操作分：state.violations / state.incidents 的扣分 + H2 及以上提示每条 -1；
 * - 预习分：quiz_answers 里 phase="pre" 的正确率 ×100；后测 phase="post" 只进目标 1；
 * - 报告分：数据完整性 30% + 计算正确 30% + 误差分析 20% + 安全复盘 20%（scoring.ts 加权）；
 * - 总分：三项各取整后按 10/40/50 折算再取整（教师端与导出口径一致）；
 * - 能力点 mastery 用契约 §7 公式，0~1。
 */

import type { CompetencyCode, ExperimentDefinition, ExperimentState } from "@/lib/engine";
import {
  ALL_COMPETENCIES,
  createCompetencyLedger,
  recordOutcome,
  tallyCompetency,
} from "@/lib/pedagogy/competency";
import { hintDeductForLevel, type HintUsage } from "@/lib/pedagogy/hints";
import {
  computeCourseResult,
  computeWeightedTotal,
  type IncidentRecord as ScoreIncident,
  type ObjectiveAttainment,
  type ReportParts,
  type ViolationRecord as ScoreViolation,
} from "@/lib/pedagogy/scoring";
import { getIncident } from "@/lib/safety/registry";
import type { StoredIncidentRow, StoredTimelineRow } from "./replay";

export interface QuizRow {
  phase: string;
  questionId: string;
  answer: string;
  correct: boolean;
}

export interface ScoreIncidentDetail {
  incidentId: string;
  level: string;
  deduct: number;
  stepIndex: number;
}

/** 一次提示使用（报告页据此显示"第 N 步 · 提示 k 次 · −X 分"）。 */
export interface ScoreHintDetail {
  /** 0-based，与 ExperimentState.stepIndex 对齐 */
  stepIndex: number;
  /** 引擎 HintLevel：0 方向 / 1 具体 / 2 高亮 / 3 动作演示 / 4 元认知 */
  level: number;
  deduct: number;
}

export interface ScoreDetail {
  /** 0~1 mastery，键为能力点编码 */
  competency: Record<string, number>;
  objectives: ObjectiveAttainment;
  incidents: ScoreIncidentDetail[];
  /** 用过的提示，按发生顺序；扣分按 1/3/5（见 lib/pedagogy/hints.ts 的 HINT_DEDUCT_BY_LEVEL） */
  hints: ScoreHintDetail[];
  reportParts: ReportParts;
}

export interface RunScoreResult {
  preview: number;
  operation: number;
  report: number;
  total: number;
  detail: ScoreDetail;
}

export interface RunScoreInput {
  expId: string;
  definition: ExperimentDefinition;
  state: ExperimentState;
  hints: readonly HintUsage[];
  timelineRows: readonly StoredTimelineRow[];
  incidentRows: readonly StoredIncidentRow[];
  quizRows: readonly QuizRow[];
}

const MAX_SCORE = 100;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_SCORE, Math.max(0, value));
}

function ratioScore(correct: number, total: number): number {
  if (total <= 0) return 0;
  return clamp((correct / total) * MAX_SCORE);
}

function quizScore(rows: readonly QuizRow[], phase: string): number {
  const filtered = rows.filter((row) => row.phase === phase);
  return ratioScore(filtered.filter((row) => row.correct).length, filtered.length);
}

function parsePayload(payload: string | null): Record<string, unknown> {
  if (!payload) return {};
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 报告四分项：数据完整性 / 计算正确 / 误差分析 / 安全复盘。 */
export function computeReportParts(input: {
  definition: ExperimentDefinition;
  state: ExperimentState;
  timelineRows: readonly StoredTimelineRow[];
  incidentRows: readonly StoredIncidentRow[];
}): ReportParts {
  const steps = input.definition.steps;
  const toleranceSteps = steps.filter((step) => step.judge.tolerance);
  const observationSteps = new Set(input.state.observations.map((item) => item.stepIndex));

  const dataCompleteness =
    toleranceSteps.length > 0
      ? ratioScore(
          toleranceSteps.filter((step) => observationSteps.has(step.index)).length,
          toleranceSteps.length,
        )
      : input.state.done
        ? MAX_SCORE
        : ratioScore(input.state.stepIndex, steps.length);

  let checked = 0;
  let passed = 0;
  let relativeRange: number | null = null;
  for (const step of steps) {
    const tolerance = step.judge.tolerance;
    if (!tolerance) continue;
    const rows = input.timelineRows.filter(
      (row) => row.actionType !== "drop" && row.stepIndex === step.index && row.correct,
    );
    const last = rows[rows.length - 1];
    if (!last) continue;
    const value = parsePayload(last.payload)[tolerance.paramKey];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    checked += 1;
    if (Math.abs(value - tolerance.expected) <= tolerance.tolerance) passed += 1;
    if (tolerance.paramKey === "relativeRange") relativeRange = value;
  }
  const calculation =
    checked > 0 ? ratioScore(passed, checked) : input.state.done ? MAX_SCORE : dataCompleteness;

  let errorAnalysis: number;
  if (relativeRange === null) {
    errorAnalysis = input.state.done ? 60 : 0;
  } else if (relativeRange <= 0.2) {
    errorAnalysis = 100;
  } else if (relativeRange <= 0.4) {
    errorAnalysis = 85;
  } else if (relativeRange <= 1) {
    errorAnalysis = 65;
  } else {
    errorAnalysis = 40;
  }

  const l1 = input.incidentRows.filter((row) => row.level === "L1").length;
  const severe = input.incidentRows.filter((row) => row.level !== "L1").length;
  const safetyReview = clamp(MAX_SCORE - l1 * 5 - severe * 15);

  return {
    dataCompleteness: Math.round(dataCompleteness),
    calculation: Math.round(calculation),
    errorAnalysis: Math.round(errorAnalysis),
    safetyReview: Math.round(safetyReview),
  };
}

function toScoreViolations(state: ExperimentState): ScoreViolation[] {
  return state.violations.map((record) => ({
    ruleId: record.ruleId,
    competency: record.competency,
    deduct: record.deduct,
    stepIndex: record.stepIndex,
  }));
}

function toScoreIncidents(
  state: ExperimentState,
  incidentRows: readonly StoredIncidentRow[],
): ScoreIncident[] {
  const deductByKey = new Map<string, number>();
  for (const row of incidentRows) {
    deductByKey.set(`${row.stepIndex}:${row.incidentId}`, row.deduct);
  }
  return state.incidents.map((record) => ({
    incidentId: record.incidentId,
    level: record.level,
    deduct: deductByKey.get(`${record.stepIndex}:${record.incidentId}`) ?? getIncident(record.incidentId)?.deduct ?? 0,
    terminate: record.terminate,
    competency: getIncident(record.incidentId)?.competency,
    stepIndex: record.stepIndex,
  }));
}

function buildCompetencyMap(input: RunScoreInput): Record<string, number> {
  let ledger = createCompetencyLedger();
  for (const row of input.timelineRows) {
    // 投放审计行不计入能力点/尝试次数，只用于报告时间线。
    if (row.actionType === "drop") continue;
    ledger = recordOutcome(ledger, {
      competency: row.competency as CompetencyCode,
      outcome: row.correct ? "correct" : "wrong",
      stepIndex: row.stepIndex,
      seq: row.seq,
    });
  }
  for (const row of input.incidentRows) {
    const competency = getIncident(row.incidentId)?.competency;
    if (!competency) continue;
    ledger = recordOutcome(ledger, {
      competency,
      outcome: "incident",
      stepIndex: row.stepIndex,
    });
  }

  const codes =
    input.definition.competencies.length > 0 ? input.definition.competencies : ALL_COMPETENCIES;
  const map: Record<string, number> = {};
  for (const code of codes) {
    map[code] = Math.round(tallyCompetency(ledger, code).mastery * 10000) / 10000;
  }
  return map;
}

/** 一次 run 的完整结算。 */
export function computeRunScore(input: RunScoreInput): RunScoreResult {
  const preview = quizScore(input.quizRows, "pre");
  const postTest = quizScore(input.quizRows, "post");
  const incidentRecords = toScoreIncidents(input.state, input.incidentRows);
  const reportParts = computeReportParts(input);

  const competency = buildCompetencyMap(input);
  const skillMasteries = input.definition.competencies
    .filter((code) => code.startsWith("S"))
    .map((code) => competency[code] ?? 0);

  const result = computeCourseResult({
    preview,
    postTest,
    violations: toScoreViolations(input.state),
    incidents: incidentRecords,
    hints: [...input.hints],
    report: reportParts,
    skillMasteries,
    attemptCount: input.timelineRows.filter((row) => row.actionType !== "drop").length,
  });

  const roundedPreview = Math.round(clamp(result.threePart.preview));
  const roundedOperation = Math.round(clamp(result.threePart.operation));
  const roundedReport = Math.round(clamp(result.threePart.report));
  const weighted = computeWeightedTotal({
    preview: roundedPreview,
    operation: roundedOperation,
    report: roundedReport,
  });

  return {
    preview: roundedPreview,
    operation: roundedOperation,
    report: roundedReport,
    total: Math.round(weighted.total),
    detail: {
      competency,
      objectives: result.objectives,
      incidents: input.state.incidents.map((record) => ({
        incidentId: record.incidentId,
        level: record.level,
        deduct:
          incidentRecords.find(
            (item) =>
              item.incidentId === record.incidentId && item.stepIndex === record.stepIndex,
          )?.deduct ?? 0,
        stepIndex: record.stepIndex,
      })),
      // 提示使用明细：报告页/教师端据此显示"提示 k 次 · −X 分"
      hints: input.hints.map((usage) => ({
        stepIndex: usage.stepIndex,
        level: usage.level,
        deduct: hintDeductForLevel(usage.level),
      })),
      reportParts,
    },
  };
}
