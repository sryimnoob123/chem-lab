/**
 * lib/persist/report.ts —— run 全量读取 / 交卷
 *
 * - `loadRunBundle(runId)`：run + student + timeline + incidents + quiz + 已落库分数；
 * - `finishRun(runId)`：重放 → lib/pedagogy/scoring.ts 结算 → 写 runs 三段分/总分/score_detail；
 *   已交卷时幂等返回原报告，不重复扣分。
 *
 * 只在服务端调用（API 路由 / 服务端组件），不 import 到客户端组件。
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { incidents as incidentsTable, quizAnswers, runs, students, timeline } from "@/db/schema";
import { getDefinition } from "@/lib/engine";
import { computeWeightedTotal } from "@/lib/pedagogy/scoring";
import { conflict, notFound, PersistError } from "./errors";
import { incidentLabel } from "./labels";
import { replayState, type StoredIncidentRow, type StoredTimelineRow } from "./replay";
import { computeRunScore, type QuizRow, type ScoreDetail } from "./score";

export interface RunScores {
  preview: number | null;
  operation: number | null;
  report: number | null;
  total: number | null;
  detail: ScoreDetail | null;
}

export interface RunBundle {
  run: {
    runId: string;
    experimentId: string;
    studentNo: string;
    status: string;
    isDemo: boolean;
    startedAt: Date;
    finishedAt: Date | null;
  };
  student: { studentNo: string; name: string; className: string } | null;
  timeline: StoredTimelineRow[];
  incidents: Array<StoredIncidentRow & { label: string }>;
  quiz: QuizRow[];
  scores: RunScores;
}

function asScoreDetail(value: unknown): ScoreDetail | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.competency !== "object" || record.competency === null) return null;
  if (typeof record.objectives !== "object" || record.objectives === null) return null;
  return value as ScoreDetail;
}

/** 读一个 run 的全量数据；run 不存在返回 null。 */
export async function loadRunBundle(runId: string): Promise<RunBundle | null> {
  const runRows = await db
    .select({
      runId: runs.id,
      experimentId: runs.experimentId,
      studentNo: runs.studentNo,
      status: runs.status,
      isDemo: runs.isDemo,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
      scorePre: runs.scorePre,
      scoreOp: runs.scoreOp,
      scoreReport: runs.scoreReport,
      totalScore: runs.totalScore,
      scoreDetail: runs.scoreDetail,
    })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  const run = runRows[0];
  if (!run) return null;

  const studentRows = await db
    .select({ studentNo: students.studentNo, name: students.name, className: students.className })
    .from(students)
    .where(eq(students.studentNo, run.studentNo))
    .limit(1);

  const timelineRows = await db
    .select({
      stepIndex: timeline.stepIndex,
      seq: timeline.seq,
      actionType: timeline.actionType,
      choiceId: timeline.choiceId,
      competency: timeline.competency,
      correct: timeline.correct,
      deduct: timeline.deduct,
      payload: timeline.payload,
      at: timeline.at,
    })
    .from(timeline)
    .where(eq(timeline.runId, runId))
    .orderBy(asc(timeline.stepIndex), asc(timeline.seq));

  const incidentRows = await db
    .select({
      stepIndex: incidentsTable.stepIndex,
      incidentId: incidentsTable.incidentId,
      level: incidentsTable.level,
      deduct: incidentsTable.deduct,
      fx: incidentsTable.fx,
      at: incidentsTable.at,
    })
    .from(incidentsTable)
    .where(eq(incidentsTable.runId, runId))
    .orderBy(asc(incidentsTable.at));

  const quizRows = await db
    .select({
      phase: quizAnswers.phase,
      questionId: quizAnswers.questionId,
      answer: quizAnswers.answer,
      correct: quizAnswers.correct,
      at: quizAnswers.at,
    })
    .from(quizAnswers)
    .where(eq(quizAnswers.runId, runId))
    .orderBy(asc(quizAnswers.at));

  return {
    run: {
      runId: run.runId,
      experimentId: run.experimentId,
      studentNo: run.studentNo,
      status: run.status,
      isDemo: run.isDemo,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    },
    student: studentRows[0] ?? null,
    timeline: timelineRows,
    incidents: incidentRows.map((row) => ({
      ...row,
      label: incidentLabel(row.incidentId, row.level),
    })),
    quiz: quizRows.map((row) => ({
      phase: row.phase,
      questionId: row.questionId,
      answer: row.answer,
      correct: row.correct,
    })),
    scores: {
      preview: run.scorePre,
      operation: run.scoreOp,
      report: run.scoreReport,
      total: run.totalScore,
      detail: asScoreDetail(run.scoreDetail),
    },
  };
}

/**
 * 交卷：重算三段分与总分并落库；已交卷幂等返回。
 *
 * 预习分只认 quiz_answers 里 phase="pre" 的正确率（lib/persist/score.ts）。
 * 2026-10-24 起不再有「演示按满分」的 override（`?auto=1` 特例已收掉）——
 * 前测答案在前测通过后由 POST /api/runs/[id]/quiz 真实落库，演示路径同样按答案算分。
 * 真正没跑前测的路径（?play=demo / ?teach=1 这类 bypass 且不落库的只读演示）
 * 不产生 run，也不会走到这里。
 */
export async function finishRun(runId: string): Promise<RunBundle> {
  const bundle = await loadRunBundle(runId);
  if (!bundle) throw notFound("RUN_NOT_FOUND");
  if (bundle.run.status === "finished") return bundle;

  const definition = getDefinition(bundle.run.experimentId);
  if (!definition) throw new PersistError(404, "EXPERIMENT_NOT_PLAYABLE");

  const replayed = replayState(bundle.run.experimentId, bundle.timeline, bundle.incidents);
  const score = computeRunScore({
    expId: bundle.run.experimentId,
    definition,
    state: replayed.state,
    hints: replayed.hints,
    timelineRows: bundle.timeline,
    incidentRows: bundle.incidents,
    quizRows: bundle.quiz,
  });

  const preview = score.preview;
  const weighted = computeWeightedTotal({
    preview,
    operation: score.operation,
    report: score.report,
  });

  const finishedAt = new Date();
  await db
    .update(runs)
    .set({
      status: "finished",
      finishedAt,
      scorePre: preview,
      scoreOp: score.operation,
      scoreReport: score.report,
      totalScore: Math.round(weighted.total),
      scoreDetail: score.detail,
    })
    .where(eq(runs.id, runId));

  const updated = await loadRunBundle(runId);
  if (!updated) throw conflict("RUN_DISAPPEARED");
  return updated;
}

/** 报告页裁剪形态（不含逐条 timeline）。 */
export interface ReportPayload {
  run: RunBundle["run"];
  student: RunBundle["student"];
  scores: RunScores;
  competency: Record<string, number>;
  objectives: ScoreDetail["objectives"] | null;
  reportParts: ScoreDetail["reportParts"] | null;
  incidents: RunBundle["incidents"];
  quiz: QuizRow[];
}

export function buildReportPayload(bundle: RunBundle): ReportPayload {
  const detail = bundle.scores.detail;
  return {
    run: bundle.run,
    student: bundle.student,
    scores: bundle.scores,
    competency: detail?.competency ?? {},
    objectives: detail?.objectives ?? null,
    reportParts: detail?.reportParts ?? null,
    incidents: bundle.incidents,
    quiz: bundle.quiz,
  };
}
