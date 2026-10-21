/**
 * lib/persist/errors.ts —— 持久层可预期的业务错误（路由层统一映射成 JSON 错误码）
 */

export class PersistError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "PersistError";
    this.status = status;
    this.code = code;
  }
}

export function notFound(code = "NOT_FOUND"): PersistError {
  return new PersistError(404, code);
}

export function conflict(code: string): PersistError {
  return new PersistError(409, code);
}

export function badRequest(code = "BAD_REQUEST"): PersistError {
  return new PersistError(400, code);
}

/** 鉴权失败（未登录 401 / 无权限 403）。API 层统一转成 `{ok:false,error:<code>}`。 */
export class AuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

export function unauthorized(code = "UNAUTHORIZED"): AuthError {
  return new AuthError(401, code);
}

export function forbidden(code = "FORBIDDEN"): AuthError {
  return new AuthError(403, code);
}
