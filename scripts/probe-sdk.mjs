/**
 * 实测：本地能不能用 coze-coding-dev-sdk 调模型。
 * 三种配置各试一次，看哪种在本地（无平台注入身份）能通：
 *   A) new Config()                          —— 靠环境变量自动加载
 *   B) new Config({ apiKey: PAT })           —— 显式 key，默认 baseUrl(integration.coze.cn)
 *   C) new Config({ apiKey: PAT, baseUrl: 'https://api.coze.cn' }) —— 显式换网关
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const pat = env.BOT_TOKEN;
console.log("PAT 前缀:", pat ? pat.slice(0, 8) : "(缺)");

const { LLMClient, Config } = await import("coze-coding-dev-sdk");
const MODEL = "doubao-seed-2-0-pro-260215";
const messages = [{ role: "user", content: "回复两个字：收到" }];

async function attempt(label, config) {
  const t0 = Date.now();
  try {
    const client = new LLMClient(config);
    const res = await client.invoke(messages, { model: MODEL, temperature: 0.1, thinking: "disabled" });
    const text = typeof res === "string" ? res : JSON.stringify(res).slice(0, 200);
    console.log(`${label}: OK ${Date.now() - t0}ms ->`, String(text).slice(0, 120));
  } catch (e) {
    console.log(`${label}: FAIL ${Date.now() - t0}ms ->`, (e?.message ?? String(e)).slice(0, 200));
  }
}

await attempt("A new Config()", new Config());
await attempt("B apiKey+, 默认网关", new Config({ apiKey: pat, timeout: 30000 }));
await attempt("C apiKey+baseUrl=api.coze.cn", new Config({ apiKey: pat, baseUrl: "https://api.coze.cn", timeout: 30000 }));
