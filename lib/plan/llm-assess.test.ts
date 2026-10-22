/**
 * 点评链路单测（唯一一条：lib/plan/llm-assess.ts + assess-mock.ts）
 *
 * 三层要求：
 * 1. 本地点评：4 主题 × 3 档（全过 / 有 warn / 有 block）都有内容，points 指到具体块或规则；
 * 2. prompt：随主题变（标题/情境/目标/约束/块/参数/判定），且明确禁止编造计量；
 * 3. 云端 provider：扣子 v3 chat 与 OpenAI 兼容都能解析；超时/限流/5xx/坏 JSON 一律回退，
 *    **永不 throw**，并用 fallback 告诉 UI 为什么。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { PIECES_BY_ID, REFERENCE_PLAN, type PlanInput } from "./pieces";
import { RULES_BY_CODE, validate } from "./rules";
import { applyTopic, getTopic, PLAN_TOPICS } from "./topics";
import { mockAssess } from "./assess-mock";
import { TIMEOUT_MS, assessPlan, buildPrompt, parseModelAnswer, providerOf } from "./llm-assess";

/** 以参考方案为底：删掉某些块 */
function planWithout(...drop: string[]): PlanInput {
  return { pieces: REFERENCE_PLAN.pieces.filter((id) => !drop.includes(id)), params: REFERENCE_PLAN.params };
}

const PASSING: Record<string, PlanInput> = {
  "topic-hcl-standard": planWithout(),
  "topic-acid-acceptance": {
    pieces: [...REFERENCE_PLAN.pieces.filter((id) => id !== "piece-na2co3-primary"), "piece-khp"],
    params: REFERENCE_PLAN.params,
  },
  "topic-co2-blank": planWithout(),
  "topic-soda-alkalinity": planWithout(),
};

const withWarn = (plan: PlanInput): PlanInput => ({
  pieces: plan.pieces,
  params: { ...plan.params, indicatorDrops: 6, endpointHoldSec: 10, sameBatch: false },
});
const withBlock = (plan: PlanInput): PlanInput => ({
  pieces: plan.pieces.filter((id) => id !== "piece-analytical-balance" && id !== "piece-step-rinse"),
  params: plan.params,
});

const TIERS = ["pass", "warn", "block"] as const;
type Tier = (typeof TIERS)[number];

function planOf(topicId: string, tier: Tier): PlanInput {
  const base = PASSING[topicId];
  return tier === "pass" ? base : tier === "warn" ? withWarn(base) : withBlock(base);
}

function reportOf(plan: PlanInput, topicId: string) {
  return applyTopic(validate(plan), plan, getTopic(topicId));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function clearLlmEnv(): void {
  for (const key of [
    "PLAN_ASSESS_PROVIDER",
    "COZE_API_TOKEN",
    "COZE_BOT_ID",
    "COZE_LLM_URL",
    "COZE_LLM_KEY",
    "COZE_LLM_API_KEY",
    "ARK_API_KEY",
    "ARK_BASE_URL",
    "DEEPSEEK_API_KEY",
  ]) {
    vi.stubEnv(key, "");
  }
}

describe("本地点评：4 主题 × 3 档都能看", () => {
  for (const topic of PLAN_TOPICS) {
    for (const tier of TIERS) {
      it(`${topic.title} / ${tier}：结论先行、要点指到块或规则、追问 ≤2`, () => {
        const plan = planOf(topic.id, tier);
        const report = reportOf(plan, topic.id);
        const result = mockAssess(plan, report, topic);

        expect(result.provider).toBe("mock");
        expect(result.text.length).toBeGreaterThan(8);
        expect(result.points.length).toBeGreaterThan(0);
        expect(result.questions.length).toBeGreaterThanOrEqual(1);
        expect(result.questions.length).toBeLessThanOrEqual(2);

        for (const point of result.points) {
          expect(["good", "risk", "todo"]).toContain(point.kind);
          expect(point.text.length).toBeGreaterThan(4);
          expect(Boolean(point.pieceId) || Boolean(point.ruleId), `要点没指到块/规则：${point.text}`).toBe(true);
          if (point.pieceId) expect(PIECES_BY_ID[point.pieceId], `未知块 ${point.pieceId}`).toBeDefined();
          if (point.ruleId) {
            const known = RULES_BY_CODE[point.ruleId] ?? topic.rules.find((rule) => rule.code === point.ruleId);
            expect(known, `未知规则 ${point.ruleId}`).toBeDefined();
          }
        }

        if (tier === "block") {
          expect(report.blockCount).toBeGreaterThan(0);
          expect(result.text).toContain("做不了");
          expect(result.points.some((point) => point.kind === "risk")).toBe(true);
        } else if (tier === "warn") {
          expect(report.blockCount).toBe(0);
          expect(report.warnCount).toBeGreaterThan(0);
          expect(result.text).toContain("能执行");
          expect(result.text).toContain("掉分");
          expect(result.points.some((point) => point.kind === "risk")).toBe(true);
        } else {
          expect(report.blockCount).toBe(0);
          expect(report.warnCount).toBe(0);
          expect(result.text).toContain("能执行");
          expect(result.points.some((point) => point.kind === "good")).toBe(true);
        }
        expect(result.points.some((point) => point.kind === "todo")).toBe(true);
      });
    }
  }

  it("空方案也给一条能动的建议（不许空白）", () => {
    const plan: PlanInput = { pieces: [], params: {} };
    const result = mockAssess(plan, reportOf(plan, "topic-hcl-standard"), getTopic("topic-hcl-standard"));
    expect(result.points.some((point) => point.kind === "todo")).toBe(true);
    expect(result.text).not.toHaveLength(0);
  });

  it("缺基准物时点出「还缺『无水 Na₂CO₃…』」，不是泛泛而谈", () => {
    const plan: PlanInput = { pieces: ["piece-burette-acid"], params: {} };
    const result = mockAssess(plan, reportOf(plan, "topic-hcl-standard"), getTopic("topic-hcl-standard"));
    const risk = result.points.find((point) => point.kind === "risk");
    expect(risk?.pieceId).toBe("piece-na2co3-primary");
    expect(risk?.text).toContain("还缺");
    expect(risk?.text).toContain("无水 Na₂CO₃");
  });
});

describe("prompt 随主题变", () => {
  const topic = getTopic("topic-hcl-standard");
  const other = getTopic("topic-co2-blank");
  if (!topic || !other) throw new Error("测试用主题不存在");

  it("主题标题 / 情境 / 目标 / 约束 / 块 / 参数 / 规则判定都在提示词里", () => {
    const plan = PASSING[topic.id];
    const report = reportOf(plan, topic.id);
    const prompt = buildPrompt(plan, report, topic);

    expect(prompt).toContain(topic.title);
    expect(prompt).toContain(topic.scene);
    expect(prompt).toContain(topic.goal);
    for (const constraint of topic.constraints) {
      expect(prompt).toContain(constraint.text);
      expect(prompt).toContain(constraint.ruleCode);
    }
    for (const id of plan.pieces.slice(0, 5)) {
      expect(prompt).toContain(id);
    }
    expect(prompt).toContain("parallelCount");
    expect(prompt).toContain(`${report.score}/100`);
    expect(prompt).toContain("不要复述规则原文");
    expect(prompt).toContain("不要编造化学计量");
    expect(prompt).toContain("结论先行");
    expect(prompt).toContain("piece-");
  });

  it("换主题就换提示词（不是写死实验名）", () => {
    const first = buildPrompt(PASSING[topic.id], reportOf(PASSING[topic.id], topic.id), topic);
    const second = buildPrompt(PASSING[other.id], reportOf(PASSING[other.id], other.id), other);
    expect(first).not.toBe(second);
    expect(first).toContain(topic.title);
    expect(first).not.toContain(other.title);
    expect(second).toContain(other.title);
    expect(second).toContain("新沸冷却");
  });

  it("没选主题也能拼出提示词（不抛错）", () => {
    const empty: PlanInput = { pieces: [], params: {} };
    const prompt = buildPrompt(empty, validate(empty));
    expect(prompt).toContain("没有选主题");
    expect(prompt).toContain("共 0 块");
    expect(prompt.length).toBeGreaterThan(200);
  });

  it("违规时把 ruleId 与判据摊进提示词，模型不用猜", () => {
    const plan = withBlock(PASSING[topic.id]);
    const report = reportOf(plan, topic.id);
    const prompt = buildPrompt(plan, report, topic);
    for (const issue of report.issues) {
      expect(prompt).toContain(issue.ruleId);
    }
  });
});

describe("模型输出解析（坏 JSON 不许把链路打断）", () => {
  const topic = getTopic("topic-hcl-standard");

  it("标准 JSON：text / points / questions 都取出来，未知 id 丢掉", () => {
    const raw = JSON.stringify({
      text: "**方案不能做**：缺空白。",
      points: [
        { kind: "risk", pieceId: "piece-step-blank", ruleId: "blank-test", text: "加空白试验" },
        { kind: "risk", pieceId: "piece-nope", text: "编造的块" },
        { kind: "good", text: "没指到块" },
      ],
      questions: ["空白值怎么扣？", "第二问", "第三问"],
    });
    const parsed = parseModelAnswer(raw, topic);
    expect(parsed.text).toContain("方案不能做");
    expect(parsed.text).not.toContain("**");
    expect(parsed.points).toHaveLength(1);
    expect(parsed.points[0].pieceId).toBe("piece-step-blank");
    expect(parsed.questions).toHaveLength(2);
  });

  it("markdown 代码块包着 JSON 也能解析", () => {
    const raw = '```json\n{"text":"能执行。","points":[],"questions":[]}\n```';
    expect(parseModelAnswer(raw, topic).text).toBe("能执行。");
  });

  it("纯文本：整段当点评，points 留空（调用方用本地兜底）", () => {
    const parsed = parseModelAnswer("【结论】能执行，但缺空白。", topic);
    expect(parsed.text).toContain("能执行");
    expect(parsed.points).toHaveLength(0);
  });

  it("坏 JSON 且像 JSON：不抛错，返回原文", () => {
    const parsed = parseModelAnswer('{"text": "能执行", "points": [', topic);
    expect(parsed.text.length).toBeGreaterThan(0);
    expect(parsed.points).toHaveLength(0);
  });
});

describe("provider 选择", () => {
  it("没有配置任何凭据时走 mock", () => {
    clearLlmEnv();
    expect(providerOf()).toBe("mock");
  });

  it("COZE_API_TOKEN + COZE_BOT_ID → coze", () => {
    clearLlmEnv();
    vi.stubEnv("COZE_API_TOKEN", "token");
    vi.stubEnv("COZE_BOT_ID", "bot");
    expect(providerOf()).toBe("coze");
  });

  it("COZE_LLM_URL + key → ark（OpenAI 兼容）", () => {
    clearLlmEnv();
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    expect(providerOf()).toBe("ark");
  });

  it("PLAN_ASSESS_PROVIDER 显式覆盖自动推断", () => {
    clearLlmEnv();
    vi.stubEnv("COZE_API_TOKEN", "token");
    vi.stubEnv("COZE_BOT_ID", "bot");
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "mock");
    expect(providerOf()).toBe("mock");
  });
});

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const MODEL_JSON = JSON.stringify({
  text: "能执行，但空白没做，结果会系统性偏高。",
  points: [{ kind: "risk", pieceId: "piece-step-blank", ruleId: "blank-test", text: "补空白试验" }],
  questions: ["空白值怎么扣？"],
});

describe("云端 provider：成功与失败都守住", () => {
  const topic = getTopic("topic-hcl-standard");
  const plan = PASSING["topic-hcl-standard"];
  const report = reportOf(plan, "topic-hcl-standard");

  it("没有凭据：不联网，直接本地点评", async () => {
    clearLlmEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const started = performance.now();
    const result = await assessPlan(plan, report, topic);
    expect(performance.now() - started).toBeLessThan(100);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.provider).toBe("mock");
    expect(result.text.length).toBeGreaterThan(10);
    expect(result.fallback).toBeUndefined();
  });

  it("OpenAI 兼容返回标准 JSON：用模型的 text/points/questions", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    const fetchMock = vi.fn(async () =>
      jsonRes({ choices: [{ message: { content: MODEL_JSON } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await assessPlan(plan, report, topic);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.provider).toBe("ark");
    expect(result.pointsFrom).toBe("model");
    expect(result.text).toContain("空白没做");
    expect(result.points[0].pieceId).toBe("piece-step-blank");
    expect(result.questions).toEqual(["空白值怎么扣？"]);
  });

  it("模型只给纯文本：文字用模型的，要点用本地的（照样指到块）", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ choices: [{ message: { content: "先补空白，再做平行。" } }] })));

    const result = await assessPlan(plan, report, topic);
    expect(result.provider).toBe("ark");
    expect(result.pointsFrom).toBe("local");
    expect(result.text).toBe("先补空白，再做平行。");
    expect(result.points.every((point) => point.pieceId || point.ruleId)).toBe(true);
  });

  it("扣子 v3 chat：发起 → 取消息，answer 里的 JSON 被解析", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "coze");
    vi.stubEnv("COZE_API_TOKEN", "token");
    vi.stubEnv("COZE_BOT_ID", "bot");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v3/chat")) {
        return jsonRes({ code: 0, data: { id: "chat-1", conversation_id: "conv-1", status: "completed" } });
      }
      if (url.includes("/v3/chat/message/list")) {
        return jsonRes({ code: 0, data: [{ type: "answer", content: MODEL_JSON }] });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await assessPlan(plan, report, topic);
    expect(result.provider).toBe("coze");
    expect(result.text).toContain("空白没做");
    expect(result.points[0].ruleId).toBe("blank-test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("扣子轮询失败：回退本地点评，不 throw", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "coze");
    vi.stubEnv("COZE_API_TOKEN", "token");
    vi.stubEnv("COZE_BOT_ID", "bot");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/v3/chat")) {
          return jsonRes({ code: 0, data: { id: "chat-1", conversation_id: "conv-1", status: "in_progress" } });
        }
        throw new Error("retrieve boom");
      }),
    );

    const result = await assessPlan(plan, report, topic);
    expect(result.provider).toBe("mock");
    expect(result.fallback).toBe("error");
    expect(result.text.length).toBeGreaterThan(10);
  });

  it("HTTP 500 → fallback=http，返回本地点评", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const result = await assessPlan(plan, report, topic);
    expect(result.provider).toBe("mock");
    expect(result.fallback).toBe("http");
    expect(result.text).toContain("能执行");
  });

  it("HTTP 429 → fallback=rate-limit", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("slow down", { status: 429 })));
    expect((await assessPlan(plan, report, topic)).fallback).toBe("rate-limit");
  });

  it("坏 JSON 响应 → fallback=error", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));
    expect((await assessPlan(plan, report, topic)).fallback).toBe("error");
  });

  it("连不上（fetch 抛 TypeError）→ fallback=network，不是「格式不对」", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const result = await assessPlan(plan, report, topic);
    expect(result.fallback).toBe("network");
    expect(result.provider).toBe("mock");
    expect(result.text.length).toBeGreaterThan(10);
  });

  it("模型回空 content → fallback=empty", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ choices: [{ message: { content: "   " } }] })));
    expect((await assessPlan(plan, report, topic)).fallback).toBe("empty");
  });

  it("超时 → fallback=timeout（12 s 上限）", async () => {
    clearLlmEnv();
    vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
    vi.stubEnv("COZE_LLM_URL", "https://llm.example/v1/chat/completions");
    vi.stubEnv("COZE_LLM_KEY", "key");
    const timeoutError = new Error("timed out");
    timeoutError.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(timeoutError)));
    const result = await assessPlan(plan, report, topic);
    expect(result.fallback).toBe("timeout");
    expect(result.provider).toBe("mock");
  });

  it("超时常量是 12 秒（不是什么 30 s 默认值）", () => {
    expect(TIMEOUT_MS).toBe(12_000);
  });

  /**
   * 真 HTTP 往返：起一个本机 stub 端点，走真实 fetch + 真实 socket。
   * 上面那些用例都打桩了 fetch，只能证明"解析对不对"；这一条证明"发得出去、收得回来"，
   * 以及发出去的 prompt 真的带着当前主题（换成写死实验名的旧实现会立刻红）。
   */
  it("本机真端点往返：请求带主题 prompt，响应按模型 JSON 渲染", async () => {
    clearLlmEnv();
    let seenBody = "";
    const server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += String(chunk);
      });
      req.on("end", () => {
        seenBody = raw;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: MODEL_JSON } }] }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      expect(port).toBeGreaterThan(0);
      vi.stubEnv("PLAN_ASSESS_PROVIDER", "ark");
      vi.stubEnv("COZE_LLM_URL", `http://127.0.0.1:${port}/v1/chat/completions`);
      vi.stubEnv("COZE_LLM_KEY", "stub-key");

      const result = await assessPlan(plan, report, topic);
      expect(result.provider).toBe("ark");
      expect(result.pointsFrom).toBe("model");
      expect(result.text).toContain("空白没做");

      const sent = JSON.parse(seenBody) as { messages?: Array<{ content?: string }> };
      const prompt = sent.messages?.at(-1)?.content ?? "";
      expect(prompt).toContain(topic?.title ?? "");
      expect(prompt).toContain("不要编造化学计量");
      expect(prompt).toContain("piece-step-blank");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
