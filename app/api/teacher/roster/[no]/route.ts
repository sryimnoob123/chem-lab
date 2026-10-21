/**
 * DELETE /api/teacher/roster/[no] —— 删除名单里的一个学生
 * 成功 `{ok:true}`；不存在 `404 {ok:false,error:"NOT_FOUND"}`。
 * 历史 runs/timeline 保留（学情不丢）。
 */

import { requireTeacher } from "@/lib/session";
import { deleteRosterStudent } from "@/lib/queries/roster";
import { handleError, json } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ no: string }> },
): Promise<Response> {
  try {
    await requireTeacher();
    const { no } = await params;
    const deleted = await deleteRosterStudent(decodeURIComponent(no));
    if (!deleted) return json({ ok: false, error: "NOT_FOUND" }, 404);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
