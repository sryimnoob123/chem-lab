/**
 * POST /api/plan/assess —— 拼接方案的点评（规则给分 + AI/本地点评）
 *
 * 请求：`{ pieces: string[], params?: Record<string, unknown>, topicId?: string }`
 * 响应：`{ ok, provider, llm, text, points:[{kind,pieceId?,ruleId?,text}], questions:[],
 *          score, feasible, fallback? }`
 *
 * 分工（用户 2026-10-22）：分数永远来自规则引擎（`lib/plan/rules.ts` + `topics.ts`）；
 * `lib/plan/llm-assess.ts` 只负责把"哪里对、哪里不行"讲成人话，并指到具体片段。
 * provider 由环境变量切换（`PLAN_ASSESS_PROVIDER=mock|coze|ark`，缺省按凭据自动判断）：
 *   COZE_API_TOKEN + COZE_BOT_ID → 扣子豆包；COZE_LLM_URL + key → OpenAI 兼容端点。
 * 云端失败一律回退本地点评，`fallback` 告诉前端为什么（UI 标「离线点评」）。
 */

import { requireStudent } from "@/lib/session";
import type { PlanInput } from "@/lib/plan/pieces";
import { validate } from "@/lib/plan/rules";
import { applyTopic, getTopic } from "@/lib/plan/topics";
import { assessPlan, llmEnabled } from "@/lib/plan/llm-assess";
import { handleError, json, readJsonBody } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireStudent();
    const body = await readJsonBody(request);
    const pieces = Array.isArray(body.pieces)
      ? body.pieces.filter((item): item is string => typeof item === "string")
      : [];
    const params =
      body.params && typeof body.params === "object" && !Array.isArray(body.params)
        ? (body.params as PlanInput["params"])
        : {};
    const topic = getTopic(typeof body.topicId === "string" ? body.topicId : null);

    const plan: PlanInput = { pieces, params };
    const report = applyTopic(validate(plan), plan, topic);
    const assessment = await assessPlan(plan, report, topic);

    return json({
      ok: true,
      provider: assessment.provider,
      llm: llmEnabled(),
      text: assessment.text,
      points: assessment.points,
      questions: assessment.questions,
      fallback: assessment.fallback,
      /** 最终分：模型给了就用模型的（已按规则封顶），否则回落规则分 */
      score: assessment.score ?? report.score,
      scoreSource: assessment.score === undefined ? "rule" : "llm",
      dimensions: assessment.dimensions ?? [],
      /** 规则分留着做参照（前端不显示，排查用） */
      ruleScore: report.score,
      feasible: report.feasible,
    });
  } catch (error) {
    return handleError(error);
  }
}
