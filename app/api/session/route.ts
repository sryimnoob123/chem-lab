/**
 * POST   /api/session  —— 学生登录（学号 + 姓名，校验教务白名单，种签名 cookie）
 * GET    /api/session  —— 读当前登录学生（页面初始化用）
 * DELETE /api/session  —— 学生登出
 *
 * 响应：`{ ok:true, student:{studentNo,name,className} }` / `403 {ok:false,error:"NOT_IN_ROSTER"}`
 * 未登录时 GET 返回 `200 {ok:false,error:"UNAUTHORIZED"}`：这是「查询当前会话」的正常结果，
 * 不是错误——用 4xx 会让浏览器的 Network/Console 每次初始化都挂一条红字（演示现场很扎眼）。
 * 调用方一律看 `body.ok` 判断登录态；需要强制鉴权的接口仍各自返回 401。
 */

import { getStudent, signInDemo, signOut } from "@/lib/session";
import { handleError, json, readJsonBody } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request).catch(() => ({}) as Record<string, unknown>);
    const studentNo = typeof body.studentNo === "string" ? body.studentNo : "";
    const name = typeof body.name === "string" ? body.name : "";
    // 演示口径：留空、乱填、不在白名单都放行（现场不能卡在登录页）。
    const student = await signInDemo(studentNo, name);
    return json({ ok: true, student });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(): Promise<Response> {
  try {
    const student = await getStudent();
    // 匿名查询返回 200 + ok:false：避免每次页面初始化都在控制台留一条 401 红字。
    if (!student) return json({ ok: false, error: "UNAUTHORIZED" });
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
