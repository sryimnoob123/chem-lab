/**
 * POST /api/plans —— 保存拼接式方案设计
 *
 * 请求：`{ experimentId?, runId?, params:{pieces:string[]}, feasible, score,
 *          issues:[{ruleId,level,text}], assessment?, assessmentOffline? }`
 * 响应：`{ ok:true, planId }`
 */

import { requireStudent } from "@/lib/session";
import { createPlan } from "@/lib/persist/plans";
import { handleError, json, readJsonBody } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const student = await requireStudent();
    const body = await readJsonBody(request);
    const planId = await createPlan(student.studentNo, body);
    return json({ ok: true, planId });
  } catch (error) {
    return handleError(error);
  }
}
