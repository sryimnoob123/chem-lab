import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOUND_LIST, effectivePeakGain, getSound } from "./kinds";
import {
  MAX_EFFECTIVE_GAIN,
  STORAGE_KEY,
  buildEnvelope,
  disposeAudio,
  ensureAudio,
  isMuted,
  parseMuted,
  playSound,
  readMuted,
  scheduleTones,
  setMuted,
  subscribeMuted,
  toggleMuted,
  totalDurationMs,
  writeMuted,
  type MuteStorage,
} from "./engine";

function fakeStorage(initial: Record<string, string> = {}): MuteStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("包络计算（纯逻辑，不依赖浏览器）", () => {
  it("正常包络：0 → 峰值 → 保持 → 0，时间单调递增", () => {
    const points = buildEnvelope({ durationMs: 42, attackMs: 3, releaseMs: 18, peak: 0.6 });
    expect(points[0]).toEqual({ atMs: 0, gain: 0 });
    expect(points[1]).toEqual({ atMs: 3, gain: 0.6 });
    expect(points[points.length - 1]).toEqual({ atMs: 42, gain: 0 });
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i].atMs).toBeGreaterThan(points[i - 1].atMs);
      expect(points[i].gain).toBeGreaterThanOrEqual(0);
      expect(points[i].gain).toBeLessThanOrEqual(0.6);
    }
  });

  it("起音 + 释放超过单音时长时自动收窄，不会出现负的保持段", () => {
    const points = buildEnvelope({ durationMs: 20, attackMs: 15, releaseMs: 15, peak: 0.5 });
    const times = points.map((p) => p.atMs);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
      expect(times[i]).toBeLessThanOrEqual(20);
    }
    expect(points[points.length - 1].gain).toBe(0);
  });

  it("峰值被夹在 0~1，非法时长也不会抛错", () => {
    const points = buildEnvelope({ durationMs: 0, attackMs: -5, releaseMs: Number.NaN, peak: 9 });
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points.every((p) => p.gain >= 0 && p.gain <= 1)).toBe(true);
  });

  it("startMs 偏移整体平移", () => {
    const points = buildEnvelope({ startMs: 100, durationMs: 10, attackMs: 1, releaseMs: 2, peak: 0.4 });
    expect(points[0].atMs).toBe(100);
    expect(points[points.length - 1].atMs).toBe(110);
  });
});

describe("排期与总时长", () => {
  it("单音按频率序列依次排布，间隔取自 gapMs", () => {
    const spec = getSound("ok-l1");
    const spans = scheduleTones(spec);
    expect(spans).toHaveLength(spec.tones.length);
    expect(spans[0].startMs).toBe(0);
    expect(spans[1].startMs).toBe(spec.tones[0].durationMs + spec.gapMs);
    expect(spans.map((s) => s.freq)).toEqual(spec.tones.map((t) => t.freq));
    expect(spans.every((s) => s.gain === 1)).toBe(true);
  });

  it("总时长取 tone 序列与噪声包络的较大者", () => {
    const reject = totalDurationMs(getSound("fail-reject"));
    expect(reject).toBe(52 + 6 + 52);
    const incident = totalDurationMs(getSound("fail-incident"));
    expect(incident).toBe(380); // 噪声包络比两个低频音更长
  });

  it("只有事故音允许超过 180 ms，且全部 ≤400 ms", () => {
    for (const spec of SOUND_LIST) {
      const total = totalDurationMs(spec);
      expect(total).toBeLessThanOrEqual(400);
      if (spec.id !== "fail-incident") expect(total).toBeLessThanOrEqual(180);
    }
  });
});

describe("静音偏好（localStorage 记忆，纯逻辑可注入）", () => {
  it("parseMuted 只认 1/true", () => {
    expect(parseMuted("1")).toBe(true);
    expect(parseMuted("true")).toBe(true);
    expect(parseMuted("0")).toBe(false);
    expect(parseMuted(null)).toBe(false);
    expect(parseMuted("")).toBe(false);
  });

  it("读写往返一致，缺省为不静音（默认开启）", () => {
    const storage = fakeStorage();
    expect(readMuted(storage)).toBe(false);
    writeMuted(true, storage);
    expect(storage.data[STORAGE_KEY]).toBe("1");
    expect(readMuted(storage)).toBe(true);
    writeMuted(false, storage);
    expect(readMuted(storage)).toBe(false);
  });

  it("storage 抛错时静默降级，不把异常抛给业务", () => {
    const broken: MuteStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(readMuted(broken)).toBe(false);
    expect(() => writeMuted(true, broken)).not.toThrow();
    expect(readMuted(null)).toBe(false);
  });
});

describe("静音状态与订阅", () => {
  beforeEach(() => setMuted(false));
  afterEach(() => setMuted(false));

  it("toggleMuted 翻转并返回新状态", () => {
    expect(isMuted()).toBe(false);
    expect(toggleMuted()).toBe(true);
    expect(isMuted()).toBe(true);
    expect(toggleMuted()).toBe(false);
  });

  it("订阅者收到变更通知，取消订阅后不再收到", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMuted(listener);
    setMuted(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setMuted(true); // 值没变不重复通知
    expect(listener).toHaveBeenCalledTimes(1);
    setMuted(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setMuted(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("单个订阅者抛错不影响其他订阅者", () => {
    const good = vi.fn();
    const offBad = subscribeMuted(() => {
      throw new Error("boom");
    });
    const offGood = subscribeMuted(good);
    expect(() => setMuted(true)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    offBad();
    offGood();
  });
});

describe("SSR / 无 Web Audio 环境静默降级", () => {
  it("node 环境下不创建 AudioContext，ensureAudio 返回 null", () => {
    expect(typeof (globalThis as { AudioContext?: unknown }).AudioContext).toBe("undefined");
    expect(ensureAudio()).toBeNull();
  });

  it("playSound 在 SSR / 静音 / 未知环境都不抛错", () => {
    expect(() => playSound("ok-l1")).not.toThrow();
    expect(() => playSound("fail-incident", { delayMs: 120 })).not.toThrow();
    expect(() => playSound("ok-l3", { delayMs: Number.POSITIVE_INFINITY })).not.toThrow();
    setMuted(true);
    expect(() => playSound("ok-l2")).not.toThrow();
  });

  it("disposeAudio 重复调用安全", () => {
    expect(() => {
      disposeAudio();
      disposeAudio();
    }).not.toThrow();
  });
});

describe("与 kinds 表的契约", () => {
  it("每条音效的峰值都在主增益预算内", () => {
    for (const spec of SOUND_LIST) {
      expect(effectivePeakGain(spec)).toBeLessThanOrEqual(MAX_EFFECTIVE_GAIN);
    }
  });
});
