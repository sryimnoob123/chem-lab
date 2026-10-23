/**
 * 企业账号的干净接法：OAuth **JWT 服务端应用**（不用个人 PAT）。
 *
 * 这里用真 RSA 私钥 + 假 api.coze.cn，把官方三段流程走一遍：
 *   1. 后端签 RS256 JWT（header 带 kid，payload 带 iss/aud/iat/exp/jti）
 *   2. POST /api/permission/oauth2/token 换 access token
 *   3. 用 access token 调 /v3/chat → retrieve → message/list
 * 断言：JWT 符合文档、token 有缓存、最终拿到模型给的分。
 */

import { createServer, type Server } from "node:http";
import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REFERENCE_PLAN, type PlanInput } from "./pieces";
import { validate } from "./rules";
import { applyTopic, getTopic } from "./topics";
import { assessPlan } from "./llm-assess";
import { cozeAccessToken, jwtConfig, resetTokenCache, signJwt } from "./coze-jwt";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const ANSWER = JSON.stringify({
  score: 91,
  dimensions: [{ name: "顺序", score: 92 }],
  text: "可以进操作台，润洗顺序没问题。",
  points: [{ kind: "good", pieceId: "piece-burette-acid", text: "酸式滴定管选对了。" }],
});

const FAKE_TOKEN = ["fake", "access", "token"].join("-");

let server: Server | null = null;
const saved = { ...process.env };
let tokenCalls = 0;
let lastJwt = "";
let lastChatAuth = "";

function decodePart(part: string): Record<string, unknown> {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

async function startFake(): Promise<string> {
  server = createServer((req, res) => {
    const url = req.url ?? "";
    res.setHeader("content-type", "application/json");
    if (url.startsWith("/api/permission/oauth2/token")) {
      tokenCalls += 1;
      lastJwt = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      res.end(JSON.stringify({ access_token: FAKE_TOKEN, expires_in: 86_399 }));
      return;
    }
    if (url.startsWith("/v3/chat/retrieve")) {
      res.end(JSON.stringify({ code: 0, data: { status: "completed" } }));
      return;
    }
    if (url.startsWith("/v3/chat/message/list")) {
      res.end(JSON.stringify({ code: 0, data: [{ type: "answer", content: ANSWER }] }));
      return;
    }
    if (url.startsWith("/v3/chat")) {
      lastChatAuth = String(req.headers.authorization ?? "");
      res.end(JSON.stringify({ code: 0, data: { id: "c1", conversation_id: "cv1", status: "in_progress" } }));
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

beforeEach(() => {
  tokenCalls = 0;
  lastJwt = "";
  lastChatAuth = "";
  resetTokenCache();
});

afterEach(async () => {
  process.env = { ...saved };
  resetTokenCache();
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

describe("JWT 签名", () => {
  it("header 带 alg/typ/kid，payload 带 iss/aud/iat/exp/jti，签名可验", () => {
    const jwt = signJwt({ appId: "310000000002", kid: "kid-abc", privateKey, base: "http://x" });
    const [h, p, s] = jwt.split(".");
    expect(decodePart(h)).toMatchObject({ alg: "RS256", typ: "JWT", kid: "kid-abc" });
    const payload = decodePart(p);
    expect(payload).toMatchObject({ iss: "310000000002", aud: "api.coze.cn" });
    expect(Number(payload.exp)).toBeGreaterThan(Number(payload.iat));
    expect(String(payload.jti).length).toBeGreaterThan(20);
    const ok = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
    expect(ok).toBe(true);
  });

  it("私钥写成一行（字面量 \\n）也能用，这是环境变量的常见写法", () => {
    process.env.BOT_APP_ID = "1";
    process.env.BOT_KID = "k";
    process.env.BOT_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n");
    const config = jwtConfig();
    expect(config?.privateKey).toContain("PRIVATE KEY");
    expect(() => signJwt(config!)).not.toThrow();
  });

  it("没配置就返回 null，不抛", async () => {
    delete process.env.BOT_APP_ID;
    delete process.env.BOT_KID;
    delete process.env.BOT_PRIVATE_KEY;
    expect(jwtConfig()).toBeNull();
    await expect(cozeAccessToken()).resolves.toBeNull();
  });
});

describe("JWT → access token → /v3/chat 全链路", () => {
  it("企业服务凭证能换 token 并拿到模型给的分，token 有缓存", async () => {
    const base = await startFake();
    process.env.PLAN_ASSESS_PROVIDER = "auto";
    process.env.BOT_ID = "7499999999999999999";
    process.env.BOT_APP_ID = "310000000002";
    process.env.BOT_KID = "kid-abc";
    process.env.BOT_PRIVATE_KEY = privateKey;
    process.env.COZE_API_BASE = base;
    delete process.env.BOT_TOKEN;
    delete process.env.COZE_API_TOKEN;
    delete process.env.COZE_LLM_URL;
    delete process.env.LLM_BASE_URL;
    delete process.env.ARK_API_KEY;

    const plan: PlanInput = { pieces: REFERENCE_PLAN.pieces, params: REFERENCE_PLAN.params };
    const topic = getTopic("topic-hcl-standard");
    const report = applyTopic(validate(plan), plan, topic);
    const result = await assessPlan(plan, report, topic);

    expect(result.provider).toBe("coze");
    expect(result.score).toBe(91);
    expect(result.scoreFrom).toBe("model");

    // token 只换一次；chat 用的是换来的 access token，不是 JWT
    expect(tokenCalls).toBe(1);
    expect(lastChatAuth).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(lastJwt.split(".")).toHaveLength(3);

    // 第二次调用走缓存，不再换 token
    await assessPlan(plan, report, topic);
    expect(tokenCalls).toBe(1);
  });
});
