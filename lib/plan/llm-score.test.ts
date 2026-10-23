/**
 * AI 评分（2026-10-23 用户口径：拼接方案由接入大模型的助教评分，不是脚本直接给分）。
 *
 * 守四件事：
 * 1. 模型给的 score 只收 0~100 的整数，坏值当"没给"（学生不能拿到 NaN）；
 * 2. dimensions 只收有名字有分的，最多 4 条；
 * 3. 规则判死（不可执行 / 违反硬约束）时，模型的分被压到 ≤59 —— AI 也不能给化学上说不通的方案打高分；
 * 4. 模型没给分时，`scoreFrom` 不出现，前端据此回落规则分。
 */

import { describe, expect, it } from "vitest";
import { REFERENCE_PLAN, type PlanInput } from "./pieces";
import { validate } from "./rules";
import { applyTopic, getTopic } from "./topics";
import {
  capScoreByReport,
  parseModelAnswer,
  sanitizeDimensions,
  sanitizeScore,
} from "./llm-assess";

const CLEAN: PlanInput = { pieces: REFERENCE_PLAN.pieces, params: REFERENCE_PLAN.params };
const reportOf = (plan: PlanInput = CLEAN) => applyTopic(validate(plan), plan, getTopic("topic-hcl-standard"));

describe("sanitizeScore", () => {
  it("只收 0~100 的整数", () => {
    expect(sanitizeScore(88)).toBe(88);
    expect(sanitizeScore("72")).toBe(72);
    expect(sanitizeScore(72.6)).toBe(73);
    expect(sanitizeScore(0)).toBe(0);
    expect(sanitizeScore(100)).toBe(100);
  });

  it("坏值一律当没给（NaN / 越界 / 非数字 / 空）", () => {
    expect(sanitizeScore(undefined)).toBeUndefined();
    expect(sanitizeScore(null)).toBeUndefined();
    expect(sanitizeScore("很高")).toBeUndefined();
    expect(sanitizeScore(-1)).toBeUndefined();
    expect(sanitizeScore(101)).toBeUndefined();
    expect(sanitizeScore(Number.NaN)).toBeUndefined();
  });
});

describe("sanitizeDimensions", () => {
  it("有名字有分才收，最多 4 条", () => {
    const out = sanitizeDimensions([
      { name: "顺序", score: 90 },
      { name: "完整性", score: "80" },
      { name: "", score: 70 },
      { name: "参数", score: "x" },
      { name: "安全规范", score: 60 },
      { name: "第五项", score: 50 },
    ]);
    // 空名字 / 坏分被丢掉；剩下的按顺序取前 4 条
    expect(out.map((d) => d.name)).toEqual(["顺序", "完整性", "安全规范", "第五项"]);
    expect(out.every((d) => d.score >= 0 && d.score <= 100)).toBe(true);
  });

  it("不是数组就返回空", () => {
    expect(sanitizeDimensions("顺序")).toEqual([]);
  });
});

describe("capScoreByReport", () => {
  it("可行且无扣分项：模型分原样保留", () => {
    const report = reportOf();
    expect(capScoreByReport(95, { ...report, feasible: true, blockCount: 0, warnCount: 0 })).toBe(95);
  });

  it("有扣分项：封顶 84", () => {
    const report = reportOf();
    expect(capScoreByReport(95, { ...report, feasible: true, blockCount: 0, warnCount: 2 })).toBe(84);
  });

  it("不可执行或违反硬约束：封顶 59", () => {
    const report = reportOf();
    expect(capScoreByReport(95, { ...report, feasible: false, blockCount: 0, warnCount: 0 })).toBe(59);
    expect(capScoreByReport(95, { ...report, feasible: true, blockCount: 1, warnCount: 0 })).toBe(59);
  });
});

describe("parseModelAnswer：分数与分项", () => {
  it("正常 JSON：拿到 score 与 dimensions", () => {
    const parsed = parseModelAnswer(
      JSON.stringify({
        score: 86,
        dimensions: [{ name: "顺序", score: 90, note: "润洗在转移前" }],
        text: "可以进操作台，但滴定终点控制偏松。",
        points: [{ kind: "risk", ruleId: "R-014", text: "终点保持时间偏短" }],
        questions: ["你打算怎么判断终点？"],
      }),
      getTopic("topic-hcl-standard"),
    );
    expect(parsed.score).toBe(86);
    expect(parsed.dimensions?.[0]).toEqual({ name: "顺序", score: 90, note: "润洗在转移前" });
  });

  it("模型没给分：score 是 undefined，文字照收", () => {
    const parsed = parseModelAnswer(JSON.stringify({ text: "方案可以进操作台。", points: [] }));
    expect(parsed.score).toBeUndefined();
    expect(parsed.text).toBe("方案可以进操作台。");
  });

  it("分越界 / 不是 JSON：不抛错，分数当没给", () => {
    expect(parseModelAnswer(JSON.stringify({ text: "还行", score: 250 })).score).toBeUndefined();
    const plain = parseModelAnswer("方案可以进操作台，注意润洗。");
    expect(plain.score).toBeUndefined();
    expect(plain.text).toContain("润洗");
  });
});

/* ── 接真模型的路径：本地起一个 OpenAI 兼容端点，验"模型给分 → 封顶 → 落库分" ── */

import { afterEach, describe as describe2, it as it2, expect as expect2 } from "vitest";
import { createServer, type Server } from "node:http";
import { assessPlan } from "./llm-assess";

let server: Server | null = null;
const saved = { ...process.env };

async function startMockLlm(answer: string): Promise<string> {
  server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return `http://127.0.0.1:${port}/v1/chat/completions`;
}

afterEach(async () => {
  process.env = { ...saved };
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

describe2("assessPlan：模型给分", () => {
  it2("模型返回 score → 用它当最终分（scoreFrom = model）", async () => {
    const url = await startMockLlm(
      JSON.stringify({
        score: 92,
        dimensions: [{ name: "顺序", score: 94 }],
        text: "可以进操作台，润洗和终点控制都到位。",
        points: [{ kind: "good", pieceId: "piece-burette-acid", text: "酸式滴定管选对了。" }],
        questions: [],
      }),
    );
    process.env.PLAN_ASSESS_PROVIDER = "ark";
    process.env.COZE_LLM_URL = url;
    process.env.COZE_LLM_KEY = "test-key";

    const plan: PlanInput = { pieces: REFERENCE_PLAN.pieces, params: REFERENCE_PLAN.params };
    const report = { ...reportOf(plan), feasible: true, blockCount: 0, warnCount: 0 };
    const result = await assessPlan(plan, report, getTopic("topic-hcl-standard"));

    expect2(result.score).toBe(92);
    expect2(result.scoreFrom).toBe("model");
    expect2(result.dimensions?.[0]?.name).toBe("顺序");
  });

  it2("模型客气给高分，但方案不可执行 → 压到 59", async () => {
    const url = await startMockLlm(
      JSON.stringify({ score: 96, text: "整体不错。", points: [{ kind: "good", pieceId: "piece-burette-acid", text: "可以。" }] }),
    );
    process.env.PLAN_ASSESS_PROVIDER = "ark";
    process.env.COZE_LLM_URL = url;
    process.env.COZE_LLM_KEY = "test-key";

    const plan: PlanInput = { pieces: REFERENCE_PLAN.pieces, params: REFERENCE_PLAN.params };
    const report = { ...reportOf(plan), feasible: false, blockCount: 2, warnCount: 0 };
    const result = await assessPlan(plan, report, getTopic("topic-hcl-standard"));

    expect2(result.score).toBe(59);
    expect2(result.fallback).toBeUndefined();
  });
});

/* ── 无 COZE_ 前缀的变量名（扣子平台自定义变量禁 COZE_ 前缀）── */

describe2("环境变量别名", () => {
  it2("LLM_BASE_URL + LLM_API_KEY 也认（走 OpenAI 兼容通道）", async () => {
    process.env.PLAN_ASSESS_PROVIDER = "auto";
    delete process.env.COZE_LLM_URL;
    delete process.env.COZE_API_TOKEN;
    process.env.LLM_BASE_URL = "https://example.com/v1/chat/completions";
    process.env.LLM_API_KEY = "k";
    const { providerOf } = await import("./llm-assess");
    expect2(providerOf()).toBe("ark");
  });

  it2("BOT_TOKEN + BOT_ID 也认（走扣子 BOT 通道）", async () => {
    process.env.PLAN_ASSESS_PROVIDER = "auto";
    delete process.env.LLM_BASE_URL;
    delete process.env.COZE_LLM_URL;
    process.env.BOT_TOKEN = "pat_x";
    process.env.BOT_ID = "7";
    const { providerOf } = await import("./llm-assess");
    expect2(providerOf()).toBe("coze");
  });
});
