/**
 * GET /api/teacher/roster —— 名单列表（分页 + `?q=` 搜索）
 * 响应：`{ ok:true, rows:[{studentNo,name,className,createdAt,hasRun}], total, loggedIn }`
 */

import { requireTeacher } from "@/lib/session";
import { listRoster } from "@/lib/queries/roster";
import { handleError, json, readIntParam } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireTeacher();
    const url = new URL(request.url);
    const result = await listRoster({
      q: url.searchParams.get("q") ?? "",
      limit: readIntParam(url, "limit"),
      offset: readIntParam(url, "offset"),
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return handleError(error);
  }
}
