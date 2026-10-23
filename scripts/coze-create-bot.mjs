/**
 * 一次性脚本：用 PAT 在扣子建一个「化学实验助教」智能体并发布到 API 渠道（1024）。
 * 用法：node scripts/coze-create-bot.mjs
 * 凭据：读 .env.local 的 BOT_TOKEN；输出的 bot_id 由脚本写回 .env.local
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const ENV = new URL("../.env.local", import.meta.url);
const SPACE_ID = process.env.SPACE_ID || "7631120422091669523";

function readEnv() {
  if (!existsSync(ENV)) return {};
  return Object.fromEntries(
    readFileSync(ENV, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = { ...readEnv(), ...process.env };
const token = env.BOT_TOKEN;
if (!token) {
  console.error("缺 BOT_TOKEN");
  process.exit(1);
}

const PROMPT = `你是「化学实验虚拟仿真平台」里的助教，服务对象是大一学生。

规则：
1. 回答简短，中文，一次最多三句；不要写小标题、不要堆列表。
2. 学生问操作（洗涤、称量、定容、滴定、稀释、加热、读数）时，先给一句"该怎么做"，再给一句"为什么"。
3. 涉及安全（浓硫酸稀释、加热试管、闻气味、废液处理）时，必须点明风险。
4. 若用户要求输出 JSON，只输出 JSON 本身，不要代码块、不要解释、不要前后缀。`;

async function api(path, body) {
  const res = await fetch(`https://api.coze.cn${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

const created = await api("/v1/bot/create", {
  space_id: SPACE_ID,
  name: "化学实验助教",
  description: "chem-lab 平台的实验助教：操作指导 + 安全提醒 + 方案评分（严格 JSON 输出）。",
  prompt_info: { prompt: PROMPT },
  /**
   * 必须显式关掉深度思考：扣子默认给新 bot 挂「豆包·2.0·pro」且 thinking_type=enabled，
   * 实测同样的问答 9.9s、关掉后 5.6s，输出质量不变。model_id 是工作空间模型清单里的数字 ID，
   * 换模型时改成对应的数字即可（名字形式的 model_id 会报 4000 Request parameter error）。
   */
  /** 模型数字 id 用环境变量覆盖，方便在 pro / flash 之间做延迟对比（flash: 905882829 / 2.0pro: 1772700462） */
  model_info_config: {
    model_id: process.env.MODEL_ID || "905882829",
    parameters: { thinking_type: "disabled" },
  },
});
console.log("create:", JSON.stringify(created.json).slice(0, 300));
const botId = created.json?.data?.bot_id;
if (!botId) process.exit(2);

const published = await api("/v1/bot/publish", { bot_id: botId, connector_ids: ["1024"] });
console.log("publish:", JSON.stringify(published.json).slice(0, 300));

// 写回 .env.local
let text = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const setLine = (key, value) => {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) text = text.replace(re, `${key}=${value}`);
  else text += `\n${key}=${value}`;
};
setLine("BOT_TOKEN", token);
setLine("BOT_ID", botId);
writeFileSync(ENV, text.endsWith("\n") ? text : `${text}\n`, "utf8");
console.log("BOT_ID:", botId, "→ 已写入 .env.local");
