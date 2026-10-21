/**
 * 班级能力点雷达的取数层（Server only，不导出给客户端组件）。
 *
 * 口径：只统计**非演示 run**；先按 run 算每个能力码的掌握度
 * `mastery = clamp((correct - 1.5×wrong - 3×incidents) / max(1, correct+wrong), 0, 1)`
 * （复用 `lib/pedagogy/competency.ts` 的公式，避免两套算法），
 * 再把各维换算成 0~100；同一维度只对有该能力码记录的 run 取算术平均。
 * 没有记录的维度 value=0 且 hasData=false，由图例标「暂无数据」。
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { incidents, runs as runsTable, timeline } from "@/db/schema";
import { computeMastery } from "@/lib/pedagogy/competency";
import { getIncident } from "@/lib/safety/registry";
import {
  averageRadarSeries,
  clampPercent,
  type RadarSeries,
} from "./radar-data";

type Counts = { correct: number; wrong: number; incidents: number };
type RunTally = Map<string, Counts>;

/** 全班五维：按 run 聚合 timeline（对错）与 incidents（按 registry 的能力码归属）。 */
export async function loadClassRadarSeries(): Promise<RadarSeries> {
  const tallies = new Map<string, RunTally>();

  function tallyOf(runId: string): RunTally {
    const existing = tallies.get(runId);
    if (existing) return existing;
    const created: RunTally = new Map();
    tallies.set(runId, created);
    return created;
  }

  function bucketOf(runId: string, code: string): Counts {
    const tally = tallyOf(runId);
    const existing = tally.get(code);
    if (existing) return existing;
    const created: Counts = { correct: 0, wrong: 0, incidents: 0 };
    tally.set(code, created);
    return created;
  }

  const timelineRows = await db
    .select({
      runId: timeline.runId,
      code: timeline.competency,
      correct: sql<number>`sum(case when ${timeline.correct} then 1 else 0 end)`.mapWith(Number),
      wrong: sql<number>`sum(case when ${timeline.correct} then 0 else 1 end)`.mapWith(Number),
    })
    .from(timeline)
    .innerJoin(runsTable, eq(timeline.runId, runsTable.id))
    .where(eq(runsTable.isDemo, false))
    .groupBy(timeline.runId, timeline.competency);

  for (const row of timelineRows) {
    const counts = bucketOf(row.runId, row.code);
    counts.correct += Number(row.correct) || 0;
    counts.wrong += Number(row.wrong) || 0;
  }

  const incidentRows = await db
    .select({
      runId: incidents.runId,
      incidentId: incidents.incidentId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(incidents)
    .innerJoin(runsTable, eq(incidents.runId, runsTable.id))
    .where(eq(runsTable.isDemo, false))
    .groupBy(incidents.runId, incidents.incidentId);

  for (const row of incidentRows) {
    const code = getIncident(row.incidentId)?.competency;
    if (!code) continue;
    bucketOf(row.runId, code).incidents += Number(row.count) || 0;
  }

  const samples: Record<string, number>[] = [];
  for (const tally of tallies.values()) {
    const sample: Record<string, number> = {};
    let touched = false;
    for (const [code, counts] of tally) {
      const attempts = counts.correct + counts.wrong;
      if (attempts === 0 && counts.incidents === 0) continue;
      const mastery = computeMastery(counts.correct, counts.wrong, counts.incidents);
      sample[code] = Math.round(clampPercent(mastery * 100));
      touched = true;
    }
    if (touched) samples.push(sample);
  }

  return averageRadarSeries(samples);
}

/**
 * 某个学生真实有记录的能力码（timeline 对错 + incidents 归属）。
 * 用来把 `StudentDetail.competency` 里的「定义占位 0」标成「暂无数据」。
 */
export async function loadStudentRecordedCodes(studentNo: string): Promise<Set<string>> {
  const codes = new Set<string>();

  const timelineRows = await db
    .select({ code: timeline.competency })
    .from(timeline)
    .innerJoin(runsTable, eq(timeline.runId, runsTable.id))
    .where(and(eq(runsTable.studentNo, studentNo), eq(runsTable.isDemo, false)))
    .groupBy(timeline.competency);

  for (const row of timelineRows) codes.add(row.code);

  const incidentRows = await db
    .select({ incidentId: incidents.incidentId })
    .from(incidents)
    .innerJoin(runsTable, eq(incidents.runId, runsTable.id))
    .where(and(eq(runsTable.studentNo, studentNo), eq(runsTable.isDemo, false)))
    .groupBy(incidents.incidentId);

  for (const row of incidentRows) {
    const code = getIncident(row.incidentId)?.competency;
    if (code) codes.add(code);
  }

  return codes;
}
