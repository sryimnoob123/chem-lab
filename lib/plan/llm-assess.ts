/**
 * 拼接方案的 AI 点评 —— **唯一一条点评链路**（provider: mock | coze | ark）。
 *
 * 分工（用户 2026-10-22 口径）：
 *   规则引擎给分（lib/plan/rules.ts + topics.ts，离线、可解释、永远可用）；
 *   AI 只做点评与追问，**不负责给分**。
 *
 * provider 由 `PLAN_ASSESS_PROVIDER` 选，缺省 auto：
 *   - `COZE_API_TOKEN` + `COZE_BOT_ID` → coze（扣子 v3 chat：发起 → 轮询 → 取消息）；
 *   - `COZE_LLM_URL` + key（`COZE_LLM_KEY` / `COZE_LLM_API_KEY` / `DEEPSEEK_API_KEY` / `ARK_API_KEY`）
 *     → ark（OpenAI 兼容 `/chat/completions`，豆包方舟 / DeepSeek / 自建网关都能走）；
 *   - 其余 → mock（本地点评，`assess-mock.ts`）。
 *
 * 硬约束（演示优先）：**永不 throw**。超时（12 s 封顶）、限流、断网、空回复、坏 JSON
 * 一律回退本地点评，并用 `fallback` 告诉 UI「离线点评」的原因。
 *
 * 所有 provider 返回同一形状：
 *   { provider, text, points:[{kind, pieceId?, ruleId?, text}], questions, fallback?, pointsFrom? }
 */

import { PIECES_BY_ID, type PlanInput } from "./pieces";
import { RULES_BY_CODE, type PlanReport } from "./rules";
import type { PlanTopic } from "./topics";
import {
  mockAssess,
  type AssessFallback,
  type AssessPoint,
  type AssessProvider,
  type LlmAssessResult,
} from "./assess-mock";

export type { AssessFallback, AssessPoint, AssessPointKind, AssessProvider, LlmAssessResult } from "./assess-mock";
export { mockAssess } from "./assess-mock";

/** 12 s 上限：比原来的 8 s 宽一点给豆包轮询，但演示绝不能卡更久 */
export const TIMEOUT_MS = 12_000;
const COZE_POLL_MS = Math.max(100, Number(process.env.COZE_POLL_MS ?? 300) || 300);

class HttpError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message ?? `http-${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}
class EmptyAnswerError extends Error {
  constructor(message = "empty-answer") {
    super(message);
    this.name = "EmptyAnswerError";
  }
}
class DeadlineError extends Error {
  constructor() {
    super("deadline-exceeded");
    this.name = "TimeoutError";
  }
}

function reasonOf(error: unknown): AssessFallback {
  // fetch 连不上（DNS / 连接被拒 / 代理断）抛的是 TypeError，别当成"格式不对"
  if (error instanceof TypeError) return "network";
  if (error instanceof HttpError) return error.status === 429 ? "rate-limit" : "http";
  if (error instanceof EmptyAnswerError) return "empty";
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  return "error";
}

/** 每次请求都按剩余预算设超时，保证整条链路 ≤ TIMEOUT_MS */
function signalUntil(deadline: number): AbortSignal {
  return AbortSignal.timeout(Math.max(400, deadline - Date.now()));
}

/* ── prompt：随主题变 ─────────────────────────────────────────────── */

function pieceTitle(id: string): string {
  return PIECES_BY_ID[id]?.title ?? id;
}

/**
 * 把「主题 + 块 + 参数 + 规则判定」摊开给模型，避免它凭空猜。
 * 主题决定 prompt：标题/情境/目标/该主题的规则子集都进提示词。
 */
export function buildPrompt(plan: PlanInput, report: PlanReport, topic?: PlanTopic): string {
  const lines: string[] = [
    "你在点评大一《无机及分析化学》实验课的一份「拼接式方案」。学生从素材库挑块拼流程，本地规则引擎已经判过一遍。",
  ];

  if (topic) {
    lines.push(`【主题】${topic.title}（难度：${topic.level}）`);
    lines.push(`【情境】${topic.scene}`);
    lines.push(`【目标】${topic.goal}`);
    lines.push("【本主题硬约束】");
    for (const constraint of topic.constraints) {
      const rule = topic.rules.find((item) => item.code === constraint.ruleCode);
      const level = rule?.level === "block" ? "硬约束" : "扣分项";
      lines.push(`- ${constraint.text}（${constraint.ruleCode} / ${level}）`);
    }
  } else {
    lines.push("【主题】学生没有选主题，按基础 21 条规则点评。");
  }

  lines.push(`【学生放入的块】共 ${plan.pieces.length} 块，顺序即流程：`);
  if (plan.pieces.length === 0) {
    lines.push("- 空");
  } else {
    plan.pieces.forEach((id, index) => {
      lines.push(`${index + 1}. ${pieceTitle(id)}（${id}）`);
    });
  }

  const params = plan.params ? Object.entries(plan.params) : [];
  lines.push("【参数】");
  if (params.length === 0) {
    lines.push("- 无");
  } else {
    for (const [key, value] of params) lines.push(`- ${key} = ${String(value)}`);
  }

  lines.push("【规则引擎判定】");
  lines.push(
    `- 得分 ${report.score}/100；可执行=${report.feasible ? "是" : "否"}；硬约束 ${report.blockCount} 条、扣分项 ${report.warnCount} 条`,
  );

  lines.push("【未通过】");
  if (report.issues.length === 0) {
    lines.push("- 无");
  } else {
    for (const issue of report.issues.slice(0, 10)) {
      lines.push(`- [${issue.level}] ${issue.ruleId}：${issue.text}（${issue.hint}）`);
    }
  }

  lines.push(`【已通过】${report.passed.length > 0 ? report.passed.slice(0, 15).join("、") : "无"}`);

  lines.push("【写作要求】");
  lines.push("1. 结论先行：第一句就说这份方案能不能进操作台，不要铺垫。");
  lines.push("2. 只依据上面的判定说话：不要复述规则原文，不要编造化学计量关系、浓度或数据。");
  lines.push("3. points 必须点名具体素材块（pieceId）或规则（ruleId）；pieceId / ruleId 只能取上面出现过的值。");
  lines.push("4. questions 最多 2 条，必须能推动学生改方案（问变量、问依据、问怎么排除）。");
  lines.push("5. 中文，text 不超过 120 字，不要 Markdown。");
  lines.push(
    '【输出】只输出 JSON：{"text":"…","points":[{"kind":"good|risk|todo","pieceId":"piece-…","ruleId":"…","text":"…"}],"questions":["…"]}',
  );
  return lines.join("\n");
}

/* ── 解析模型输出 ─────────────────────────────────────────────────── */

function plainText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .trim();
}

function sanitizePoints(value: unknown, topic: PlanTopic | undefined): AssessPoint[] {
  if (!Array.isArray(value)) return [];
  const points: AssessPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const kind = raw.kind;
    const text = typeof raw.text === "string" ? plainText(raw.text) : "";
    if ((kind !== "good" && kind !== "risk" && kind !== "todo") || !text) continue;
    const pieceId = typeof raw.pieceId === "string" && PIECES_BY_ID[raw.pieceId] ? raw.pieceId : undefined;
    const ruleId =
      typeof raw.ruleId === "string" &&
      (RULES_BY_CODE[raw.ruleId] !== undefined || topic?.rules.some((rule) => rule.code === raw.ruleId))
        ? raw.ruleId
        : undefined;
    if (!pieceId && !ruleId) continue; // 指不到块或规则的要点不收
    points.push({ kind, pieceId, ruleId, text: text.slice(0, 160) });
    if (points.length === 5) break;
  }
  return points;
}

function sanitizeQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 120))
    .slice(0, 2);
}

/**
 * 模型可能不听话：先按 JSON 解析；不是 JSON 就把整段当点评文本（points 交给本地兜底）。
 * 导出给单测，坏 JSON 的行为必须可验证。
 */
export function parseModelAnswer(
  raw: string,
  topic?: PlanTopic,
): { text: string; points: AssessPoint[]; questions: string[] } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      const text = typeof parsed.text === "string" ? plainText(parsed.text) : "";
      if (text) {
        return {
          text: text.slice(0, 600),
          points: sanitizePoints(parsed.points, topic),
          questions: sanitizeQuestions(parsed.questions),
        };
      }
    } catch {
      // 落到下面：当成纯文本
    }
  }
  return { text: plainText(cleaned).slice(0, 600), points: [], questions: [] };
}

/* ── 云端 provider ────────────────────────────────────────────────── */

type CozeEnvelope<T> = { code?: number; msg?: string; data?: T };

/** 扣子 v3 chat：发起 → 轮询 retrieve 到 completed → 取 message/list 里的 answer */
async function callCoze(prompt: string, deadline: number): Promise<string> {
  const token = (process.env.COZE_API_TOKEN ?? "").trim();
  const botId = (process.env.COZE_BOT_ID ?? "").trim();
  if (!token || !botId) throw new EmptyAnswerError("no-coze-credentials");
  const base = (process.env.COZE_API_BASE ?? "https://api.coze.cn").replace(/\/+$/, "");
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };

  const startRes = await fetch(`${base}/v3/chat`, {
    method: "POST",
    headers,
    signal: signalUntil(deadline),
    body: JSON.stringify({
      bot_id: botId,
      user_id: "chem-lab",
      stream: false,
      auto_save_history: false,
      additional_messages: [{ role: "user", content: prompt, content_type: "text" }],
    }),
  });
  if (!startRes.ok) throw new HttpError(startRes.status);
  const start = (await startRes.json()) as CozeEnvelope<{ id?: string; conversation_id?: string; status?: string }>;
  if (start.code !== 0) throw new HttpError(start.code === 4290 ? 429 : 400, `coze-${start.code}`);
  const chatId = start.data?.id;
  const conversationId = start.data?.conversation_id;
  if (!chatId || !conversationId) throw new EmptyAnswerError("coze-no-chat-id");

  const query = new URLSearchParams({ conversation_id: conversationId, chat_id: chatId }).toString();
  let status = start.data?.status ?? "in_progress";
  while (status !== "completed") {
    if (status === "failed" || status === "requires_action" || status === "canceled") {
      throw new EmptyAnswerError(`coze-${status}`);
    }
    if (Date.now() + COZE_POLL_MS >= deadline) throw new DeadlineError();
    await new Promise((resolve) => setTimeout(resolve, COZE_POLL_MS));
    const retrieveRes = await fetch(`${base}/v3/chat/retrieve?${query}`, { headers, signal: signalUntil(deadline) });
    if (!retrieveRes.ok) throw new HttpError(retrieveRes.status);
    const retrieve = (await retrieveRes.json()) as CozeEnvelope<{ status?: string }>;
    if (retrieve.code !== 0) throw new EmptyAnswerError(`coze-${retrieve.code}`);
    status = retrieve.data?.status ?? status;
  }

  const listRes = await fetch(`${base}/v3/chat/message/list?${query}`, { headers, signal: signalUntil(deadline) });
  if (!listRes.ok) throw new HttpError(listRes.status);
  const list = (await listRes.json()) as CozeEnvelope<Array<{ type?: string; content?: string; content_type?: string }>>;
  if (list.code !== 0) throw new EmptyAnswerError(`coze-${list.code}`);
  const answer = list.data?.find(
    (item) => item.type === "answer" && typeof item.content === "string" && item.content.trim().length > 0,
  );
  if (!answer?.content) throw new EmptyAnswerError("coze-no-answer");
  return answer.content.trim();
}

type OpenAiTarget = { url: string; apiKey: string; model: string };

/** OpenAI 兼容端点：COZE_LLM_URL 优先，其次方舟 / DeepSeek */
function resolveOpenAiTarget(): OpenAiTarget | undefined {
  const explicitUrl = (process.env.COZE_LLM_URL ?? "").trim();
  if (explicitUrl) {
    const key = (
      process.env.COZE_LLM_KEY ??
      process.env.COZE_LLM_API_KEY ??
      process.env.DEEPSEEK_API_KEY ??
      process.env.ARK_API_KEY ??
      ""
    ).trim();
    if (!key) return undefined;
    return { url: explicitUrl, apiKey: key, model: (process.env.COZE_LLM_MODEL ?? "doubao-seed-1-6-flash").trim() };
  }
  const arkKey = (process.env.ARK_API_KEY ?? "").trim();
  if (arkKey) {
    return {
      url: (process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3/chat/completions").trim(),
      apiKey: arkKey,
      model: (process.env.ARK_MODEL ?? "doubao-seed-1-6-flash").trim(),
    };
  }
  const deepseekKey = (process.env.DEEPSEEK_API_KEY ?? "").trim();
  if (deepseekKey) {
    const base = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").trim().replace(/\/+$/, "");
    return {
      url: `${base}/chat/completions`,
      apiKey: deepseekKey,
      model: (process.env.DEEPSEEK_MODEL ?? "deepseek-chat").trim(),
    };
  }
  return undefined;
}

async function callOpenAi(prompt: string, deadline: number): Promise<string> {
  const target = resolveOpenAiTarget();
  if (!target) throw new EmptyAnswerError("no-llm-credentials");
  const res = await fetch(target.url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${target.apiKey}` },
    signal: signalUntil(deadline),
    body: JSON.stringify({
      model: target.model,
      temperature: 0.3,
      max_tokens: 600,
      stream: false,
      messages: [
        { role: "system", content: "你是严谨的分析化学实验助教，只根据给定材料点评，不编造数据。" },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new HttpError(res.status);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length === 0) throw new EmptyAnswerError("empty-completion");
  return text.trim();
}

/** 当前配置指向哪个 provider（auto 时按可用凭据推断）。 */
export function providerOf(): AssessProvider {
  const chosen = (process.env.PLAN_ASSESS_PROVIDER ?? "auto").trim().toLowerCase();
  if (chosen === "mock" || chosen === "coze" || chosen === "ark") return chosen;
  if ((process.env.COZE_API_TOKEN ?? "").trim() && (process.env.COZE_BOT_ID ?? "").trim()) return "coze";
  if (resolveOpenAiTarget()) return "ark";
  return "mock";
}

/** 有没有真正的模型通道（页面用来标注「离线点评 / AI 点评」）。 */
export function llmEnabled(): boolean {
  return providerOf() !== "mock";
}

/**
 * 点评入口。**永不 throw**：
 * 云端 provider 失败/超时/没配 key → 回落到 mock（结构不变，前端照常渲染）。
 */
export async function assessPlan(
  plan: PlanInput,
  report: PlanReport,
  topic?: PlanTopic,
): Promise<LlmAssessResult> {
  const local = mockAssess(plan, report, topic);
  const provider = providerOf();
  if (provider === "mock") return local;

  const deadline = Date.now() + TIMEOUT_MS;
  try {
    const prompt = buildPrompt(plan, report, topic);
    const raw = provider === "coze" ? await callCoze(prompt, deadline) : await callOpenAi(prompt, deadline);
    const parsed = parseModelAnswer(raw, topic);
    if (!parsed.text) return { ...local, fallback: "empty" };
    if (parsed.points.length === 0) {
      // 模型只给了文字（或 JSON 坏）：文字用模型的，指到块的要点仍用本地
      return { ...local, provider, text: parsed.text, pointsFrom: "local" };
    }
    return {
      provider,
      text: parsed.text,
      points: parsed.points,
      questions: parsed.questions.length > 0 ? parsed.questions : local.questions,
      pointsFrom: "model",
    };
  } catch (error) {
    return { ...local, fallback: reasonOf(error) };
  }
}
