/**
 * 音效时序纯逻辑：包络、单音排期、总时长。
 *
 * 不碰 window / AudioContext，node 环境可直接单测。
 * 引擎（lib/audio/engine.ts）只负责把这里算出来的时间点写进 Web Audio 参数。
 */

import type { SoundSpec } from "./kinds";

export interface EnvelopePoint {
  atMs: number;
  gain: number;
}

/**
 * 生成一个单音的简化 ADSR 包络（起音 → 保持 → 释放），
 * 用于 `gain.setValueAtTime / linearRampToValueAtTime`。
 * attack + release 超过 duration 时自动收窄，保证时间单调递增。
 */
export function buildEnvelope(input: {
  startMs?: number;
  durationMs: number;
  attackMs: number;
  releaseMs: number;
  peak: number;
}): EnvelopePoint[] {
  const start = input.startMs ?? 0;
  const duration = Math.max(1, input.durationMs);
  const peak = Math.max(0, Math.min(1, input.peak));
  const attack = Math.max(0, Math.min(input.attackMs, duration));
  const release = Math.max(0, Math.min(input.releaseMs, duration - attack));
  const end = start + duration;
  const sustainEnd = end - release;

  const raw: EnvelopePoint[] = [
    { atMs: start, gain: 0 },
    { atMs: start + attack, gain: peak },
    { atMs: sustainEnd, gain: peak },
    { atMs: end, gain: 0 },
  ];

  const merged: EnvelopePoint[] = [];
  for (const point of raw) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.atMs - point.atMs) < 0.001) {
      last.gain = point.gain;
      continue;
    }
    merged.push({ ...point });
  }
  return merged;
}

export interface ToneSpan {
  freq: number;
  startMs: number;
  durationMs: number;
  /** 相对增益 0~1（整条音效的 spec.gain 由引擎再乘，这里只含单音比例）。 */
  gain: number;
}

/** 按频率序列排出每个单音的起止时间（纯计算，供引擎和测试共用）。 */
export function scheduleTones(spec: SoundSpec, startMs = 0): ToneSpan[] {
  const spans: ToneSpan[] = [];
  let cursor = startMs;
  for (const tone of spec.tones) {
    spans.push({
      freq: tone.freq,
      startMs: cursor,
      durationMs: tone.durationMs,
      gain: Math.max(0, Math.min(1, tone.gain ?? 1)),
    });
    cursor += tone.durationMs + spec.gapMs;
  }
  return spans;
}

/** 单条音效总时长 ms（取 tone 序列与噪声包络的较大者）。 */
export function totalDurationMs(spec: SoundSpec): number {
  const spans = scheduleTones(spec);
  const last = spans[spans.length - 1];
  const toneTotal = last ? last.startMs + last.durationMs : 0;
  return Math.max(toneTotal, spec.noise?.durationMs ?? 0);
}

/** 调用方传入的延迟（ms）做安全夹取，防止把声音排到几秒后。 */
export function clampDelayMs(delayMs: number | undefined, maxMs: number): number {
  if (!Number.isFinite(delayMs) || !delayMs || delayMs <= 0) return 0;
  return Math.min(maxMs, delayMs);
}
