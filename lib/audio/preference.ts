/**
 * 静音偏好：状态 + localStorage 记忆 + 订阅（不依赖 AudioContext）。
 *
 * 默认不静音（音效默认开启）。storage 可注入，node 环境单测不需要浏览器。
 */

export const STORAGE_KEY = "chem-lab:sound-muted";

export type MuteStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function parseMuted(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

function defaultStorage(): MuteStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    // 隐私模式 / 被策略禁用：当作没有存储，静默降级
    return null;
  }
}

export function readMuted(storage: MuteStorage | null = defaultStorage()): boolean {
  try {
    return parseMuted(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean, storage: MuteStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // 写不进去只影响下次记忆，不影响本次静音
  }
}

let mutedState: boolean | null = null;
const listeners = new Set<() => void>();

/** 当前是否静音（首次读取时从 localStorage 恢复）。 */
export function isMuted(): boolean {
  if (mutedState === null) mutedState = readMuted();
  return mutedState;
}

export function setMuted(next: boolean): void {
  const changed = mutedState !== next;
  mutedState = next;
  writeMuted(next);
  if (!changed) return;
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // 单个订阅者出错不影响其他订阅者
    }
  }
}

export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

/** 供 useSyncExternalStore / 引擎静音淡出订阅；返回取消订阅函数。 */
export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
