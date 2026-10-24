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

/**
 * 第一次 `new AudioContext()` 在本机会同步阻塞 **59~190ms**（实测 2026-10-24，第五轮）：
 * 这一步是开音频设备，跟动画同一帧就会顶出一个 165ms 长帧。
 * 所以：**绝不在手势回调里同步建**。改成
 *   1. 页面空闲时先建（`primeAudio()`，构造完是 suspended 也无所谓）；
 *   2. 手势里只 `resume()`（实测 0.2ms）；
 *   3. 还没建好时来的声音先入队，建好后补播（超过 TTL 的丢掉，不补一声迟到的）。
 */
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let visibilityBound = false;
/** 初始化已经排进空闲队列（防重复排） */
let initScheduled = false;
/** 还没建好时来的声音 */
const pending: { id: SoundId; dueAt: number }[] = [];
const MAX_PENDING = 4;
const PENDING_TTL_MS = 600;

type AudioContextCtor = new () => AudioContext;

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
 * 同步建 AudioContext（内部用；**只允许从空闲回调或非手势路径调**）。
 * 返回 null 表示当前环境不支持，调用方应静默降级。
 */
function createAudio(): AudioContext | null {
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

/** 建好后把排队的声音补播（超过 TTL 的丢掉：宁可这一声不响，也不要迟到几百毫秒才响）。 */
function flushPending(ctx: AudioContext): void {
  if (!pending.length) return;
  const now = typeof performance === "undefined" ? Date.now() : performance.now();
  const due = pending.splice(0, pending.length);
  for (const item of due) {
    const late = now - item.dueAt;
    if (late > PENDING_TTL_MS) continue;
    playNow(ctx, item.id, Math.max(0, -late));
  }
}

/** 把「建 AudioContext」排到空闲时（不阻塞当前帧）。 */
function scheduleAudioInit(): void {
  if (audioContext || initScheduled) return;
  if (!getAudioContextCtor()) return;
  initScheduled = true;
  const run = () => {
    initScheduled = false;
    const ctx = createAudio();
    if (!ctx) {
      pending.length = 0;
      return;
    }
    flushPending(ctx);
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof idle === "function") {
    // timeout 保底：真忙的时候也别一直不建，1.5s 内必须建出来
    idle(run, { timeout: 1500 });
    return;
  }
  window.setTimeout(run, 0);
}

/**
 * 预热音频：页面挂载后调一次，把「开音频设备」这 60~190ms 摊到没人看得见的空闲里。
 * 建出来是 suspended 也没关系，真正出声前 `playSound` 会 resume（0.2ms）。
 */
export function primeAudio(): void {
  scheduleAudioInit();
}

/**
 * 确保 AudioContext 存在（调用点在手势里时**不会**同步建，改为排进空闲队列）。
 * 返回 null 表示「还没建好 / 环境不支持」，调用方按静默降级处理。
 */
export function ensureAudio(): AudioContext | null {
  if (audioContext) return audioContext;
  scheduleAudioInit();
  return null;
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

/** 立刻把一条音效排进给定的 context（不做建/恢复）。 */
function playNow(ctx: AudioContext, id: SoundId, delaySec: number): void {
  try {
    const spec = getSound(id);
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const startSec = ctx.currentTime + 0.01 + delaySec;
    scheduleSpec(ctx, spec, startSec);
  } catch {
    // 静默降级
  }
}

/**
 * 播一条音效。**任何情况下都不抛错**：静音 / SSR / 不支持 / Context 创建失败均静默返回。
 *
 * 注意：AudioContext 还没建好时**不在这里同步建**（那是 60~190ms 的主线程阻塞），
 * 改为入队 + 排进空闲队列，建好后再补播；迟到的超过 600ms 就不响了。
 *
 * @example playSound("ok-l2")
 */
export function playSound(id: SoundId, opts: PlayOptions = {}): void {
  try {
    if (isMuted()) return;
    const delaySec = clampDelayMs(opts.delayMs, MAX_DELAY_MS) / 1000;
    const ctx = audioContext;
    if (!ctx) {
      // 入队（丢了最旧的），等空闲建好后补播
      if (pending.length >= MAX_PENDING) pending.shift();
      const now = typeof performance === "undefined" ? Date.now() : performance.now();
      pending.push({ id, dueAt: now + delaySec * 1000 });
      scheduleAudioInit();
      return;
    }
    playNow(ctx, id, delaySec);
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
  initScheduled = false;
  pending.length = 0;
}
