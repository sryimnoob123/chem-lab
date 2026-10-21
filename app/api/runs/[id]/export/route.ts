/**
 * GET /api/runs/[id]/export —— 单个 run 的实验记录 CSV（学生本人可下）
 *
 * 为什么放在报告页：用户要求"做完实验给他们一个导出的表格"。
 * 与教师端 `/api/teacher/export`（全班学情）区分：这里只导出**这一次实验**的
 * 概览 + 完整时间线，学生可以自己存档/交给老师。
 *
 * 列：段, 步序, 时间, 动作, 选择, 正确, 扣分, 详情
 * 首段是 6 行 key-value 概览，第二段是时间线明细。
 */

import { getStudent } from "@/lib/session";
import { loadRunBundle } from "@/lib/persist/report";
import { formatDateTime, toCsv, type CsvValue } from "@/lib/queries/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ACTION_LABEL: Record<string, string> = {
  drop: "投放试剂",
  choice: "选择操作",
  retry: "重做本步",
  finish: "交卷",
  hint: "取提示",
};

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const student = await getStudent();
  if (!student) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const bundle = await loadRunBundle(id);
  if (!bundle) {
    return Response.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });
  }
  // 只允许本人导出；教师端有自己的全班导出
  if (bundle.run.studentNo !== student.studentNo) {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { run, scores, incidents, timeline } = bundle;
  const finishedMinutes =
    run.finishedAt && run.startedAt
      ? Math.max(1, Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 60000))
      : 0;

  const rows: CsvValue[][] = [
    ["概览"],
    ["实验", run.experimentId],
    ["学号", student.studentNo],
    ["姓名", student.name],
    ["状态", run.status === "finished" ? "已完成" : "进行中"],
    ["开始时间", formatDateTime(run.startedAt)],
    ["结束时间", run.finishedAt ? formatDateTime(run.finishedAt) : ""],
    ["用时(分钟)", finishedMinutes],
    ["操作分", scores.operation ?? ""],
    ["报告分", scores.report ?? ""],
    ["总分", scores.total ?? ""],
    ["事故数", incidents.length],
    [],
    ["时间线"],
    ["步序", "时间", "动作", "选择", "是否正确", "扣分", "详情"],
  ];

  for (const row of timeline) {
    rows.push([
      row.stepIndex + 1,
      formatDateTime(row.at),
      ACTION_LABEL[row.actionType] ?? row.actionType,
      row.choiceId ?? "",
      row.correct === null || row.correct === undefined ? "" : row.correct ? "对" : "错",
      row.deduct ?? 0,
      row.payload ? String(row.payload).slice(0, 160) : "",
    ]);
  }

  if (incidents.length) {
    rows.push([], ["事故"]);
    rows.push(["步序", "时间", "类型", "说明"]);
    for (const item of incidents) {
      rows.push([
        item.stepIndex + 1,
        formatDateTime(item.at),
        item.incidentId,
        item.label,
      ]);
    }
  }

  const csv = toCsv(rows);
  const filename = `chem-lab-${run.experimentId}-${student.studentNo}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
