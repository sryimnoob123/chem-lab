/**
 * POST /api/runs/[id]/events —— 批量提交动作（服务端重算 state）
 *
 * 请求：`{ events: Action[] }`
 * 响应：`{ ok:true, state, events, incidents }`
 *   - state：重算后的完整 ExperimentState；
 *   - events：本批产生的引擎事件（invalid 也会原样返回，供前端提示）；
 *   - incidents：本批新落库的事故（幂等，重复提交为空数组）。
 */

import { appendRunDrop } from "@/lib/persist/drops";
import { appendRunEvents } from "@/lib/persist/events";
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
    // 兼容直接复用本入口上报投放审计：{ kind:"drop", ... }。
    // 旧的动作批量语义 { events: Action[] } 完全不变。
    if (body.kind === "drop") {
      const drop = await appendRunDrop(id, body);
      return json({ ok: true, drop });
    }
    const result = await appendRunEvents(id, body.events);
    return json({
      ok: true,
      state: result.state,
      events: result.events,
      incidents: result.incidents,
    });
  } catch (error) {
    return handleError(error);
  }
}
