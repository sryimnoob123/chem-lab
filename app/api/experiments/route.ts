/**
 * GET /api/experiments —— 实验清单（首页用，公开）
 * 响应：`{ id, title, summary, steps, hours, kind, playable, sortOrder }[]`
 */

import { listExperiments } from "@/lib/queries/experiments";
import { handleError, json } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const rows = await listExperiments();
    return json(rows);
  } catch (error) {
    return handleError(error);
  }
}
