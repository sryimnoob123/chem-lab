/**
 * lib/queries/teacher-detail.ts —— 单个学生的学情详情（由 teacher.ts re-export）
 *
 * competency 为 0~1 的 mastery（跨该生所有非演示 run 合并账本后按契约 §7 公式算），
 * 与 runs.score_detail.competency 同口径，教师端渲染时 ×100。
 */

import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { incidents, students, timeline } from "@/db/schema";
import { getDefinition } from "@/lib/engine";
import type { CompetencyCode } from "@/lib/pedagogy/competency";
import {
  ALL_COMPETENCIES,
  createCompetencyLedger,
  recordOutcome,
  tallyCompetency,
} from "@/lib/pedagogy/competency";
import { getIncident } from "@/lib/safety/registry";
import { actionLabel, incidentLabel } from "@/lib/persist/labels";
import {
  loadExperimentSteps,
  loadRunAggregates,
  loadRuns,
  progressOf,
  toDate,
  type DemoOptions,
} from "./teacher-shared";

export interface StudentDetailRun {
  runId: string;
  experimentId: string;
  status: string;
  totalScore: number | null;
  scorePre: number | null;
  scoreOp: number | null;
  scoreReport: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  /** 0~100 */
  progress: number;
}

export interface StudentDetailIncident {
  level: string;
  incidentId: string;
  label: string;
  stepIndex: number;
  at: Date;
  runId: string;
}

export interface StudentDetailTimeline {
  stepIndex: number;
  actionType: string;
  choiceId: string;
  correct: boolean;
  deduct: number;
  at: Date;
  /** 中文动作名（定义文件 label 的回落链：choice.label → actionType） */
  label: string;
  runId: string;
}

export interface StudentDetail {
  student: { studentNo: string; name: string; className: string };
  runs: StudentDetailRun[];
  /** 能力点编码 → 掌握度 0~100（教师端渲染口径） */
  competency: Record<string, number>;
  incidents: StudentDetailIncident[];
  timeline: StudentDetailTimeline[];
}

/** 学生详情；学生不存在返回 null（路由回 404）。 */
export async function getStudentDetail(
  studentNo: string,
  opts: DemoOptions = {},
): Promise<StudentDetail | null> {
  const studentRows = await db
    .select({ studentNo: students.studentNo, name: students.name, className: students.className })
    .from(students)
    .where(eq(students.studentNo, studentNo))
    .limit(1);
  const student = studentRows[0];
  if (!student) return null;

  const allRuns = await loadRuns(opts);
  const runRows = allRuns.filter((run) => run.studentNo === student.studentNo);
  const runIds = runRows.map((run) => run.runId);
  const aggregates = await loadRunAggregates(runIds);
  const stepsByExp = await loadExperimentSteps();

  const experimentById = new Map<string, string>();
  for (const run of runRows) experimentById.set(run.runId, run.experimentId);

  const timelineRows = runIds.length
    ? await db
        .select({
          runId: timeline.runId,
          stepIndex: timeline.stepIndex,
          actionType: timeline.actionType,
          choiceId: timeline.choiceId,
          competency: timeline.competency,
          correct: timeline.correct,
          deduct: timeline.deduct,
          at: timeline.at,
        })
        .from(timeline)
        .where(inArray(timeline.runId, runIds))
        .orderBy(asc(timeline.at))
    : [];

  const incidentRows = runIds.length
    ? await db
        .select({
          runId: incidents.runId,
          stepIndex: incidents.stepIndex,
          incidentId: incidents.incidentId,
          level: incidents.level,
          at: incidents.at,
        })
        .from(incidents)
        .where(inArray(incidents.runId, runIds))
        .orderBy(asc(incidents.at))
    : [];

  const timelineDetail: StudentDetailTimeline[] = timelineRows.map((row) => {
    const expId = experimentById.get(row.runId) ?? "";
    const definition = expId ? getDefinition(expId) : undefined;
    return {
      stepIndex: row.stepIndex,
      actionType: row.actionType,
      choiceId: row.choiceId,
      correct: row.correct,
      deduct: row.deduct,
      at: toDate(row.at) ?? new Date(0),
      label: actionLabel({
        definition,
        stepIndex: row.stepIndex,
        choiceId: row.choiceId,
        actionType: row.actionType,
      }),
      runId: row.runId,
    };
  });

  const incidentsDetail: StudentDetailIncident[] = incidentRows.map((row) => ({
    level: row.level,
    incidentId: row.incidentId,
    label: incidentLabel(row.incidentId, row.level),
    stepIndex: row.stepIndex,
    at: toDate(row.at) ?? new Date(0),
    runId: row.runId,
  }));

  let ledger = createCompetencyLedger();
  for (const row of timelineRows) {
    ledger = recordOutcome(ledger, {
      competency: row.competency as CompetencyCode,
      outcome: row.correct ? "correct" : "wrong",
      stepIndex: row.stepIndex,
    });
  }
  for (const row of incidentRows) {
    const competency = getIncident(row.incidentId)?.competency;
    if (!competency) continue;
    ledger = recordOutcome(ledger, {
      competency,
      outcome: "incident",
      stepIndex: row.stepIndex,
    });
  }

  const codes = new Set<string>();
  for (const run of runRows) {
    for (const code of getDefinition(run.experimentId)?.competencies ?? []) codes.add(code);
  }
  for (const row of timelineRows) codes.add(row.competency);
  for (const row of incidentRows) {
    const competency = getIncident(row.incidentId)?.competency;
    if (competency) codes.add(competency);
  }
  if (codes.size === 0) for (const code of ALL_COMPETENCIES) codes.add(code);

  const competency: Record<string, number> = {};
  for (const code of codes) {
    // 教师端统一按 0~100 渲染（见 components/teacher/types.ts）；score_detail 里仍是 0~1。
    competency[code] = Math.round(tallyCompetency(ledger, code as CompetencyCode).mastery * 100);
  }

  const runs: StudentDetailRun[] = runRows.map((run) => ({
    runId: run.runId,
    experimentId: run.experimentId,
    status: run.status,
    totalScore: run.totalScore,
    scorePre: run.scorePre,
    scoreOp: run.scoreOp,
    scoreReport: run.scoreReport,
    startedAt: toDate(run.startedAt) ?? new Date(0),
    finishedAt: toDate(run.finishedAt),
    progress: progressOf(
      run.status,
      aggregates.get(run.runId)?.coveredSteps ?? 0,
      stepsByExp.get(run.experimentId) ?? 0,
    ),
  }));

  return { student, runs, competency, incidents: incidentsDetail, timeline: timelineDetail };
}
