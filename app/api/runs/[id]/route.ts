/**
 * GET /api/runs/[id] —— 读一次 run 的全量（timeline / incidents / quiz / scores）
 * 学生本人或教师可读。
 */

import { loadRunBundle } from "@/lib/persist/report";
import { accessRun } from "../../_lib/access";
import { handleError, json } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    await accessRun(id);
    const bundle = await loadRunBundle(id);
    if (!bundle) return json({ ok: false, error: "RUN_NOT_FOUND" }, 404);
    return json({ ok: true, ...bundle });
  } catch (error) {
    return handleError(error);
  }
}
