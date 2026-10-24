/**
 * lib/pedagogy/quiz-store.ts —— 前测作答在浏览器侧的暂存
 *
 * 为什么不在提交时直接落库：前测发生在 run 创建之前（门禁没通过时操作台不挂载、
 * 不建 run），而 `quiz_answers.run_id` 是 notNull（db/schema.ts）。所以答案是
 * 先写 localStorage，等操作台拿到 runId 后由 `app/exp/[id]/workbench.tsx` 调
 * `POST /api/runs/[id]/quiz` 补写；交卷前再补写一次，覆盖「重做前测」后的答案。
 *
 * 存档格式 v2：`{"answers":{"exp01-pre-1":"A"},"at":"2026-10-24T..."}`。
 * 旧版只写字符串 `"pass"`（没有答案），读取时按「已通过 / 无答案」兼容，
 * 这类记录不会产生 quiz_answers 行 —— 预习分仍按 0 算，属于历史数据，
 * 页面会重新走一次前测才拿到答案（?fresh=1 同理）。
 */

export interface PreSubmission {
  /** 题号 → 选项 key */
  answers: Record<string, string>;
  /** 提交时间（ISO），只用于排查 */
  at: string;
}

export function preStoreKey(expId: string): string {
  return `bopbps:v1:${expId}:pre`;
}

function parse(raw: string | null): PreSubmission | null {
  if (!raw) return null;
  if (raw === "pass") return null; // 旧版标记：已通过但没有答案
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const answers = (parsed as { answers?: unknown }).answers;
    if (typeof answers !== "object" || answers === null || Array.isArray(answers)) return null;
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
      if (typeof value === "string" && value) clean[key] = value;
    }
    if (Object.keys(clean).length === 0) return null;
    const at = (parsed as { at?: unknown }).at;
    return { answers: clean, at: typeof at === "string" ? at : "" };
  } catch {
    return null;
  }
}

/** 读前测存档；没有答案（旧版 "pass" / 未提交 / 隐私模式）返回 null。 */
export function readPreSubmission(expId: string): PreSubmission | null {
  try {
    return parse(window.localStorage.getItem(preStoreKey(expId)));
  } catch {
    return null;
  }
}

/** 该实验的前测是否已经通过（有答案存档或旧版 "pass" 标记都算）。 */
export function hasPassedPre(expId: string): boolean {
  try {
    const raw = window.localStorage.getItem(preStoreKey(expId));
    return raw === "pass" || parse(raw) !== null;
  } catch {
    return false;
  }
}

/** 通过前测时写入答案。写不了（隐私模式）就当没存，本次会话内仍可继续。 */
export function writePreSubmission(expId: string, answers: Record<string, string>, now = new Date()): void {
  try {
    const payload: PreSubmission = { answers, at: now.toISOString() };
    window.localStorage.setItem(preStoreKey(expId), JSON.stringify(payload));
  } catch {
    /* 忽略 */
  }
}

export function clearPreSubmission(expId: string): void {
  try {
    window.localStorage.removeItem(preStoreKey(expId));
  } catch {
    /* 忽略 */
  }
}
