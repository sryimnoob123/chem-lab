/**
 * 拼接方案的 AI 点评 —— 可插拔 provider（P1）
 *
 * 分工（用户 2026-10-22 口径）：
 *   规则引擎给分（lib/plan/rules.ts + topics.ts，离线、可解释、永远可用）；
 *   AI 只做点评与追问，**不负责给分**。
 *
 * provider 由 `PLAN_ASSESS_PROVIDER` 选：`mock` | `coze` | `ark`，缺省 auto
 * （配了 COZE_API_TOKEN+COZE_BOT_ID 走 coze，配了 ARK_API_KEY 走 ark，都没配走 mock）。
 * 明天接扣子只换 provider，不改业务代码。
 *
 * 所有 provider 都必须返回同一形状：
 *   { provider, text, points: [{ kind, pieceId?, ruleId?, text }], questions: [] }
 * `points` 要能指到具体片段 —— 学生看得到"我用了哪一块、为什么不行"。
 */

import { PIECES_BY_ID, type PlanInput } from "./pieces";
import type { PlanIssue, PlanReport } from "./rules";
import type { PlanTopic } from "./topics";

export type AssessPointKind = "good" | "risk" | "todo";

export type AssessPoint = {
  kind: AssessPointKind;
  /** 指到具体素材块 */
  pieceId?: string;
  /** 指到具体规则 */
  ruleId?: string;
  text: string;
};

export type LlmAssessResult = {
  provider: "mock" | "coze" | "ark";
  text: string;
  points: AssessPoint[];
  questions: string[];
};

const TIMEOUT_MS = 12_000;

/** 片段小知识库：mock 点评用它指到具体块 */
const PIECE_NOTES: Readonly<Record<string, string>> = {
  "piece-na2co3-primary": "无水 Na₂CO₃ 作基准物，摩尔质量大、称量相对误差小，是标定 HCl 的常规选择",
  "piece-khp": "邻苯二甲酸氢钾常用来标碱，标 HCl 要先把它的钾盐转成酸，路线比 Na₂CO₃ 绕",
  "piece-burette-acid": "盐酸必须走酸式滴定管，玻璃活塞不会被酸腐蚀",
  "piece-burette-base": "碱式滴定管内是橡胶管 + 玻璃珠，装盐酸会让橡胶老化、漏液",
  "piece-pipette-25": "移液管取 25.00 mL 比量筒精确两个数量级，但必须润洗 3 次",
  "piece-analytical-balance": "分析天平 0.1 mg，基准物称量才能记到小数点后 4 位",
  "piece-boiled-water": "新沸冷却的蒸馏水赶掉了溶入的 CO₂，配碱液和做空白都要用它",
  "piece-step-boil": "煮沸驱 CO₂：碳酸转成 CO₂ 逸出，第二步终点才不会判早",
  "piece-step-blank": "空白试验把蒸馏水带来的碱量扣掉，是系统误差的常规处理",
  "piece-step-parallel": "平行 3 份才看得出精密度，单次结果没有说服力",
  "piece-phenolphthalein": "酚酞管第一终点：微红刚好消失",
  "piece-methyl-orange": "甲基橙管第二终点：黄→橙且 30 s 不褪",
  "piece-hcl-conc": "浓盐酸 37% 只能稀释成近似浓度，本身不能当标准液",
};

/** 规则 → 通常的责任片段（点评要指到块上） */
const RULE_PIECE: Readonly<Record<string, string>> = {
  "std-primary-standard": "piece-hcl-conc",
  "analytical-balance": "piece-analytical-balance",
  "burette-rinse": "piece-step-rinse",
  "burette-degas-zero": "piece-step-degas",
  "primary-standard-dried": "piece-param-drying",
  "parallel-min-and-range": "piece-step-parallel",
  "parallel-same-batch": "piece-step-parallel",
  "no-mouth-pipetting": "piece-pipette-25",
  "flask-receiving": "piece-flask-250",
  "half-drop-touch-wall": "piece-step-half-drop",
  "near-endpoint-dropwise": "piece-step-near-endpoint",
  "indicator-1-2-drops": "piece-phenolphthalein",
  "endpoint-hold-30s": "piece-param-endpoint",
  "endpoint-color-criterion": "piece-param-endpoint",
  "standardization-boil-co2": "piece-step-boil",
  "blank-test": "piece-step-blank",
  "acid-base-burette-match": "piece-burette-acid",
  "total-alkalinity-dual-indicator": "piece-methyl-orange",
  "conc-acid-into-water": "piece-hcl-conc",
  "naoh-co2-free-water": "piece-boiled-water",
  "reading-two-decimals": "piece-burette-acid",
  "topic-standard-needs-primary": "piece-na2co3-primary",
  "topic-standard-needs-acid-burette": "piece-burette-acid",
  "topic-standard-parallel-3": "piece-step-parallel",
  "topic-alkalinity-dual-indicator": "piece-methyl-orange",
  "topic-alkalinity-boil": "piece-step-boil",
  "topic-alkalinity-blank": "piece-step-blank",
  "topic-acceptance-khp": "piece-khp",
  "topic-acceptance-single-standard": "piece-na2co3-primary",
  "topic-acceptance-parallel-blank": "piece-step-blank",
  "topic-co2-boiled-water": "piece-boiled-water",
  "topic-co2-boil-and-blank": "piece-step-boil",
  "topic-co2-endpoint": "piece-param-endpoint",
};

function pieceTitle(id: string): string {
  return PIECES_BY_ID[id]?.title ?? id;
}

/**
 * mock 点评：不联网、确定性输出，但**具体到片段**。
 * 先挑 2 个做得对的块夸（带理由），再挑 2 条问题指到责任块，最后给 2 个追问。
 * 明天接扣子后 `text` 换成模型生成，`points` / `questions` 结构不变。
 */
export function mockAssess(plan: PlanInput, report: PlanReport, topic?: PlanTopic): LlmAssessResult {
  const points: AssessPoint[] = [];

  const goodCandidates = plan.pieces.filter((id) => PIECE_NOTES[id]);
  for (const id of goodCandidates.slice(0, 2)) {
    points.push({ kind: "good", pieceId: id, text: `用了「${pieceTitle(id)}」：${PIECE_NOTES[id]}。` });
  }

  const risks: PlanIssue[] = [...report.issues]
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "block" ? -1 : 1))
    .slice(0, 2);
  for (const issue of risks) {
    const pieceId = RULE_PIECE[issue.ruleId];
    // 指到具体片段：缺的块说「还没放」，放了但用错的块说「问题出在」
    const missing = pieceId !== undefined && !plan.pieces.includes(pieceId);
    points.push({
      kind: "risk",
      ruleId: issue.ruleId,
      pieceId,
      text:
        pieceId && missing
          ? `还缺「${pieceTitle(pieceId)}」：${issue.text} —— ${issue.hint}`
          : pieceId
            ? `问题出在「${pieceTitle(pieceId)}」：${issue.text} —— ${issue.hint}`
            : `${issue.text} —— ${issue.hint}`,
    });
  }

  if (points.filter((p) => p.kind === "good").length === 0) {
    points.push({ kind: "todo", text: "方案还是空的：先从主题推荐的块里挑一个起点（基准物或滴定管）。" });
  }

  const questions: string[] = [];
  const parallel = plan.params?.parallelCount;
  if (parallel !== undefined && Number(parallel) < 3) {
    questions.push(`你把平行次数设成 ${String(parallel)} —— 两份能看出精密度吗？`);
  }
  if (plan.pieces.includes("piece-hcl-conc") && !plan.pieces.includes("piece-step-dilute")) {
    questions.push("浓盐酸稀释到 ≈0.1 mol/L 之后，你怎么确认稀释后的实际浓度？");
  }
  if (!plan.pieces.includes("piece-step-blank")) {
    questions.push("如果蒸馏水里溶了 CO₂，它会让结果偏高还是偏低？你打算怎么扣掉？");
  }
  if (questions.length === 0) {
    questions.push("这个方案里哪一步的误差最大？你怎么把它压到 0.2% 以内？");
  }

  const topicLine = topic ? `（主题：${topic.title}）` : "";
  const head = report.feasible
    ? `方案可执行${topicLine}：规则 ${report.score} 分。`
    : `方案还不能做${topicLine}：${report.blockCount} 条硬约束没过。`;
  const body = points
    .filter((p) => p.kind !== "good")
    .map((p) => p.text)
    .slice(0, 2)
    .join(" ");

  return {
    provider: "mock",
    text: `${head}${body || "结构和顺序都没问题，可以进操作台验证。"}`,
    points,
    questions: questions.slice(0, 2),
  };
}

function buildPrompt(plan: PlanInput, report: PlanReport, topic?: PlanTopic): string {
  const bad = report.issues.slice(0, 8);
  const passed = report.passed.slice(0, 8);
  const badLines = bad.length
    ? bad.map((item: PlanIssue) => `- [${item.level}] ${item.ruleId}：${item.text}`).join("\n")
    : "- 无";
  const okLines = passed.length ? passed.map((line) => `- ${line}`).join("\n") : "- 无";
  const pieceLines = plan.pieces.map((id) => `- ${id}（${pieceTitle(id)}）`).join("\n");

  return [
    "你在点评一个大一无机及分析化学实验的「拼接式方案」。",
    topic ? `学生选的主题：${topic.title} —— ${topic.goal}` : "学生没有选主题。",
    `方案共 ${plan.pieces.length} 块：\n${pieceLines || "- 空"}`,
    `规则引擎判定：得分 ${report.score}/100，可执行=${report.feasible ? "是" : "否"}，硬约束 ${report.blockCount} 条、警告 ${report.warnCount} 条。`,
    `未通过：\n${badLines}`,
    `已通过：\n${okLines}`,
    "请用 3 句话说清：① 能不能做 ② 最要紧的一个错误和它的化学后果 ③ 下一步怎么改。",
    "必须点出具体片段的名字（例如「移液管 25.00 mL」），不要泛泛而谈。不要 Markdown，不超过 150 字。",
  ].join("\n");
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
  return json.data?.messages?.find((item) => item.type === "answer")?.content?.trim() || null;
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

/** 当前配置指向哪个 provider（auto 时按可用 key 推断）。 */
export function providerOf(): LlmAssessResult["provider"] {
  const chosen = (process.env.PLAN_ASSESS_PROVIDER ?? "auto").trim().toLowerCase();
  if (chosen === "mock" || chosen === "coze" || chosen === "ark") return chosen;
  if (process.env.COZE_API_TOKEN && process.env.COZE_BOT_ID) return "coze";
  if (process.env.ARK_API_KEY) return "ark";
  return "mock";
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
  const provider = providerOf();
  const fallback = mockAssess(plan, report, topic);
  if (provider === "mock") return fallback;

  try {
    const prompt = buildPrompt(plan, report, topic);
    const text = provider === "coze" ? await callCoze(prompt) : await callArk(prompt);
    if (!text) return { ...fallback, text: `${fallback.text}（AI 通道未返回，以下是本地点评）` };
    // 云端只补一段总体点评；片段级 points 仍由规则给出，保证指得准
    return { ...fallback, provider, text };
  } catch {
    return fallback;
  }
}

/** 有没有真正的模型通道（页面用来标注「本地点评 / AI 点评」）。 */
export function llmEnabled(): boolean {
  return providerOf() !== "mock";
}
