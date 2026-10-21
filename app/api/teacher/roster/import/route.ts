/**
 * POST /api/teacher/roster/import —— 名单导入（CSV 文本）
 *
 * 接收：`multipart/form-data`（`file` 或 `csv` 字段）或 `text/plain` / `text/csv` body。
 * 响应：`{ ok:true, imported, skipped, errors[] }`
 */

import { requireTeacher } from "@/lib/session";
import { importRoster } from "@/lib/queries/roster";
import { handleError, json } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readCsvText(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File) return file.text();
    const csv = form.get("csv");
    return typeof csv === "string" ? csv : "";
  }
  return request.text();
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireTeacher();
    const text = await readCsvText(request);
    if (!text.trim()) return json({ ok: false, error: "EMPTY_CSV" }, 400);

    const result = await importRoster(text);
    return json({ ok: true, ...result });
  } catch (error) {
    return handleError(error);
  }
}
