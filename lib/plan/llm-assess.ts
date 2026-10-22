/**
 * 拼接方案的 AI 点评（可选，可插拔）。
 *
 * 为什么单独一层：规则评分（lib/plan/rules.ts）必须永远可用、离线可跑；
 * LLM 只负责把「哪里对、哪里不对」讲成人话，缺 key 时整条链路照常工作。
 *
 * 支持的两种接法（任一配置了就启用，按顺序探测）：
 * 1. Coze OpenAPI：`COZE_API_TOKEN` + `COZE_BOT_ID`（扣子「发布管理 → API」里拿）
 * 2. 火山方舟 / OpenAI 兼容：`ARK_API_KEY`（+ 可选 `ARK_BASE_URL` / `ARK_MODEL`）
 *
 * 目前线上两者都没配 → `llmAssess()` 返回 null，调用方回落到 `offlineAssessment()` 的本地文案。
 */

import type { PlanInput } from "./pieces";
import type { PlanIssue, PlanReport } from "./rules";

export type LlmAssessResult = {
  provider: "coze" | "ark";
  text: string;
};

const TIMEOUT_MS = 12_000;

function buildPrompt(plan: PlanInput, report: PlanReport): string {
  const bad = report.issues.slice(0, 8);
  const passed = report.passed.slice(0, 8);
  const badLine = bad.length
    ? `必须指出的问题：\n- ${bad.map((item: PlanIssue) => item.hint || item.text).join("\n- ")}`
    : "规则层面没有硬伤。";
  const okLine = passed.length ? `已经做对的点：\n- ${passed.join("\n- ")}` : "";

  return [
    "你在批改一个大一无机及分析化学实验的「拼接式方案」。",
    `学生共放入 ${plan.pieces.length} 个块，规则引擎给出可行=${report.feasible ? "是" : "否"}、得分 ${report.score}。`,
    badLine,
    okLine,
    "请用 3 句话说清：① 方案能不能做 ② 最要紧的一个错误和它的化学后果 ③ 下一步怎么改。",
    "不要复述题目，不要用 Markdown，不要超过 120 字。",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callCoze(prompt: string): Promise<string | null> {
  const token = process.env.COZE_API_TOKEN;
  const botId = process.env.COZE_BOT_ID;
  if (!token || !botId) return null;
  const res = await fetch("https://api.coze.cn/v3/chat", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      bot_id: botId,
      user_id: "chem-lab",
      stream: false,
      auto_save_history: false,
      additional_messages: [{ role: "user", content: prompt, content_type: "text" }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { messages?: Array<{ type?: string; content?: string }> };
  };
  const answer = json.data?.messages?.find((item) => item.type === "answer")?.content;
  return answer?.trim() || null;
}

async function callArk(prompt: string): Promise<string | null> {
  const key = process.env.ARK_API_KEY;
  if (!key) return null;
  const base = process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const model = process.env.ARK_MODEL ?? "doubao-seed-1-6-flash";
  const res = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() || null;
}

/** 有 key 才调；任何异常都吞掉并返回 null（点评失败不能挡住评分）。 */
export async function llmAssess(plan: PlanInput, report: PlanReport): Promise<LlmAssessResult | null> {
  const prompt = buildPrompt(plan, report);
  try {
    const coze = await callCoze(prompt);
    if (coze) return { provider: "coze", text: coze };
    const ark = await callArk(prompt);
    if (ark) return { provider: "ark", text: ark };
  } catch {
    return null;
  }
  return null;
}

/** 当前有没有可用的 LLM 通道（给 /api/plan/assess 与页面做「AI 点评未启用」提示）。 */
export function llmEnabled(): boolean {
  return Boolean(
    (process.env.COZE_API_TOKEN && process.env.COZE_BOT_ID) || process.env.ARK_API_KEY,
  );
}
