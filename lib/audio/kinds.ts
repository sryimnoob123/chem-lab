/**
 * 音效语义表 —— 纯数据，无副作用，可在 node 环境直接单测。
 *
 * 设计口径（见 docs/design/STYLE-20261021.md §3/§4，用户口径优先）：
 * - 零素材：全部由 Web Audio 振荡器 + 噪声程序化合成，不落任何音频文件；
 * - 克制：默认开启但极轻，峰值 ≤ 0.08（≈ -22 dB，比 -18 dB 还低）；
 * - 成功 = 上行正弦三音；拒收 = 低频短促；事故 = 带噪声包络且 ≤400 ms；
 * - 单次音效（事故除外）总时长 ≤180 ms，不循环、不做背景音乐。
 *
 * 本文件只描述"该响什么"，怎么响由 lib/audio/engine.ts 负责。
 */

export type SoundId =
  | "ok-l1"
  | "ok-l2"
  | "ok-l3"
  | "fail-reject"
  | "fail-incident"
  | "tick"
  | "drop"
  | "error-system";

/** 语义域：ok 正反馈 / fail 负反馈 / info 中性提示。 */
export type SoundDomain = "ok" | "fail" | "info";

/** 合成波形。成功系一律 sine（不刺耳）；负反馈用 triangle / 低频 sawtooth。 */
export type ToneWave = "sine" | "triangle" | "square" | "sawtooth";

export interface SoundTone {
  /** 频率 Hz，必须落在 62.5~2000 的听觉安全区。 */
  freq: number;
  /** 单音时长 ms，10~180。 */
  durationMs: number;
  /** 相对整条音效的增益比例 0~1，缺省 1。 */
  gain?: number;
}

export interface SoundNoise {
  durationMs: number;
  /** 相对整条音效的增益比例 0~1，与 tone 叠加后总和必须 ≤1。 */
  gain: number;
  /** 低通截止 Hz，压掉刺耳的高频毛刺。 */
  filterHz: number;
}

export interface SoundSpec {
  id: SoundId;
  /** 中文名（设置面板 / 无障碍文案用）。 */
  label: string;
  domain: SoundDomain;
  wave: ToneWave;
  /** 频率序列（按播放顺序）。 */
  tones: readonly SoundTone[];
  /** 相邻单音的间隔 ms。 */
  gapMs: number;
  /** 起音时长 ms。 */
  attackMs: number;
  /** 释放时长 ms。 */
  releaseMs: number;
  /** 整条音效峰值增益（相对主增益）0~1；主增益 × 它 ≤ 0.08。 */
  gain: number;
  noise?: SoundNoise;
  /** 一句话用途，供 handoff / 接线时对照。 */
  use: string;
}

/** 主增益：整条链路的绝对上限，约 -22 dB。 */
export const MASTER_GAIN = 0.08;
/** 单条音效绝对峰值上限（= MASTER_GAIN × 1）。 */
export const MAX_EFFECTIVE_GAIN = 0.08;
/** 常规音效总时长上限 ms（事故音单独放宽到 MAX_INCIDENT_MS）。 */
export const MAX_STANDARD_MS = 180;
/** 事故音总时长上限 ms。 */
export const MAX_INCIDENT_MS = 400;
/** 听觉安全频率区间 Hz。 */
export const MIN_FREQ_HZ = 62.5;
export const MAX_FREQ_HZ = 2000;

export const SOUND_DOMAINS: readonly SoundDomain[] = ["ok", "fail", "info"];
export const TONE_WAVES: readonly ToneWave[] = ["sine", "triangle", "square", "sawtooth"];

export const SOUND_LIST: readonly SoundSpec[] = [
  {
    id: "ok-l1",
    label: "动作正确（微反馈）",
    domain: "ok",
    wave: "sine",
    // 一级微反馈：三音上行但更短更轻，几乎只是"听见一点对"
    tones: [
      { freq: 660, durationMs: 30 },
      { freq: 880, durationMs: 30 },
      { freq: 1046.5, durationMs: 30 },
    ],
    gapMs: 4,
    attackMs: 2,
    releaseMs: 12,
    gain: 0.42,
    use: "单个动作判定正确（对应 STYLE §3.1 L1 微反馈）",
  },
  {
    id: "ok-l2",
    label: "步骤完成",
    domain: "ok",
    wave: "sine",
    // 步骤完成：同样的上行三音，音长稍宽、力度稍高
    tones: [
      { freq: 523.25, durationMs: 44 },
      { freq: 659.25, durationMs: 44 },
      { freq: 783.99, durationMs: 44 },
    ],
    gapMs: 5,
    attackMs: 3,
    releaseMs: 16,
    gain: 0.62,
    use: "一步走完、stepIndex 前进（STYLE §3.1 L2）",
  },
  {
    id: "ok-l3",
    label: "实验完成 / 出分",
    domain: "ok",
    wave: "sine",
    // 里程碑：四音大调琶音，总长压到 177 ms（< 180）
    tones: [
      { freq: 523.25, durationMs: 42 },
      { freq: 659.25, durationMs: 42 },
      { freq: 783.99, durationMs: 42 },
      { freq: 1046.5, durationMs: 42 },
    ],
    gapMs: 3,
    attackMs: 3,
    releaseMs: 18,
    gain: 0.78,
    use: "交卷 / 报告生成 / 满分（STYLE §3.1 L3）",
  },
  {
    id: "fail-reject",
    label: "操作被拒收",
    domain: "fail",
    wave: "triangle",
    // 低频两音短促下行：疼一下但不刺耳
    tones: [
      { freq: 220, durationMs: 52 },
      { freq: 174.61, durationMs: 52 },
    ],
    gapMs: 6,
    attackMs: 2,
    releaseMs: 22,
    gain: 0.55,
    use: "投错目标 / 顺序错 / 拖到无效位置（STYLE §4.1 E1 拒收）",
  },
  {
    id: "fail-incident",
    label: "实验事故",
    domain: "fail",
    wave: "sawtooth",
    // 低频闷响 + 低通噪声包络，总长 380 ms（< 400）
    tones: [
      { freq: 110, durationMs: 200 },
      { freq: 82.41, durationMs: 160 },
    ],
    gapMs: 4,
    attackMs: 8,
    releaseMs: 60,
    gain: 0.55,
    noise: { durationMs: 380, gain: 0.4, filterHz: 750 },
    use: "违规触发事故 L3/L4（STYLE §4.1 E2 事故）",
  },
  {
    id: "tick",
    label: "刻度微响",
    domain: "info",
    wave: "sine",
    // 极轻单音，只在前台安静环境里隐约可闻
    tones: [{ freq: 1200, durationMs: 16 }],
    gapMs: 0,
    attackMs: 1,
    releaseMs: 6,
    gain: 0.18,
    use: "读数变化 / 悬停刻度 / 开关自检（最轻，可高频使用）",
  },
  {
    id: "drop",
    label: "液滴落定",
    domain: "info",
    wave: "sine",
    // 上行小滑音，模拟一滴液落进液面的"叮"
    tones: [
      { freq: 1046.5, durationMs: 26 },
      { freq: 1568, durationMs: 26 },
    ],
    gapMs: 3,
    attackMs: 1,
    releaseMs: 10,
    gain: 0.35,
    use: "滴定液滴落定 / 加液完成（液体隐喻，STYLE §2.2）",
  },
  {
    id: "error-system",
    label: "系统错误",
    domain: "fail",
    wave: "triangle",
    // 下行两音，比拒收更"闷"，提示是环境问题而非学生操作错
    tones: [
      { freq: 440, durationMs: 60 },
      { freq: 329.63, durationMs: 60 },
    ],
    gapMs: 6,
    attackMs: 3,
    releaseMs: 24,
    gain: 0.5,
    use: "网络失败 / 接口 5xx / 登录失败（STYLE §4.1 E3 系统错误）",
  },
];

const BY_ID = new Map<SoundId, SoundSpec>(SOUND_LIST.map((spec) => [spec.id, spec]));

export function getSound(id: SoundId): SoundSpec {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`未知音效：${id}`);
  return found;
}

/** 某条音效的实际峰值增益（绝对量，tone 与 noise 叠加后封顶）。 */
export function effectivePeakGain(spec: SoundSpec): number {
  const noisePeak = spec.noise ? spec.noise.gain : 0;
  return MASTER_GAIN * Math.min(1, spec.gain + noisePeak);
}
