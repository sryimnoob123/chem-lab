/**
 * lib/queries/teacher.ts —— 教师端读模型（**对外签名固定，教师端页面直接 import**）
 *
 * 默认排除 `runs.is_demo = true`（演示数据不进学情），可传 `includeDemo: true` 打开。
 * 口径：
 * - 学生状态按**最近一次 run**：finished=done / in_progress=doing / 无 run=not_started；
 * - 完成度 = 已触达步数 / 实验步数（交卷恒 100）；
 * - 事故数 = 该生所有非演示 run 的事故合计；
 * - 事故分布只统计非演示 run。
 */

import { eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { incidents, runs, students } from "@/db/schema";
import { incidentLabel } from "@/lib/persist/labels";
import {
  demoFilter,
  lastActiveOf,
  loadExperimentSteps,
  loadRunAggregates,
  loadRuns,
  progressOf,
  type DemoOptions,
  type RunRow,
} from "./teacher-shared";

export {
  getStudentDetail,
  type StudentDetail,
  type StudentDetailRun,
  type StudentDetailIncident,
  type StudentDetailTimeline,
} from "./teacher-detail";

export interface OverviewStat {
  total: number;
  done: number;
  doing: number;
  notStarted: number;
  avgTotal: number | null;
  incidents: number;
}

/** 教师首页总览：学生状态计数 + 已交卷均分 + 事故总数。 */
export async function getOverview(opts: DemoOptions = {}): Promise<OverviewStat> {
  const studentRows = await db.select({ studentNo: students.studentNo }).from(students);
  const runRows = await loadRuns(opts);

  const done = new Set<string>();
  const doing = new Set<string>();
  const finishedScores: number[] = [];
  for (const run of runRows) {
    if (run.status === "finished") {
      done.add(run.studentNo);
      if (typeof run.totalScore === "number") finishedScores.push(run.totalScore);
    } else {
      doing.add(run.studentNo);
    }
  }
  for (const no of done) doing.delete(no);

  const [incidentTotal] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(incidents)
    .innerJoin(runs, eq(incidents.runId, runs.id))
    .where(demoFilter(opts.includeDemo));

  const avg =
    finishedScores.length === 0
      ? null
      : Math.round((finishedScores.reduce((sum, score) => sum + score, 0) / finishedScores.length) * 10) / 10;

  const total = studentRows.length;
  return {
    total,
    done: done.size,
    doing: doing.size,
    notStarted: Math.max(0, total - done.size - doing.size),
    avgTotal: avg,
    incidents: Number(incidentTotal?.count ?? 0),
  };
}

export type StudentStatus = "done" | "doing" | "not_started";

export interface StudentRow {
  studentNo: string;
  name: string;
  className: string;
  status: StudentStatus;
  /** 0~100 */
  progress: number;
  lastActiveAt: Date | null;
  totalScore: number | null;
  incidentCount: number;
  runId: string | null;
  experimentId: string | null;
}

export interface ListStudentsOptions extends DemoOptions {
  q?: string;
  status?: StudentStatus | "all";
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 500;

function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, " ").trim();
}

function statusFilterOf(run: RunRow | undefined): StudentStatus {
  if (!run) return "not_started";
  return run.status === "finished" ? "done" : "doing";
}

/** 名单 + 最近一次 run 的状态行；status 过滤在聚合后做，total 为过滤后总数。 */
export async function listStudents(
  opts: ListStudentsOptions = {},
): Promise<{ rows: StudentRow[]; total: number }> {
  const q = escapeLike(opts.q ?? "");
  const studentRows = await db
    .select({ studentNo: students.studentNo, name: students.name, className: students.className })
    .from(students)
    .where(
      q
        ? or(
            ilike(students.studentNo, `%${q}%`),
            ilike(students.name, `%${q}%`),
            ilike(students.className, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(students.studentNo);

  const runRows = await loadRuns(opts);
  const latestByStudent = new Map<string, RunRow>();
  for (const run of runRows) {
    const current = latestByStudent.get(run.studentNo);
    if (!current || run.startedAt.getTime() > current.startedAt.getTime()) {
      latestByStudent.set(run.studentNo, run);
    }
  }

  const aggregates = await loadRunAggregates(runRows.map((run) => run.runId));
  const stepsByExp = await loadExperimentSteps();

  const incidentByStudent = new Map<string, number>();
  for (const run of runRows) {
    const count = aggregates.get(run.runId)?.incidentCount ?? 0;
    incidentByStudent.set(run.studentNo, (incidentByStudent.get(run.studentNo) ?? 0) + count);
  }

  const wanted = opts.status && opts.status !== "all" ? opts.status : null;
  const filtered: StudentRow[] = [];
  for (const student of studentRows) {
    const latest = latestByStudent.get(student.studentNo);
    const status = statusFilterOf(latest);
    if (wanted && status !== wanted) continue;

    const aggregate = latest ? aggregates.get(latest.runId) : undefined;
    const totalSteps = latest ? stepsByExp.get(latest.experimentId) ?? 0 : 0;
    filtered.push({
      studentNo: student.studentNo,
      name: student.name,
      className: student.className,
      status,
      progress: latest ? progressOf(latest.status, aggregate?.coveredSteps ?? 0, totalSteps) : 0,
      lastActiveAt: latest ? lastActiveOf(latest, aggregate) : null,
      totalScore: latest?.status === "finished" ? latest.totalScore : null,
      incidentCount: incidentByStudent.get(student.studentNo) ?? 0,
      runId: latest?.runId ?? null,
      experimentId: latest?.experimentId ?? null,
    });
  }

  const total = filtered.length;
  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 2000) : DEFAULT_LIST_LIMIT;
  return { rows: filtered.slice(0, limit), total };
}

export interface IncidentStat {
  level: "L1" | "L2" | "L3" | "L4";
  count: number;
  top: Array<{ incidentId: string; label: string; count: number }>;
}

const LEVELS: ReadonlyArray<IncidentStat["level"]> = ["L1", "L2", "L3", "L4"];

/** 四级事故分布（含每级 Top 3 高频条目）。 */
export async function getIncidentSummary(opts: DemoOptions = {}): Promise<IncidentStat[]> {
  const rows = await db
    .select({
      level: incidents.level,
      incidentId: incidents.incidentId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(incidents)
    .innerJoin(runs, eq(incidents.runId, runs.id))
    .where(demoFilter(opts.includeDemo))
    .groupBy(incidents.level, incidents.incidentId);

  const grouped = new Map<string, Array<{ incidentId: string; label: string; count: number }>>();
  for (const row of rows) {
    const list = grouped.get(row.level) ?? [];
    list.push({
      incidentId: row.incidentId,
      label: incidentLabel(row.incidentId, row.level),
      count: Number(row.count) || 0,
    });
    grouped.set(row.level, list);
  }

  return LEVELS.map((level) => {
    const list = (grouped.get(level) ?? []).sort(
      (a, b) => b.count - a.count || a.incidentId.localeCompare(b.incidentId),
    );
    return {
      level,
      count: list.reduce((sum, item) => sum + item.count, 0),
      top: list.slice(0, 3),
    };
  });
}
