/**
 * E3 系统错误的「人话」映射（components/exp/incident/）。
 *
 * 硬规则（STYLE-20261021 §4.3）：
 * - 不把技术错误码原样抛给学生（ERR_500 → "服务器没响应，稍等 3 秒再点一次"）；
 * - 不写"系统错误，请联系管理员"这种没人能行动的话；
 * - 每条文案都必须落到一个学生能做的动作上（重试 / 重登 / 找老师）。
 *
 * 本模块只做「分类 + 固定文案」，**永远不把原始 error.message 拼进界面**。
 */

export type StudentErrorKind = "network" | "server" | "timeout" | "auth" | "unknown";

export interface StudentErrorCopy {
  kind: StudentErrorKind;
  /** 人话一句话（≤30 字），可直接给 ErrorToast */
  message: string;
  /** 是否值得让学生再点一次（决定 ErrorToast 是否给 action） */
  retryable: boolean;
}

const COPY: Readonly<Record<StudentErrorKind, StudentErrorCopy>> = {
  network: {
    kind: "network",
    message: "网络断了，检查一下网线或 Wi-Fi，再点一次",
    retryable: true,
  },
  server: {
    kind: "server",
    message: "服务器没响应，等 3 秒再点一次",
    retryable: true,
  },
  timeout: {
    kind: "timeout",
    message: "这一步等太久了，网络有点慢，再点一次",
    retryable: true,
  },
  auth: {
    kind: "auth",
    message: "登录状态过期了，重新登录后继续",
    retryable: false,
  },
  unknown: {
    kind: "unknown",
    message: "这一步没完成，再点一次；还不行就告诉老师",
    retryable: true,
  },
};

/** 原始错误里可能出现的英文类型名 / 错误码 / 堆栈特征；命中即判为技术泄漏。 */
const TECH_LEAK =
  /(ERR_[A-Z0-9_]+|E[A-Z]{2,}_[A-Z0-9_]+|\b(?:TypeError|ReferenceError|SyntaxError|RangeError|NetworkError|AxiosError|FetchError|Failed to fetch|Load failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT)\b|stack trace|at\s+\w+\s+\(|\.tsx?:\d+)/i;

function readStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const record = error as Record<string, unknown>;
  const raw = record.status ?? record.statusCode ?? record.code;
  const status = typeof raw === "string" ? Number(raw) : raw;
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

function readName(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function readMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

/** 把任意异常分类成学生能理解的三类环境问题，不泄漏任何错误码。 */
export function errorMessage(error: unknown): StudentErrorCopy {
  const status = readStatus(error);
  const name = readName(error);
  const raw = readMessage(error);

  if (status === 401 || status === 403) return COPY.auth;
  if (status === 408 || status === 504 || name === "TimeoutError") return COPY.timeout;
  if (status !== null && status >= 500) return COPY.server;
  if (name === "AbortError" || name === "TimeoutError") return COPY.timeout;
  if (/network|failed to fetch|load failed|offline|econnrefused|enotfound|etimedout/i.test(raw)) {
    return COPY.network;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return COPY.network;
  return COPY.unknown;
}

/**
 * 兜底清洗：调用方若不小心把技术错误原文传进来，这里退回到人话，不放行错误码。
 * 只拦明确的代码/堆栈特征，不碰 500 mL、pH 7.00 这类化学数字。
 */
export function sanitizeForStudents(text: string, fallback: string = COPY.unknown.message): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  if (TECH_LEAK.test(trimmed)) return fallback;
  return trimmed;
}

/** 供 ErrorToast 默认 action 文案使用：可重试的给「重试」，登录过期给「重新登录」。 */
export function retryLabel(kind: StudentErrorKind): string {
  return kind === "auth" ? "重新登录" : "重试";
}
