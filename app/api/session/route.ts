/**
 * POST   /api/session  —— 学生登录（学号 + 姓名，校验教务白名单，种签名 cookie）
 * GET    /api/session  —— 读当前登录学生（页面初始化用）
 * DELETE /api/session  —— 学生登出
 *
 * 响应：`{ ok:true, student:{studentNo,name,className} }` / `403 {ok:false,error:"NOT_IN_ROSTER"}`
 * 未登录时 GET 返回 `401 {ok:false,error:"UNAUTHORIZED"}`（前端据此跳登录页）。
 */

import { getStudent, signIn, signOut } from "@/lib/session";
import { handleError, json, readJsonBody } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const studentNo = typeof body.studentNo === "string" ? body.studentNo : "";
    const name = typeof body.name === "string" ? body.name : "";
    if (!studentNo.trim() || !name.trim()) {
      return json({ ok: false, error: "MISSING_CREDENTIALS" }, 400);
    }

    const student = await signIn(studentNo, name);
    if (!student) return json({ ok: false, error: "NOT_IN_ROSTER" }, 403);
    return json({ ok: true, student });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(): Promise<Response> {
  try {
    const student = await getStudent();
    if (!student) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    return json({ ok: true, student });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(): Promise<Response> {
  try {
    await signOut();
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
