/**
 * GET /api/plans/[id] —— 读回一条方案（本人或教师）
 */

import { isTeacher, requireStudent } from "@/lib/session";
import { loadPlan } from "@/lib/persist/plans";
import { handleError, json } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const plan = await loadPlan(id);
    if (!plan) return json({ ok: false, error: "PLAN_NOT_FOUND" }, 404);

    if (!(await isTeacher())) {
      const student = await requireStudent();
      if (student.studentNo !== plan.studentNo) {
        return json({ ok: false, error: "FORBIDDEN" }, 403);
      }
    }
    return json({ ok: true, plan });
  } catch (error) {
    return handleError(error);
  }
}
