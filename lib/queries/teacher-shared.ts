/**
 * lib/queries/teacher-shared.ts —— 教师端查询的共用读模型（不对外暴露）
 *
 * 口径（已写入 .team/notes/data-api.md）：
 * - 默认排除 `runs.is_demo = true`（演示数据不进学情），可用 includeDemo 打开；
 * - 每个学生的「当前状态」按**最近一次 run** 判定；
 * - 完成度 = 已触达步数 / 实验步数（交卷恒为 100）；
 * - 事故数按该生所有非演示 run 累计。
 */

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { experiments, runs, timeline, incidents } from "@/db/schema";

export interface DemoOptions {
  includeDemo?: boolean;
}

/** 非演示过滤；includeDemo 时返回 undefined（drizzle where 会忽略）。 */
export function demoFilter(includeDemo: boolean | undefined) {
  return includeDemo ? undefined : eq(runs.isDemo, false);
}

/** PGlite / 驱动返回的时间可能是 Date 或字符串，统一成 Date。 */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export interface RunRow {
  runId: string;
  studentNo: string;
  experimentId: string;
  status: string;
  totalScore: number | null;
  scorePre: number | null;
  scoreOp: number | null;
  scoreReport: number | null;
  isDemo: boolean;
  startedAt: Date;
  finishedAt: Date | null;
}

/** 按 startedAt 倒序的全部 run；学生详情/列表共用。 */
export async function loadRuns(opts: DemoOptions = {}): Promise<RunRow[]> {
  const rows = await db
    .select({
      runId: runs.id,
      studentNo: runs.studentNo,
      experimentId: runs.experimentId,
      status: runs.status,
      totalScore: runs.totalScore,
      scorePre: runs.scorePre,
      scoreOp: runs.scoreOp,
      scoreReport: runs.scoreReport,
      isDemo: runs.isDemo,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
    })
    .from(runs)
    .where(demoFilter(opts.includeDemo))
    .orderBy(sql`${runs.startedAt} desc`);
  return rows;
}

export interface RunAggregate {
  coveredSteps: number;
  lastActiveAt: Date | null;
  incidentCount: number;
}

/** runId → 完成步数 / 最近活跃时间 / 事故数。 */
export async function loadRunAggregates(runIds: string[]): Promise<Map<string, RunAggregate>> {
  const out = new Map<string, RunAggregate>();
  if (runIds.length === 0) return out;

  const timelineRows = await db
    .select({
      runId: timeline.runId,
      covered: sql<number>`count(distinct ${timeline.stepIndex})`.mapWith(Number),
      lastAt: sql<unknown>`max(${timeline.at})`,
    })
    .from(timeline)
    .where(inArray(timeline.runId, runIds))
    .groupBy(timeline.runId);

  for (const row of timelineRows) {
    out.set(row.runId, {
      coveredSteps: Number(row.covered) || 0,
      lastActiveAt: toDate(row.lastAt),
      incidentCount: 0,
    });
  }

  const incidentRows = await db
    .select({ runId: incidents.runId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(incidents)
    .where(inArray(incidents.runId, runIds))
    .groupBy(incidents.runId);

  for (const row of incidentRows) {
    const current = out.get(row.runId) ?? {
      coveredSteps: 0,
      lastActiveAt: null,
      incidentCount: 0,
    };
    current.incidentCount = Number(row.count) || 0;
    out.set(row.runId, current);
  }
  return out;
}

/** 实验 id → 步数（progress 的分母）。 */
export async function loadExperimentSteps(): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: experiments.id, steps: experiments.steps })
    .from(experiments);
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.id, Number(row.steps) || 0);
  return map;
}

/** 0~100 完成度；交卷 100，进行中最多 99。 */
export function progressOf(
  status: string,
  coveredSteps: number,
  totalSteps: number,
): number {
  if (status === "finished") return 100;
  if (totalSteps <= 0) return 0;
  const ratio = Math.round((coveredSteps / totalSteps) * 100);
  return Math.max(0, Math.min(99, ratio));
}

/** 把最新一条活跃时间取为 run 的 startedAt / finishedAt / 最后操作时间三者最大。 */
export function lastActiveOf(run: RunRow, aggregate: RunAggregate | undefined): Date {
  const candidates = [run.startedAt, run.finishedAt, aggregate?.lastActiveAt ?? null].filter(
    (value): value is Date => value instanceof Date,
  );
  return candidates.reduce((best, cur) => (cur.getTime() > best.getTime() ? cur : best), run.startedAt);
}
