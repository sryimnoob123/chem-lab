#!/usr/bin/env node
/**
 * 用本机飞书自建应用凭据，把文本/图片发到指定飞书会话。
 *
 * 凭据来源：~/.dsh/.credentials.yaml 的 DSH_FEISHU_APP_ID / DSH_FEISHU_APP_SECRET
 * 默认会话：~/.dsh/dsh-feishu-state.json 的 lastChatId
 *
 * 用法：
 *   node scripts/feishu.mjs text "消息内容"
 *   node scripts/feishu.mjs image "C:\path\to\shot.png"
 *   node scripts/feishu.mjs image shot.png --chat oc_xxx
 *
 * 退出码：0 成功；1 失败（stderr 带原因）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = "https://open.feishu.cn/open-apis";

function readCreds() {
  const p = path.join(os.homedir(), ".dsh", ".credentials.yaml");
  const raw = fs.readFileSync(p, "utf8");
  const get = (key) => {
    const line = raw.split(/\r?\n/).find((l) => new RegExp(`^\\s*${key}\\s*:`).test(l));
    if (!line) throw new Error(`凭据文件缺少 ${key}`);
    return line.split(":").slice(1).join(":").trim().replace(/^["']|["']$/g, "");
  };
  return { appId: get("DSH_FEISHU_APP_ID"), appSecret: get("DSH_FEISHU_APP_SECRET") };
}

function defaultChatId() {
  const p = path.join(os.homedir(), ".dsh", "dsh-feishu-state.json");
  const state = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!state.lastChatId) throw new Error("state 里没有 lastChatId，请用 --chat 指定");
  return state.lastChatId;
}

async function getToken({ appId, appSecret }) {
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`取 token 失败: ${json.code} ${json.msg}`);
  return json.tenant_access_token;
}

async function send(kind, payload, chatId) {
  const token = await getToken(readCreds());
  const auth = { authorization: `Bearer ${token}` };

  if (kind === "text") {
    const res = await fetch(`${BASE}/im/v1/messages?receive_id_type=chat_id`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ receive_id: chatId, msg_type: "text", content: JSON.stringify({ text: payload }) }),
    });
    return res.json();
  }

  if (kind === "image") {
    if (!fs.existsSync(payload)) throw new Error(`图片不存在: ${payload}`);
    const form = new FormData();
    form.append("image_type", "message");
    form.append("image", new Blob([fs.readFileSync(payload)]), path.basename(payload));
    const up = await (
      await fetch(`${BASE}/im/v1/images`, { method: "POST", headers: auth, body: form })
    ).json();
    if (up.code !== 0) throw new Error(`上传图片失败: ${up.code} ${up.msg}`);
    const res = await fetch(`${BASE}/im/v1/messages?receive_id_type=chat_id`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: "image",
        content: JSON.stringify({ image_key: up.data.image_key }),
      }),
    });
    return res.json();
  }

  throw new Error(`未知类型: ${kind}`);
}

const argv = process.argv.slice(2);
const chatIdx = argv.indexOf("--chat");
const explicitChat = chatIdx >= 0 ? argv.splice(chatIdx, 2)[1] : undefined;
const [kind, ...rest] = argv;
const payload = rest.join(" ").trim();

if (!kind || !payload) {
  console.error("用法: node scripts/feishu.mjs <text|image> <内容或路径> [--chat oc_xxx]");
  process.exit(1);
}

try {
  const chatId = explicitChat ?? defaultChatId();
  const json = await send(kind, payload, chatId);
  if (json.code !== 0) throw new Error(`发送失败: ${json.code} ${json.msg}`);
  console.log(`OK ${kind} -> ${chatId} (message_id=${json.data?.message_id ?? "-"})`);
} catch (err) {
  console.error(String(err.message ?? err));
  process.exit(1);
}
