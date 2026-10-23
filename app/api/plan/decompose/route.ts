/**
 * POST /api/plan/decompose —— 把一个实验主题拆成 4 段粗粒度任务块
 *
 * 请求：`{ topicId: string }`
 * 响应：`{ ok, source: "llm" | "template", phases: [{ id, title, note, pieceIds }] }`
 *
 * 有模型凭据时只让它**重写段标题与一句要点**（块归属永远来自 `lib/plan/decompose.ts` 的模板）——
 * 模型乱分组会把「基准物」分到滴定段，规则解释跟着一起错；标题说歪了顶多是文案不好看。
 *
 * 没有凭据 / 超时 / 返回格式不对：一律回落模板，`source` 告诉前端「这是模板拆的」。
 * 前端**不区分**两套 UI，只在角落标一个来源（用户口径：不要两套界面）。
 */

import { requireStudent } from "@/lib/session";
import { getTopic } from "@/lib/plan/topics";
import { complete, llmEnabled } from "@/lib/plan/llm-assess";
import { buildDecomposePrompt, parseDecompose, templatePhases } from "@/lib/plan/decompose";
import { handleError, json, readJsonBody } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireStudent();
    const body = await readJsonBody(request);
    const topic = getTopic(typeof body.topicId === "string" ? body.topicId : null);
    const phases = templatePhases(topic);

    if (!topic || !llmEnabled() || phases.length === 0) {
      return json({ ok: true, source: "template", phases });
    }

    const raw = await complete(buildDecomposePrompt(topic, phases)).catch(() => null);
    const parsed = raw ? parseDecompose(raw, phases) : null;
    return json({ ok: true, source: parsed ? "llm" : "template", phases: parsed ?? phases });
  } catch (error) {
    return handleError(error);
  }
}
