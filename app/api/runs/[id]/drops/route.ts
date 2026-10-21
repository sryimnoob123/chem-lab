/**
 * POST /api/runs/[id]/drops —— 场景投放审计（不参与状态机）
 *
 * 请求：`{ kind:"drop", reagentId, vesselId, inputMode, outcome?, reactionText? }`
 * 响应：`{ ok:true, drop:{ stepIndex, seq, ... } }`
 */

import { appendRunDrop } from "@/lib/persist/drops";
import { accessRun } from "../../../_lib/access";
import { handleError, json, readJsonBody } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    await accessRun(id);
    const body = await readJsonBody(request);
    const drop = await appendRunDrop(id, body);
    return json({ ok: true, drop });
  } catch (error) {
    return handleError(error);
  }
}
