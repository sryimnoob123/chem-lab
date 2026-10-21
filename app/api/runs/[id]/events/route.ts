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
import { appendRunEvents, appendRunHint } from "@/lib/persist/events";
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
    // 学生主动取提示（灯泡 / 键盘 H / 空闲自动）：{ kind:"hint", hint:{ stepIndex, level, competency? } }。
    // 落一条 timeline 审计行，交卷时按 1/3/5 计入独立完成度。
    if (body.kind === "hint") {
      const hint = await appendRunHint(id, body.hint ?? body);
      return json({ ok: true, hint });
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
