import { describe, expect, it } from "vitest";
import {
  MASTER_GAIN,
  MAX_EFFECTIVE_GAIN,
  MAX_FREQ_HZ,
  MAX_INCIDENT_MS,
  MAX_STANDARD_MS,
  MIN_FREQ_HZ,
  SOUND_DOMAINS,
  SOUND_LIST,
  TONE_WAVES,
  effectivePeakGain,
  getSound,
  type SoundId,
  type SoundSpec,
} from "./kinds";

const REQUIRED_IDS: readonly SoundId[] = [
  "ok-l1",
  "ok-l2",
  "ok-l3",
  "fail-reject",
  "fail-incident",
  "tick",
  "drop",
  "error-system",
];

const spans = (spec: SoundSpec) => {
  const total =
    spec.tones.reduce((sum, tone) => sum + tone.durationMs, 0) +
    spec.gapMs * Math.max(0, spec.tones.length - 1);
  return { total, singleMax: Math.max(...spec.tones.map((t) => t.durationMs)) };
};

describe("音效语义表", () => {
  it("至少 8 条，且 id 唯一、与契约清单一一对应", () => {
    expect(SOUND_LIST.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SOUND_LIST.map((s) => s.id)).size).toBe(SOUND_LIST.length);
    expect(new Set(SOUND_LIST.map((s) => s.id))).toEqual(new Set(REQUIRED_IDS));
  });

  it("每条都有中文名、用途说明与合法语义域 / 波形", () => {
    for (const spec of SOUND_LIST) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.use.length).toBeGreaterThan(4);
      expect(SOUND_DOMAINS).toContain(spec.domain);
      expect(TONE_WAVES).toContain(spec.wave);
      expect(spec.tones.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("三个语义域全部被覆盖（ok / fail / info）", () => {
    expect(new Set(SOUND_LIST.map((s) => s.domain))).toEqual(new Set(["ok", "fail", "info"]));
  });

  it("频率与单音时长都在听觉安全区间", () => {
    for (const spec of SOUND_LIST) {
      // 事故音单独放宽（总长 ≤400），其余单音一律 ≤180
      const singleLimit = spec.id === "fail-incident" ? MAX_INCIDENT_MS : MAX_STANDARD_MS;
      for (const tone of spec.tones) {
        expect(tone.freq).toBeGreaterThanOrEqual(MIN_FREQ_HZ);
        expect(tone.freq).toBeLessThanOrEqual(MAX_FREQ_HZ);
        expect(tone.durationMs).toBeGreaterThanOrEqual(10);
        expect(tone.durationMs).toBeLessThanOrEqual(singleLimit);
        expect(tone.gain ?? 1).toBeGreaterThan(0);
        expect(tone.gain ?? 1).toBeLessThanOrEqual(1);
      }
      expect(spec.attackMs).toBeGreaterThanOrEqual(0);
      expect(spec.releaseMs).toBeGreaterThanOrEqual(0);
      expect(spec.attackMs + spec.releaseMs).toBeLessThanOrEqual(spans(spec).singleMax);
    }
  });

  it("音量克制：主增益与每条实际峰值都 ≤ 0.08（≈ -22 dB）", () => {
    expect(MASTER_GAIN).toBeLessThanOrEqual(MAX_EFFECTIVE_GAIN);
    expect(MAX_EFFECTIVE_GAIN).toBeLessThanOrEqual(0.08);
    for (const spec of SOUND_LIST) {
      const peak = effectivePeakGain(spec);
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThanOrEqual(MAX_EFFECTIVE_GAIN);
      // tone 与噪声叠加不超过 1，保证峰值不会被叠加顶穿
      expect(spec.gain + (spec.noise?.gain ?? 0)).toBeLessThanOrEqual(1);
    }
  });

  it("常规音效单次 ≤180 ms；事故音 ≤400 ms 且带噪声包络", () => {
    for (const spec of SOUND_LIST) {
      const { total } = spans(spec);
      const withNoise = Math.max(total, spec.noise?.durationMs ?? 0);
      if (spec.id === "fail-incident") {
        expect(withNoise).toBeLessThanOrEqual(MAX_INCIDENT_MS);
        expect(spec.noise).toBeDefined();
        expect(spec.noise?.filterHz).toBeLessThanOrEqual(1000);
      } else {
        expect(withNoise).toBeLessThanOrEqual(MAX_STANDARD_MS);
      }
    }
  });

  it("成功音是上行正弦三音，且级别越高越完整（l1 最轻最快）", () => {
    const [l1, l2, l3] = (["ok-l1", "ok-l2", "ok-l3"] as const).map(getSound);
    for (const spec of [l1, l2, l3]) {
      expect(spec.domain).toBe("ok");
      expect(spec.wave).toBe("sine");
      expect(spec.tones.length).toBeGreaterThanOrEqual(3);
      const freqs = spec.tones.map((t) => t.freq);
      const ascending = freqs.every((freq, i) => i === 0 || freq > freqs[i - 1]);
      expect(ascending).toBe(true);
    }
    expect(spans(l1).total).toBeLessThan(spans(l2).total);
    expect(spans(l2).total).toBeLessThanOrEqual(spans(l3).total);
    expect(l1.gain).toBeLessThan(l2.gain);
    expect(l2.gain).toBeLessThan(l3.gain);
  });

  it("拒收 = 低频短促；系统错误 = 下行两音", () => {
    const reject = getSound("fail-reject");
    expect(reject.domain).toBe("fail");
    expect(reject.tones.every((t) => t.freq < 500)).toBe(true);
    expect(reject.wave).not.toBe("square");
    const spansMs = spans(reject).total;
    expect(spansMs).toBeLessThanOrEqual(150);

    const sys = getSound("error-system");
    expect(sys.domain).toBe("fail");
    expect(sys.tones).toHaveLength(2);
    expect(sys.tones[0].freq).toBeGreaterThan(sys.tones[1].freq);
  });

  it("tick 极轻（增益与时长都是全场最低档）", () => {
    const tick = getSound("tick");
    expect(tick.domain).toBe("info");
    expect(tick.tones).toHaveLength(1);
    expect(tick.tones[0].durationMs).toBeLessThanOrEqual(30);
    for (const other of SOUND_LIST) {
      if (other.id === "tick") continue;
      expect(tick.gain).toBeLessThan(other.gain);
    }
  });

  it("drop 是液体隐喻的上行小滑音", () => {
    const drop = getSound("drop");
    expect(drop.domain).toBe("info");
    expect(drop.tones).toHaveLength(2);
    expect(drop.tones[1].freq).toBeGreaterThan(drop.tones[0].freq);
  });

  it("getSound 能按 id 取到，未知 id 抛错", () => {
    expect(getSound("ok-l2").label).toContain("步骤");
    expect(() => getSound("nope" as SoundId)).toThrow(/未知音效/);
  });
});
