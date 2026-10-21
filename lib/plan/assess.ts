/**
 * 拼接式方案设计 —— AI 点评（可选）＋ 离线兜底
 *
 * 硬约束（产品要求「演示时绝不许抛错或卡住」）：
 * - 有 `DEEPSEEK_API_KEY` 或 `COZE_LLM_URL` 才发请求，走 OpenAI 兼容 `/chat/completions`；
 * - **8 s 超时**；超时、限流、断网、返回空、JSON 坏 —— 一律回退离线模板；
 * - 任何情况下都 resolve，绝不 throw（调用方只管渲染 `{ text, offline }`）。
 *
 * 离线模板按报告分三档：全过 / 有 warn / 有 block，每档都含【结论】【依据】【下一步】。
 */

import type { PlanInput } from "./pieces";
import { validate, type PlanReport } from "./rules";

export interface AssessmentResult {
  text: string;
  /** true = 用的是离线模板（无 key / 失败 / 超时），UI 显示「AI 点评暂不可用」小字 */
  offline: boolean;
}

export const LLM_TIMEOUT_MS = 8000;

const EMPTY_ENV: Record<string, string | undefined> = {};
const env = (): Record<string, string | undefined> =>
  typeof process !== "undefined" && process.env ? process.env : EMPTY_ENV;

/** 离线点评：三档模板，全部非空、可解释、指向具体规则 */
export function offlineAssessment(plan: PlanInput, report: PlanReport): AssessmentResult {
  const blocks = report.issues.filter((i) => i.level === "block");
  const warns = report.issues.filter((i) => i.level === "warn");
  const top = [...blocks, ...warns].slice(0, 3);

  const conclusion =
    blocks.length > 0
      ? `方案不可执行：${blocks.length} 条硬约束未满足，得 ${report.score} 分（满分 100）。`
      : warns.length > 0
        ? `方案基本可执行，但有 ${warns.length} 处需要改进，得 ${report.score} 分（满分 100）。`
        : `方案可执行：21 条规则全部通过，得 ${report.score} 分（满分 100）。`;

  const basis =
    top.length > 0
      ? top.map((i, n) => `${n + 1}) ${i.text}`).join("；")
      : `已放入 ${plan.pieces.length} 个块，覆盖基准物标定、双指示剂两步滴定、平行与空白校正，计量关系与操作顺序都对。`;

  const next =
    blocks.length > 0
      ? `先改第一条硬约束：${blocks[0].hint}`
      : warns.length > 0
        ? `把警告项补齐：${warns[0].hint}`
        : "下一步：按此方案填写数据记录表，平行 3 份的相对平均偏差控制在 0.3% 以内，再进操作台。";

  return { text: `【结论】${conclusion}\n【依据】${basis}\n【下一步】${next}`, offline: true };
}

/** 拼一份给模型的提示词：把「块 + 参数 + 报告」都摊开，避免模型凭空猜 */
export function buildPrompt(plan: PlanInput, report: PlanReport): string {
  const issueLines =
    report.issues.length > 0
      ? report.issues.map((i) => `- [${i.level}] ${i.ruleId}：${i.text}`).join("\n")
      : "- 无违规";
  const paramLines =
    plan.params && Object.keys(plan.params).length > 0
      ? Object.entries(plan.params)
          .map(([k, v]) => `- ${k} = ${String(v)}`)
          .join("\n")
      : "- 无";

  return [
    "你是大学分析化学实验课的助教，正在批改学生用「拼接式方案设计」搭出的实验方案。",
    "实验：盐酸标准溶液的标定与工业纯碱总碱度的测定（双指示剂法）。",
    "",
    `学生放入的块（共 ${plan.pieces.length} 个）：`,
    plan.pieces.length > 0 ? plan.pieces.map((p) => `- ${p}`).join("\n") : "- 空",
    "",
    "学生设定的参数：",
    paramLines,
    "",
    "本地规则引擎的判定结果：",
    `- 得分：${report.score}/100，可执行：${report.feasible ? "是" : "否"}，硬约束违规 ${report.blockCount} 条、警告 ${report.warnCount} 条`,
    issueLines,
    "",
    "请用中文写一段不超过 300 字的点评，必须分三段输出：",
    "【结论】方案能不能执行、关键缺口是什么；",
    "【依据】引用上面的具体规则或化学计量关系（如 c(HCl)=2m/(M·V)、第一/第二终点关系），不要编造；",
    "【下一步】给出 1~2 条学生马上能改的动作。",
    "不要重复规则原文，不要用 Markdown 标题、列表或加粗。",
  ].join("\n");
}

interface LlmTarget {
  url: string;
  apiKey?: string;
  model: string;
}

/** 解析目标端点；没配 key 就返回 undefined（直接离线） */
function resolveLlmTarget(): LlmTarget | undefined {
  const e = env();
  const cozeUrl = (e.COZE_LLM_URL ?? "").trim();
  if (cozeUrl) {
    return {
      url: cozeUrl,
      apiKey: (e.COZE_LLM_TOKEN ?? "").trim() || undefined,
      model: (e.COZE_LLM_MODEL ?? "deepseek-chat").trim(),
    };
  }
  const key = (e.DEEPSEEK_API_KEY ?? "").trim();
  if (!key) return undefined;
  const base = (e.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").trim().replace(/\/+$/, "");
  const model = (e.DEEPSEEK_MODEL ?? "deepseek-chat").trim();
  return { url: `${base}/chat/completions`, apiKey: key, model };
}

/** 调 OpenAI 兼容接口；8 s 超时，任何异常都向上抛，由 assess 兜底 */
async function callLlm(target: LlmTarget, prompt: string): Promise<string> {
  if (typeof fetch !== "function") throw new Error("fetch-unavailable");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (target.apiKey) headers.authorization = `Bearer ${target.apiKey}`;

    const res = await fetch(target.url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: target.model,
        messages: [
          { role: "system", content: "你是严谨的分析化学实验助教，只根据给定材料点评，不编造数据。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`http-${res.status}`);

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) throw new Error("empty-completion");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 有模型就调、没有或失败就离线。**永远 resolve**——演示现场宁可少一段点评，也不能白屏。
 */
export async function assess(plan: PlanInput, report?: PlanReport): Promise<AssessmentResult> {
  const resolved = report ?? validate(plan);
  const target = resolveLlmTarget();
  if (!target) return offlineAssessment(plan, resolved);

  try {
    const text = await callLlm(target, buildPrompt(plan, resolved));
    return { text, offline: false };
  } catch {
    return offlineAssessment(plan, resolved);
  }
}
