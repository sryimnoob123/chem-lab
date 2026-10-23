/**
 * 扣子编程运行时的 SDK 通道（`coze-coding-dev-sdk` 的 LLMClient）。
 *
 * 为什么单独一层：这个 SDK 在**本地用 PAT 是调不通的**（2026-10-23 实测）——
 *   new Config({ apiKey: pat }) → "token contains an invalid number of segments"
 * 它要的是平台签发的三段式 JWT + 运行时身份（HeaderUtils.extractForwardHeaders）。
 * 所以分工：
 *   - 部署在扣子编程里：new Config() 零配置，平台注入身份 → 走这里
 *   - 本地 next dev：没有平台身份 → 走 lib/plan/llm-assess.ts 的 HTTP 通道（PAT / 方舟 key）
 *
 * 开关：`LLM_CHANNEL=auto`（默认）| `sdk` | `http`
 *   auto —— 平台运行时优先 SDK，失败自动回落 HTTP；本地直接不用 SDK
 *   永不 throw：任何异常都返回 null，调用方回落
 */

export type SdkCallOptions = {
  /** 平台下必须把请求头原样转发（官方要求），拿不到就传空 */
  headers?: Record<string, string>;
  model?: string;
  temperature?: number;
  /** 关掉深度思考：实测同一问题 9.9s → 5.6s */
  thinking?: "enabled" | "disabled";
};

/** 扣子编程运行时的判据：平台会注入工作区路径 / 项目 id，本地没有 */
export function platformRuntime(): boolean {
  return Boolean(
    (process.env.COZE_WORKSPACE_PATH ?? "").trim() ||
      (process.env.COZE_PROJECT_ID ?? "").trim() ||
      (process.env.COZE_PROJECT_PATH ?? "").trim(),
  );
}

export function sdkChannel(): "auto" | "sdk" | "http" {
  const raw = (process.env.LLM_CHANNEL ?? "").trim().toLowerCase();
  if (raw === "sdk" || raw === "http") return raw;
  return "auto";
}

/** 是否该尝试 SDK：sdk 强制试；auto 只在平台运行时试；http 永不试 */
export function shouldTrySdk(): boolean {
  const channel = sdkChannel();
  if (channel === "http") return false;
  if (channel === "sdk") return true;
  return platformRuntime();
}

const DEFAULT_MODEL = "doubao-seed-2-0-pro-260215";

type Chunk = { content?: unknown };

function textOf(result: unknown): string {
  if (typeof result === "string") return result.trim();
  if (result && typeof result === "object") {
    const anyRes = result as Record<string, unknown>;
    for (const key of ["content", "text", "output"]) {
      const v = anyRes[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

/**
 * 用 SDK 调一次模型，拿整段文本。失败返回 null（调用方回落 HTTP 通道）。
 * `invoke()` 是官方推荐的非流式用法；评分要的是整段 JSON，流式反而要多拼一次。
 */
export async function sdkInvoke(prompt: string, options: SdkCallOptions = {}): Promise<string | null> {
  if (!shouldTrySdk()) return null;
  try {
    const sdk = (await import("coze-coding-dev-sdk")) as unknown as {
      LLMClient: new (config: unknown, headers?: Record<string, string>) => {
        invoke: (messages: unknown[], config?: unknown) => Promise<unknown>;
      };
      Config: new (config?: Record<string, unknown>) => unknown;
    };
    const client = new sdk.LLMClient(new sdk.Config({ timeout: 30_000 }), options.headers ?? {});
    const result = await client.invoke(
      [
        { role: "system", content: "只输出用户要求的 JSON，不要 Markdown、不要解释。" },
        { role: "user", content: prompt },
      ],
      {
        model: options.model ?? DEFAULT_MODEL,
        temperature: options.temperature ?? 0.1,
        thinking: options.thinking ?? "disabled",
      },
    );
    const text = textOf(result);
    return text || null;
  } catch {
    return null;
  }
}

/** 流式：给助教用（SSE 逐字），失败返回 null */
export async function sdkStream(
  prompt: string,
  options: SdkCallOptions = {},
): Promise<AsyncIterable<Chunk> | null> {
  if (!shouldTrySdk()) return null;
  try {
    const sdk = (await import("coze-coding-dev-sdk")) as unknown as {
      LLMClient: new (config: unknown, headers?: Record<string, string>) => {
        stream: (messages: unknown[], config?: unknown) => AsyncIterable<Chunk>;
      };
      Config: new (config?: Record<string, unknown>) => unknown;
    };
    const client = new sdk.LLMClient(new sdk.Config({ timeout: 30_000 }), options.headers ?? {});
    return client.stream([{ role: "user", content: prompt }], {
      model: options.model ?? DEFAULT_MODEL,
      temperature: options.temperature ?? 0.7,
      thinking: options.thinking ?? "disabled",
    });
  } catch {
    return null;
  }
}
