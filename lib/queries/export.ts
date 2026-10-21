/**
 * lib/queries/export.ts —— 教师端学情 CSV 导出
 *
 * 列（Lead 确认）：学号,姓名,班级,实验,状态,完成度,操作分,报告分,总分,事故数,最近活跃
 * 口径：每个学生取最近一次非演示 run；实验列用 experiments.title（取不到回落 id）。
 */

import { db } from "@/lib/db";
import { experiments, students } from "@/db/schema";
import { fileDateStamp, formatDateTime, toCsv, type CsvValue } from "./csv";
import {
  lastActiveOf,
  loadExperimentSteps,
  loadRunAggregates,
  loadRuns,
  progressOf,
  type RunRow,
} from "./teacher-shared";

const STATUS_LABEL: Record<string, string> = {
  finished: "已完成",
  in_progress: "进行中",
};

const HEADER: CsvValue[] = [
  "学号",
  "姓名",
  "班级",
  "实验",
  "状态",
  "完成度",
  "操作分",
  "报告分",
  "总分",
  "事故数",
  "最近活跃",
];

function statusLabel(run: RunRow | undefined): string {
  if (!run) return "未开始";
  return STATUS_LABEL[run.status] ?? "进行中";
}

/** 生成导出 CSV 文本（含 BOM）。 */
export async function buildExportCsv(): Promise<string> {
  const studentRows = await db
    .select({
      studentNo: students.studentNo,
      name: students.name,
      className: students.className,
    })
    .from(students)
    .orderBy(students.studentNo);

  const runRows = await loadRuns({ includeDemo: false });
  const latestByStudent = new Map<string, RunRow>();
  for (const run of runRows) {
    const current = latestByStudent.get(run.studentNo);
    if (!current || run.startedAt.getTime() > current.startedAt.getTime()) {
      latestByStudent.set(run.studentNo, run);
    }
  }

  const aggregates = await loadRunAggregates(runRows.map((run) => run.runId));
  const stepsByExp = await loadExperimentSteps();

  const experimentRows = await db
    .select({ id: experiments.id, title: experiments.title })
    .from(experiments);
  const titleById = new Map(experimentRows.map((row) => [row.id, row.title]));

  const incidentTotalByStudent = new Map<string, number>();
  for (const run of runRows) {
    const count = aggregates.get(run.runId)?.incidentCount ?? 0;
    incidentTotalByStudent.set(run.studentNo, (incidentTotalByStudent.get(run.studentNo) ?? 0) + count);
  }

  const rows: CsvValue[][] = [HEADER];
  for (const student of studentRows) {
    const latest = latestByStudent.get(student.studentNo);
    const aggregate = latest ? aggregates.get(latest.runId) : undefined;
    const totalSteps = latest ? stepsByExp.get(latest.experimentId) ?? 0 : 0;
    rows.push([
      student.studentNo,
      student.name,
      student.className,
      latest ? titleById.get(latest.experimentId) ?? latest.experimentId : "",
      statusLabel(latest),
      latest ? progressOf(latest.status, aggregate?.coveredSteps ?? 0, totalSteps) : 0,
      latest?.scoreOp ?? "",
      latest?.scoreReport ?? "",
      latest?.totalScore ?? "",
      incidentTotalByStudent.get(student.studentNo) ?? 0,
      latest ? formatDateTime(lastActiveOf(latest, aggregate)) : "",
    ]);
  }

  return toCsv(rows);
}

/** 下载文件名：chem-lab-学情-YYYYMMDD.csv */
export function exportFileName(now: Date = new Date()): string {
  return `chem-lab-学情-${fileDateStamp(now)}.csv`;
}
