/**
 * 扣子 OAuth **JWT 服务端应用**鉴权（企业账号最干净的一条路）。
 *
 * 为什么不让人填 PAT：PAT 是**个人**凭据，企业账号里个人一换岗/离职就废，还得改环境变量重新部署。
 * OAuth 服务类应用是**组织级**的：超管建一次，私钥写进环境变量，后端自己签 JWT 换 access_token，
 * 自动续期，跟谁登录无关。
 *
 * 流程（官方文档 docs.coze.cn/developer_guides_oauth_jwt）：
 *   1. 签 JWT：header {alg:RS256, typ:JWT, kid=公钥指纹}；payload {iss=应用ID, aud="api.coze.cn", iat, exp, jti}
 *   2. POST /api/permission/oauth2/token（Header: Authorization: Bearer <JWT>）
 *      body {grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer", duration_seconds}
 *   3. 拿到 access_token，当普通 Bearer 调 /v3/chat
 *
 * 企业版路径变体：
 *   - 企业旗舰版多组织 → /api/permission/oauth2/account/{account_id}/token
 *   - 企业特权应用   → /api/permission/oauth2/enterprise_id/{enterprise_id}/token
 *
 * 硬约束（和点评链路一致）：**永不 throw**。没配置/签名失败/接口报错一律返回 null，
 * 调用方回落本地点评 —— 鉴权出问题不能让学生的评分页白屏。
 */

import { createPrivateKey, randomUUID, sign } from "node:crypto";

export type CozeJwtConfig = {
  appId: string;
  kid: string;
  privateKey: string;
  /** 多组织场景：组织 ID（填了就走 /account/{id}/token） */
  accountId?: string;
  /** 企业特权应用：企业 ID（填了就走 /enterprise_id/{id}/token） */
  enterpriseId?: string;
  /** API 域名，缺省 api.coze.cn */
  base: string;
};

function env(...names: readonly string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/** PEM 可能被塞成一行（带字面量 \n），这里还原换行 */
function normalizeKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function jwtConfig(): CozeJwtConfig | null {
  const appId = env("BOT_APP_ID", "COZE_APP_ID");
  const kid = env("BOT_KID", "COZE_KID");
  const privateKey = env("BOT_PRIVATE_KEY", "COZE_PRIVATE_KEY");
  if (!appId || !kid || !privateKey) return null;
  return {
    appId,
    kid,
    privateKey: normalizeKey(privateKey),
    accountId: env("BOT_ACCOUNT_ID", "COZE_ACCOUNT_ID") || undefined,
    enterpriseId: env("BOT_ENTERPRISE_ID", "COZE_ENTERPRISE_ID") || undefined,
    base: (env("COZE_API_BASE", "COZE_API_URL") || "https://api.coze.cn").replace(/\/+$/, ""),
  };
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** 签一个只能换一次 token 的 JWT（有效期 600s，够换 token 用了） */
export function signJwt(config: CozeJwtConfig, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: config.kid };
  const payload = {
    iss: config.appId,
    aud: "api.coze.cn",
    iat,
    exp: iat + 600,
    jti: randomUUID().replace(/-/g, ""),
  };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = sign("RSA-SHA256", Buffer.from(body), createPrivateKey(config.privateKey));
  return `${body}.${b64url(signature)}`;
}

/** token 有效期最长 24h；我们申请 24h 并在过期前 5 分钟换新的 */
const WANT_SECONDS = 86_399;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

type Cached = { token: string; expireAt: number };
const cache = new Map<string, Cached>();

function tokenPath(config: CozeJwtConfig): string {
  if (config.enterpriseId) return `/api/permission/oauth2/enterprise_id/${config.enterpriseId}/token`;
  if (config.accountId) return `/api/permission/oauth2/account/${config.accountId}/token`;
  return "/api/permission/oauth2/token";
}

/**
 * 拿一个可用的 access_token（带缓存）。失败返回 null，不抛。
 * 供 callCoze 使用：没有 PAT 时自动走这条。
 */
export async function cozeAccessToken(signal?: AbortSignal): Promise<string | null> {
  const config = jwtConfig();
  if (!config) return null;
  const key = `${config.appId}|${config.accountId ?? config.enterpriseId ?? ""}`;
  const hit = cache.get(key);
  if (hit && hit.expireAt - REFRESH_MARGIN_MS > Date.now()) return hit.token;

  try {
    const jwt = signJwt(config);
    const res = await fetch(`${config.base}${tokenPath(config)}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
      signal,
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        duration_seconds: WANT_SECONDS,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    const token = typeof body.access_token === "string" ? body.access_token : "";
    if (!token) return null;
    /** expires_in 文档给的是"过期时间戳"，但也见到过"剩余秒数"——两种都兜住 */
    const raw = Number(body.expires_in);
    const expireAt = Number.isFinite(raw) && raw > 1_000_000_000 ? raw * 1000 : Date.now() + (Number.isFinite(raw) && raw > 0 ? raw * 1000 : 900_000);
    cache.set(key, { token, expireAt });
    return token;
  } catch {
    return null;
  }
}

/** 单测用：清掉缓存 */
export function resetTokenCache(): void {
  cache.clear();
}
