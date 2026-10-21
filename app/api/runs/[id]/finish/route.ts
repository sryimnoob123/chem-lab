/**
 * POST /api/runs/[id]/finish —— 交卷
 *
 * 服务端按 timeline 重放并用 lib/pedagogy/scoring.ts 结算，
 * 写 runs.status="finished" + finishedAt + 三段分/总分/score_detail，返回报告数据。
 * 幂等：已交卷直接返回原报告，不重复扣分。
 */

import { finishRun, buildReportPayload } from "@/lib/persist/report";
import { accessRun } from "../../../_lib/access";
import { handleError, json } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    await accessRun(id);
    // ?auto=1（一键演示）：预习门禁被绕过，预习分按满分落库，
    // 保证教师端 / 报告页 / 导出读的是同一份数据。
    const autoDemo = new URL(request.url).searchParams.get("auto") === "1";
    const bundle = await finishRun(id, autoDemo ? { preview: 100 } : undefined);
    return json({ ok: true, ...buildReportPayload(bundle) });
  } catch (error) {
    return handleError(error);
  }
}
