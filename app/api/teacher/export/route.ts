/**
 * GET /api/teacher/export —— 学情 CSV（UTF-8 BOM，Excel 直开）
 *
 * 列：学号,姓名,班级,实验,状态,完成度,操作分,报告分,总分,事故数,最近活跃
 * 无需 query；教师 cookie 鉴权。
 */

import { requireTeacher } from "@/lib/session";
import { buildExportCsv, exportFileName } from "@/lib/queries/export";
import { handleError } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await requireTeacher();
    const csv = await buildExportCsv();
    const filename = exportFileName();
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="chem-lab-grade.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
