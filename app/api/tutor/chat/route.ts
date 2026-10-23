/**
 * POST /api/tutor/chat —— 操作台右下角 AI 助教的对话后台。
 *
 * 用户 2026-10-23：先把接口做好，部署到扣子之后再接大模型。
 * 所以这里的设计原则是**没接模型也能用**：
 *   - 有凭据（COZE_API_TOKEN + COZE_BOT_ID，或 COZE_LLM_URL / ARK_API_KEY / DEEPSEEK_API_KEY）
 *     → 走 lib/plan/llm-assess.ts 同一套 provider，返回真回复；
 *   - 没凭据 / 超时 / 报错 → 返回 `fallback: "offline"` + 本地兜底话术，前端照常显示。
 *
 * 请求：`{ question: string, step?: string, experimentId?: string }`
 * 响应：`{ ok, reply, provider, llm, fallback? }`
 *
 * 提示词只给"这一步在干什么"和"不要替学生做作业"这两条底线，
 * 素材块 / 规则细节不往模型里塞 —— 助教是答疑，不是把答案念一遍。
 */

import { requireStudent } from "@/lib/session";
import { complete, llmEnabled, providerOf } from "@/lib/plan/llm-assess";
import { handleError, json, readJsonBody } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION = 400;
const OFFLINE_REPLY = (step: string) =>
  step
    ? `还没接上大模型，我只能说到这里：现在这步是「${step}」。具体做法看右侧「看原因 / 提示」。`
    : "还没接上大模型。具体做法看右侧「看原因 / 提示」。";

function buildTutorPrompt(question: string, step: string, experimentId: string): string {
  return [
    "你是大一《无机及分析化学》实验课的助教，学生在虚拟实验台上操作，随时会来问你。",
    experimentId ? `【实验】${experimentId}` : "",
    step ? `【当前步骤】${step}` : "",
    `【学生的问题】${question}`,
    "【回答要求】",
    "1. 先给结论或下一步动作，再说为什么；最多 4 句，不要 Markdown，不要分点编号。",
    "2. 只讲规范与原理，不直接给出应填的数值或最终答案；学生自己读数、自己算。",
    "3. 涉及安全（浓酸稀释、加热、有毒气体）必须先说防护与操作顺序。",
    "4. 不确定就说不知道，不要编造数据或文献。",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireStudent();
    const body = await readJsonBody(request);
    const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
    const step = typeof body.step === "string" ? body.step.slice(0, 80) : "";
    const experimentId = typeof body.experimentId === "string" ? body.experimentId.slice(0, 24) : "";

    if (!question) {
      return json({ ok: false, error: "question 不能为空" }, 400);
    }

    const provider = providerOf();
    if (provider === "mock") {
      return json({ ok: true, llm: false, provider, reply: OFFLINE_REPLY(step), fallback: "offline" });
    }

    const reply = await complete(buildTutorPrompt(question, step, experimentId));
    if (!reply) {
      return json({ ok: true, llm: llmEnabled(), provider, reply: OFFLINE_REPLY(step), fallback: "offline" });
    }
    return json({ ok: true, llm: true, provider, reply: reply.slice(0, 800) });
  } catch (error) {
    return handleError(error);
  }
}
