/**
 * app/api/_lib/http.ts —— 路由公共小工具（Next 把 `_` 开头目录视为私有，不生成路由）
 *
 * 约定：
 * - 成功：`{ ok: true, ...数据 }`；失败：`{ ok: false, error: "<错误码>" }`；
 * - **不返回用户可见文案**（文案在 strings.ts / 页面；API 只返错误码）；
 * - 未捕获异常记 console.error，对外统一 500 INTERNAL。
 */

import { AuthError, PersistError } from "@/lib/persist/errors";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function ok(data: Record<string, unknown> = {}): Response {
  return json({ ok: true, ...data });
}

export function fail(code: string, status: number): Response {
  return json({ ok: false, error: code }, status);
}

export function handleError(error: unknown): Response {
  if (error instanceof AuthError) return fail(error.code, error.status);
  if (error instanceof PersistError) return fail(error.code, error.status);
  console.error("[api] unhandled error:", error);
  return fail("INTERNAL", 500);
}

/** 解析 JSON body；坏 JSON 统一 400（不把解析异常抛给用户）。 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new PersistError(400, "INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new PersistError(400, "INVALID_BODY");
  }
  return parsed as Record<string, unknown>;
}

/** 从 body 里取必填字符串。 */
export function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

/** 从 URL 读整型 query。 */
export function readIntParam(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (raw === null) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}
