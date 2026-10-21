/**
 * GET /api/report/[runId] —— 报告页数据（不含逐条 timeline，其余同 GET /api/runs/[id]）
 * 学生本人或教师可读。
 */

import { buildReportPayload, loadRunBundle } from "@/lib/persist/report";
import { accessRun } from "../../_lib/access";
import { handleError, json } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await params;
    await accessRun(runId);
    const bundle = await loadRunBundle(runId);
    if (!bundle) return json({ ok: false, error: "RUN_NOT_FOUND" }, 404);
    return json({ ok: true, ...buildReportPayload(bundle) });
  } catch (error) {
    return handleError(error);
  }
}
