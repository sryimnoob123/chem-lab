/**
 * POST /api/runs —— 开一次实验（同学生同实验有未完成 run 则复用）
 *
 * 请求：`{ experimentId, isDemo?, studentNo? }`（studentNo/isDemo 仅教师可用）
 * 响应：`{ ok:true, runId }`；无定义 → 404 `{ok:false,error:"EXPERIMENT_NOT_PLAYABLE"}`
 */

import { isTeacher, requireStudent } from "@/lib/session";
import { createOrReuseRun } from "@/lib/persist/runs";
import { isPlayableExperiment } from "@/lib/queries/experiments";
import { handleError, json, readJsonBody } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const student = await requireStudent();
    const body = await readJsonBody(request);
    const experimentId = typeof body.experimentId === "string" ? body.experimentId.trim() : "";
    if (!experimentId) return json({ ok: false, error: "EXPERIMENT_ID_REQUIRED" }, 400);
    if (!isPlayableExperiment(experimentId)) {
      return json({ ok: false, error: "EXPERIMENT_NOT_PLAYABLE" }, 404);
    }

    const teacher = await isTeacher();
    const requestedStudentNo = typeof body.studentNo === "string" ? body.studentNo.trim() : "";
    const studentNo = teacher && requestedStudentNo ? requestedStudentNo : student.studentNo;
    const isDemo = teacher && body.isDemo === true;

    const runId = await createOrReuseRun({ experimentId, studentNo, isDemo });
    return json({ ok: true, runId });
  } catch (error) {
    return handleError(error);
  }
}
