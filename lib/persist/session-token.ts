/**
 * lib/persist/session-token.ts —— 会话令牌的签名/验签（纯函数，无 Next 依赖）
 *
 * 设计（数据 API 轨道）：
 * - 学生 cookie `chem_sid` 的值为 `base64url("s:" + studentNo)` + "." + HMAC-SHA256；
 * - 教师 cookie `chem_teacher` 同理，payload 为 `t`；
 * - 密钥：`process.env.SESSION_SECRET ?? "chem-lab-dev"`（生产在扣子注入环境变量）；
 * - 校验用 `timingSafeEqual`，长度不等直接拒绝，避免计时侧信道；
 * - 本文件不 import `next/headers`，可在 vitest 的 node 环境直接测。
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "chem_sid";
export const TEACHER_COOKIE = "chem_teacher";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const SESSION_PREFIX = "s:";
const TEACHER_PAYLOAD = "t";

/** 开发默认密钥；生产用 SESSION_SECRET 覆盖。不硬编码在任何 URL/资源路径里。 */
export function getSessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || "chem-lab-dev";
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodePayload(raw: string): string {
  return Buffer.from(raw, "utf8").toString("base64url");
}

function decodePayload(encoded: string): string | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function signPayload(payload: string): string {
  return `${encodePayload(payload)}.${hmac(payload, getSessionSecret())}`;
}

function verifyPayload(value: string): string | null {
  if (typeof value !== "string") return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;

  const encoded = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const payload = decodePayload(encoded);
  if (!payload) return null;

  const expected = hmac(payload, getSessionSecret());
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return payload;
}

/** 学生 cookie 签名值。 */
export function signSessionValue(studentNo: string): string {
  return signPayload(`${SESSION_PREFIX}${studentNo}`);
}

/** 校验学生 cookie，返回学号；被篡改/格式错误/非学生令牌一律 null。 */
export function verifySessionValue(value: string | undefined | null): string | null {
  if (!value) return null;
  const payload = verifyPayload(value);
  if (!payload || !payload.startsWith(SESSION_PREFIX)) return null;
  const studentNo = payload.slice(SESSION_PREFIX.length).trim();
  if (!studentNo || studentNo.length > 64) return null;
  return studentNo;
}

/** 教师 cookie 签名值。 */
export function signTeacherValue(): string {
  return signPayload(TEACHER_PAYLOAD);
}

/** 校验教师 cookie。 */
export function verifyTeacherValue(value: string | undefined | null): boolean {
  if (!value) return null !== null;
  return verifyPayload(value) === TEACHER_PAYLOAD;
}

/** cookie 通用属性：httpOnly / sameSite=lax / 7 天 / 路径根。 */
export function cookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
}
