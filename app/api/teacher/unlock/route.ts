/**
 * POST /api/teacher/unlock —— 教师口令解锁（种 chem_teacher cookie）
 * 响应：`{ok:true}` / `401 {ok:false,error:"INVALID_PASSCODE"}`
 */

import { unlockTeacher } from "@/lib/session";
import { handleError, json, readJsonBody } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const passcode = typeof body.passcode === "string" ? body.passcode : "";
    const unlocked = await unlockTeacher(passcode);
    if (!unlocked) return json({ ok: false, error: "INVALID_PASSCODE" }, 401);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
