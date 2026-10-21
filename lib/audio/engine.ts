/**
 * 音效引擎 —— Web Audio API 程序化合成（零素材、零库、零网络请求）。
 *
 * 硬约束（都被单测/约定钉住）：
 * - 模块顶层**绝不**创建 AudioContext；首次 playSound 且浏览器支持时才懒加载；
 * - 主增益 0.08（≈ -22 dB），单条音效峰值 ≤0.08；
 * - 静音偏好落 localStorage（见 ./preference），页面隐藏时 suspend；
 * - SSR / 不支持 Web Audio / 隐私模式一律静默降级，不抛错。
 *
 * 纯逻辑在 ./timing 与 ./preference，这里只做浏览器侧合成。
 */

import {
  MASTER_GAIN,
  MAX_EFFECTIVE_GAIN,
  getSound,
  type SoundId,
  type SoundSpec,
} from "./kinds";
import {
  clampDelayMs,
  buildEnvelope,
  scheduleTones,
  totalDurationMs,
} from "./timing";
import { isMuted, subscribeMuted } from "./preference";

export { MASTER_GAIN, MAX_EFFECTIVE_GAIN, totalDurationMs };
export {
  STORAGE_KEY,
  isMuted,
  parseMuted,
  readMuted,
  setMuted,
  subscribeMuted,
  toggleMuted,
  writeMuted,
  type MuteStorage,
} from "./preference";
export { buildEnvelope, scheduleTones, type EnvelopePoint, type ToneSpan } from "./timing";

/** 延迟播放上限，防止调用方传个离谱值把声音排到几秒后。 */
const MAX_DELAY_MS = 2000;

type AudioContextCtor = new () => AudioContext;

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let visibilityBound = false;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const scoped = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = scoped.AudioContext ?? scoped.webkitAudioContext;
  return typeof Ctor === "function" ? Ctor : null;
}

/** 主增益：未静音时 = MASTER_GAIN，静音时 = 0；节点不存在则什么都不做。 */
function applyMasterGain(): void {
  if (!audioContext || !masterGain) return;
  try {
    const now = audioContext.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(isMuted() ? 0 : MASTER_GAIN, now, 0.01);
  } catch {
    // 忽略：节点已关闭或浏览器实现差异
  }
}

function bindVisibility(ctx: AudioContext): void {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    try {
      if (document.visibilityState === "hidden") {
        if (ctx.state === "running") void ctx.suspend().catch(() => {});
        return;
      }
      if (!isMuted() && ctx.state === "suspended") void ctx.resume().catch(() => {});
    } catch {
      // 忽略
    }
  });
}

/**
 * 懒加载 AudioContext（必须在用户交互里首次调用才不违反自动播放策略）。
 * 返回 null 表示当前环境不支持，调用方应静默降级。
 */
export function ensureAudio(): AudioContext | null {
  if (audioContext) return audioContext;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = isMuted() ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
    audioContext = ctx;
    masterGain = master;
    bindVisibility(ctx);
    // 静音切换时做 10ms 淡出/淡入，避免"咔"声
    subscribeMuted(applyMasterGain);
    return ctx;
  } catch {
    audioContext = null;
    masterGain = null;
    return null;
  }
}

function noiseBuffer(ctx: AudioContext, durationMs: number): AudioBuffer {
  const length = Math.max(1, Math.floor((ctx.sampleRate * durationMs) / 1000));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    // 白噪声 + 线性衰减，避免"嘶"个不停
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  return buffer;
}

function scheduleNoise(
  ctx: AudioContext,
  spec: SoundSpec,
  startSec: number,
  output: AudioNode,
): void {
  if (!spec.noise) return;
  const noise = spec.noise;
  const durationSec = noise.durationMs / 1000;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, noise.durationMs);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = noise.filterHz;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startSec);
  env.gain.linearRampToValueAtTime(noise.gain, startSec + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, startSec + durationSec);

  source.connect(filter);
  filter.connect(env);
  env.connect(output);
  source.start(startSec);
  source.stop(startSec + durationSec + 0.02);
}

function scheduleSpec(ctx: AudioContext, spec: SoundSpec, startSec: number): void {
  const output = masterGain ?? ctx.destination;

  for (const span of scheduleTones(spec)) {
    const at = startSec + span.startMs / 1000;
    const envelope = buildEnvelope({
      durationMs: span.durationMs,
      attackMs: spec.attackMs,
      releaseMs: spec.releaseMs,
      peak: spec.gain * span.gain,
    });

    const osc = ctx.createOscillator();
    osc.type = spec.wave;
    osc.frequency.setValueAtTime(span.freq, at);

    const gain = ctx.createGain();
    for (const point of envelope) {
      const when = at + point.atMs / 1000;
      if (point.atMs === 0) {
        gain.gain.setValueAtTime(point.gain, when);
      } else {
        gain.gain.linearRampToValueAtTime(point.gain, when);
      }
    }

    osc.connect(gain);
    gain.connect(output);
    osc.start(at);
    osc.stop(at + span.durationMs / 1000 + 0.02);
  }

  scheduleNoise(ctx, spec, startSec, output);
}

export interface PlayOptions {
  /** 延迟毫秒（用于与视觉反馈对拍），上限 2000。 */
  delayMs?: number;
}

/**
 * 播一条音效。**任何情况下都不抛错**：静音 / SSR / 不支持 / Context 创建失败均静默返回。
 * 需在用户交互链路里调用（点击、拖拽、键盘），否则浏览器会挂起音频。
 *
 * @example playSound("ok-l2")
 */
export function playSound(id: SoundId, opts: PlayOptions = {}): void {
  try {
    if (isMuted()) return;
    const spec = getSound(id);
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const startSec =
      ctx.currentTime + 0.01 + clampDelayMs(opts.delayMs, MAX_DELAY_MS) / 1000;
    scheduleSpec(ctx, spec, startSec);
  } catch {
    // 静默降级：音效永远不能把业务链路打挂
  }
}

/** 关闭并释放 AudioContext（组件卸载 / 测试用）；重复调用安全。 */
export function disposeAudio(): void {
  try {
    if (audioContext) {
      void audioContext.close().catch(() => {});
    }
  } catch {
    // 忽略
  }
  audioContext = null;
  masterGain = null;
}
