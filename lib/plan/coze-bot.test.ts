/**
 * 扣子 BOT 通道（`coze` provider）的端到端验证 —— 2026-10-23：
 * 用户要求「建个 BOT 直接接出来」，所以这条路径必须证明能用，不能只有 OpenAI 兼容那条有测试。
 *
 * 本地起一个假 api.coze.cn，按官方 v3 协议回三包：
 *   POST /v3/chat                      → { code:0, data:{ id, conversation_id, status:"in_progress" } }
 *   GET  /v3/chat/retrieve?…           → { code:0, data:{ status:"completed" } }
 *   GET  /v3/chat/message/list?…       → { code:0, data:[{ type:"answer", content:"<JSON>" }] }
 * 然后断言 assessPlan 走 coze、拿到模型给的分。
 */

import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { REFERENCE_PLAN, type PlanInput } from "./pieces";
import { validate } from "./rules";
import { applyTopic, getTopic } from "./topics";
import { assessPlan, providerOf } from "./llm-assess";

let server: Server | null = null;
const saved = { ...process.env };

/** 模型输出的 JSON（要带 score 才算"AI 评分"） */
const ANSWER = JSON.stringify({
  score: 87,
  dimensions: [
    { name: "完整性", score: 90 },
    { name: "顺序", score: 85 },
  ],
  text: "可以进操作台；滴定前记得用待装液润洗滴定管三次。",
  points: [{ kind: "good", pieceId: "piece-burette-acid", text: "酸式滴定管选对了。" }],
  questions: ["你打算怎么判断终点？"],
});

async function startFakeCoze(): Promise<string> {
  server = createServer((req, res) => {
    const url = req.url ?? "";
    res.setHeader("content-type", "application/json");
    if (url.startsWith("/v3/chat/retrieve")) {
      res.end(JSON.stringify({ code: 0, msg: "ok", data: { status: "completed" } }));
      return;
    }
    if (url.startsWith("/v3/chat/message/list")) {
      res.end(
        JSON.stringify({
          code: 0,
          msg: "ok",
          data: [{ type: "answer", content: ANSWER, content_type: "text" }],
        }),
      );
      return;
    }
    if (url.startsWith("/v3/chat")) {
      res.end(
        JSON.stringify({
          code: 0,
          msg: "ok",
          data: { id: "chat-1", conversation_id: "conv-1", status: "in_progress" },
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  process.env = { ...saved };
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

describe("扣子 BOT 通道", () => {
  it("BOT_TOKEN + BOT_ID 就能走通 v3/chat，并拿到模型给的分", async () => {
    const base = await startFakeCoze();
    process.env.PLAN_ASSESS_PROVIDER = "auto";
    process.env.BOT_TOKEN = "pat_test";
    process.env.BOT_ID = "7499999999999999999";
    process.env.COZE_API_BASE = base;
    delete process.env.COZE_LLM_URL;
    delete process.env.LLM_BASE_URL;
    delete process.env.ARK_API_KEY;

    expect(providerOf()).toBe("coze");

    const plan: PlanInput = { pieces: REFERENCE_PLAN.pieces, params: REFERENCE_PLAN.params };
    const topic = getTopic("topic-hcl-standard");
    const report = applyTopic(validate(plan), plan, topic);
    const result = await assessPlan(plan, report, topic);

    expect(result.provider).toBe("coze");
    expect(result.score).toBe(87);
    expect(result.scoreFrom).toBe("model");
    expect(result.dimensions?.map((d) => d.name)).toEqual(["完整性", "顺序"]);
    expect(result.fallback).toBeUndefined();
  });

  it("没有凭据时不 throw，回落 mock 点评（线上就是这么降级的）", async () => {
    process.env.PLAN_ASSESS_PROVIDER = "auto";
    delete process.env.BOT_TOKEN;
    delete process.env.BOT_ID;
    delete process.env.COZE_API_TOKEN;
    delete process.env.COZE_LLM_URL;
    delete process.env.LLM_BASE_URL;
    delete process.env.ARK_API_KEY;

    expect(providerOf()).toBe("mock");

    const plan: PlanInput = { pieces: REFERENCE_PLAN.pieces, params: REFERENCE_PLAN.params };
    const topic = getTopic("topic-hcl-standard");
    const report = applyTopic(validate(plan), plan, topic);
    const result = await assessPlan(plan, report, topic);
    expect(result.provider).toBe("mock");
    expect(result.score).toBeUndefined();
    expect(result.text.length).toBeGreaterThan(0);
  });
});
