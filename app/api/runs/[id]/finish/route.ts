/**
 * POST /api/runs/[id]/finish —— 交卷
 *
 * 服务端按 timeline 重放并用 lib/pedagogy/scoring.ts 结算，
 * 写 runs.status="finished" + finishedAt + 三段分/总分/score_detail，返回报告数据。
 * 幂等：已交卷直接返回原报告，不重复扣分。
 *
 * 预习分不再有「演示按满分」特例（2026-10-24 收掉 `?auto=1` override）：
 * 前测答案由 POST /api/runs/[id]/quiz 真实落库，交卷时按 quiz_answers 的正确率结算，
 * 真实学生与演示路径同一口径。
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
    const bundle = await finishRun(id);
    return json({ ok: true, ...buildReportPayload(bundle) });
  } catch (error) {
    return handleError(error);
  }
}
