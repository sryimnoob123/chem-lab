"use client";

/**
 * 事故演出（唯一入口的场景层）
 *
 * 用户口径（2026-10-23）：「事故在动画中途炸（错误演示面板复用同一套资源），炸完再出说明。」
 *
 * 这条时间线只有一条，正常路径与事故**不是两段动画**：
 *   0 ── lead ──┬── hazard ──┬── settle ── 结束
 *   起手错操作    中途出事       余波归位
 * （倒液倒到一半 / 加热到一半 / 搅拌到一半 → 瓶身裂 / 液面暴沸 → 液面回到原位）
 *
 * 三条硬约束：
 * 1. 复用实验台：器皿坐标来自 `anchorOf`（和倾倒/搅拌动作同一份几何），液体用同一个器身
 *    clipPath、同一组 `--scene-*` token；不再有第二个小场景；
 * 2. 液面连续：液体层是一条贯穿整条时间线的 beat（base → lead → surge → base），
 *    出事那一段不会把液面重置回 0；
 * 3. 只动 transform / opacity，事故段不 setState（父组件只在播完后出说明）。
 *
 * 起手动作（`op`）：
 *   pour 洗瓶沿壁倒液 / heat 器底加热 / stir 玻璃棒搅洗 / poke 玻璃棒插进器皿捅洗
 * 出了什么事由 `fx`（8 个视觉键）决定，见 incident-art.tsx。
 */

import type { ReactNode } from "react";
import { liquidBox } from "../vessels/vessel-geometry";
import { bodyTransform, levelShift, type VesselAnchor } from "./geometry";
import type { Beat } from "./timeline";
import { EASE_IN_OUT, EASE_OUT } from "./timeline";
import type { ActionScene } from "./rinse";
import { hazardArt, type IncidentFx } from "./incident-art";

export type IncidentOp = "pour" | "heat" | "stir" | "poke";

/** 时间线刻度（ms）：事故在 lead 处炸 = 操作做到 1/3 时。 */
export const INCIDENT_TIMING = { lead: 720, hazard: 900, settle: 540 } as const;
export const INCIDENT_TOTAL_MS =
  INCIDENT_TIMING.lead + INCIDENT_TIMING.hazard + INCIDENT_TIMING.settle;

const WATER = "var(--scene-water)";
const EDGE = "var(--scene-water-edge)";
const GLASS = "var(--scene-glass-fill)";

export type BuildIncidentOptions = {
  fx: IncidentFx;
  op: IncidentOp;
  clipId: string;
  /** 器皿原本的液位（0 空 / 0.38 常见）；事故结束后回到这里，卸下层时不会跳 */
  baseLevel: number;
};

/** 起手错操作的画面（0 → lead） */
function leadArt(a: VesselAnchor, op: IncidentOp): ReactNode {
  if (op === "pour") {
    // 洗瓶在器口上方，液柱贴着内壁往下淌（「沿壁倒入」的错法正是这条）
    const spoutX = a.mouthX + a.rx * 0.9;
    const spoutY = a.mouthY - 52;
    const wallX = a.mouthX - a.rx * 0.5;
    return (
      <>
        <g data-i="bottle" style={{ transformBox: "view-box", transformOrigin: `${spoutX}px ${spoutY}px` }}>
          <rect x={spoutX - 4} y={spoutY - 26} width={20} height={26} rx={6} fill={GLASS} stroke={EDGE} strokeWidth={1.3} />
          <path d={`M${spoutX + 6} ${spoutY - 26} q0 -9 -9 -9 h-3`} fill="none" stroke={EDGE} strokeWidth={2.1} strokeLinecap="round" />
        </g>
        <path
          data-i="stream"
          d={`M${spoutX} ${spoutY} L${wallX} ${a.surfaceY + 4}`}
          fill="none"
          stroke={WATER}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0}
          style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
          aria-hidden="true"
        />
      </>
    );
  }

  if (op === "heat") {
    const flameY = a.baseY + 2;
    return (
      <g data-i="flame" style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${flameY}px` }}>
        <path
          d={`M${a.mouthX} ${flameY} q-13 -8 -9 -22 q6 9 9 9 q3 0 9 -9 q4 14 -9 22 z`}
          fill="var(--scene-flame)"
          opacity={0.85}
        />
        <path
          d={`M${a.mouthX} ${flameY - 4} q-7 -6 -5 -15 q4 6 5 6 q1 0 5 -6 q2 9 -5 15 z`}
          fill="var(--scene-flame-core)"
        />
      </g>
    );
  }

  // stir / poke：一根玻璃棒，poke 从正上方直插，stir 斜着搅
  const rodTop = a.mouthY - 46;
  const rodBottom = a.mouthY + (a.baseY - a.mouthY) * (op === "poke" ? 0.62 : 0.48);
  return (
    <g data-i="rod" style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${rodBottom}px` }}>
      <rect
        x={a.mouthX - 1.6}
        y={rodTop}
        width={3.2}
        height={rodBottom - rodTop}
        rx={1.6}
        fill={GLASS}
        stroke={EDGE}
        strokeWidth={1.2}
        transform={`rotate(${op === "poke" ? 2 : 12} ${a.mouthX} ${rodBottom})`}
      />
    </g>
  );
}

/** 起手动作的节拍（0 → lead） */
function leadBeats(a: VesselAnchor, op: IncidentOp, lead: number): Beat[] {
  if (op === "pour") {
    return [
      {
        sel: '[data-i="bottle"]',
        frames: [
          { opacity: 0, transform: "translateY(-14px) rotate(-8deg)" },
          { opacity: 1, transform: "translateY(0px) rotate(0deg)" },
        ],
        duration: 260,
        easing: EASE_OUT,
      },
      {
        sel: '[data-i="stream"]',
        frames: [
          { opacity: 0, transform: "scaleY(0)" },
          { opacity: 0.95, transform: "scaleY(1)", offset: 0.35 },
          { opacity: 0.95, transform: "scaleY(1)" },
        ],
        duration: lead - 200,
        delay: 140,
        easing: EASE_OUT,
      },
      {
        sel: '[data-i="bottle"]',
        frames: [
          { transform: "rotate(0deg)" },
          { transform: "rotate(-16deg)", offset: 0.4 },
          { transform: "rotate(-16deg)" },
        ],
        duration: lead - 240,
        delay: 160,
        easing: EASE_IN_OUT,
      },
    ];
  }

  if (op === "heat") {
    const beats: Beat[] = [
      {
        sel: '[data-i="flame"]',
        frames: [
          { opacity: 0, transform: "scale(.4) scaleY(.2)" },
          { opacity: 0.95, transform: "scale(1) scaleY(1)", offset: 0.55 },
          { opacity: 1, transform: "scale(1.04) scaleY(1.08)" },
        ],
        duration: lead - 120,
        delay: 60,
        easing: EASE_IN_OUT,
      },
      {
        // 器底被烧热的那圈光（只是器身上的一个淡淡的暖光，不是白色高光）
        sel: '[data-i="heatGlow"]',
        frames: [
          { opacity: 0, transform: "scaleX(.6)" },
          { opacity: 0.55, transform: "scaleX(1)", offset: 0.7 },
          { opacity: 0.7, transform: "scaleX(1.08)" },
        ],
        duration: lead - 160,
        delay: 120,
        easing: EASE_OUT,
      },
    ];
    return beats;
  }

  // stir / poke：棒先伸进去，再动
  const total = op === "poke" ? 46 : 12;
  return [
    {
      sel: '[data-i="rod"]',
      frames: [
        { opacity: 0, transform: `translateY(-${total}px) rotate(0deg)` },
        { opacity: 1, transform: "translateY(0px) rotate(0deg)" },
      ],
      duration: op === "poke" ? lead * 0.62 : 260,
      delay: 40,
      easing: EASE_OUT,
    },
    {
      sel: '[data-i="rod"]',
      frames: [
        { transform: "rotate(0deg)" },
        { transform: `rotate(${op === "poke" ? 6 : -14}deg)`, offset: 0.5 },
        { transform: "rotate(0deg)" },
      ],
      duration: lead * 0.5,
      delay: op === "poke" ? lead * 0.62 : 300,
      easing: EASE_IN_OUT,
    },
  ];
}

/**
 * 事故演出的场景（`SceneAction.incident` 就是它）。
 * 返回值里的 `cues` 只有一个：事故开始的那一刻（父组件用它播一声、或做一次轻推）。
 */
export function buildIncident(
  a: VesselAnchor,
  opts: BuildIncidentOptions,
): ActionScene {
  const { lead, hazard } = INCIDENT_TIMING;
  const base = Math.max(0, Math.min(1, opts.baseLevel));
  const ix = a.mouthX + a.rx * 0.22;
  const iy = a.surfaceY + (a.baseY - a.surfaceY) * 0.44;
  /** 器皿自己的液面几何（局部坐标）：液体矩形左右各出壁 6 单位，多出来的被器身裁掉 */
  const box = liquidBox(a.kind);

  /** 液位位移一律换算成**器皿局部坐标**（液体层在 <g transform=scale> 里，见下面 node） */
  const shift = (level: number) => Number((levelShift(a, level) / a.scale).toFixed(2));
  /**
   * 起手阶段液面走到哪：
   * - 倒液：液面从原液位涨上来（半途出事，所以只涨到 0.52）；
   * - 加热：原来有液体才会被加热顶起来；空器皿干烧就一直是空的（这正是「直接加热空烧杯」的场景）；
   * - 搅洗 / 捅洗：不动液面（只是把棒伸进去）。
   */
  const leadLevel =
    opts.op === "pour"
      ? Math.min(0.78, Math.max(base, 0.52))
      : opts.op === "heat" && base > 0.02
        ? Math.min(0.78, Math.max(base, 0.52))
        : base;
  /** 出事那一刻的液面：暴沸/喷溅把它顶到更高 */
  const surgeLevel =
    opts.fx === "explosion" || opts.fx === "boilOver" ? Math.min(0.9, leadLevel + 0.22) : leadLevel;

  const t = (ms: number) => Number((ms / INCIDENT_TOTAL_MS).toFixed(4));

  /** 液体层：一条贯穿全线的 beat，出事前后都不重置（用户口径：液面不许跳变） */
  const liquidBeat: Beat = {
    sel: '[data-i="liquid"]',
    frames: [
      { transform: `translateY(${shift(base)}px)`, offset: 0 },
      { transform: `translateY(${shift(base)}px)`, offset: t(lead * 0.16) },
      { transform: `translateY(${shift(leadLevel)}px)`, offset: t(lead) },
      { transform: `translateY(${shift(surgeLevel)}px)`, offset: t(lead + hazard * 0.22), easing: EASE_OUT },
      { transform: `translateY(${shift(Math.max(base, surgeLevel * 0.9))}px)`, offset: t(lead + hazard * 0.86) },
      { transform: `translateY(${shift(base)}px)`, offset: 1, easing: EASE_IN_OUT },
    ],
    duration: INCIDENT_TOTAL_MS,
    easing: "linear",
  };

  const art = hazardArt(opts.fx, { a, ix, iy });
  const hazardBeats: Beat[] = art.beats.map((beat) => ({
    ...beat,
    delay: (beat.delay ?? 0) + lead,
  }));

  return {
    node: (
      <>
        {/*
          液体层（和实验台 GlassVessel / 洗涤动作同一套画法）：clipPath 用**器皿局部坐标**、
          外面那层 <g transform> 负责把局部坐标摆到台面上。
          两个坑都别踩（2026-10-23 实测，见 docs/液体层裁剪.md）：
            1. transform 不许写在 clipPath 的子 path 上 —— Chrome 在这块台面 SVG 里会忽略裁剪；
            2. clip-path 不许挂在**被 translate 的那层**上 —— 裁剪在元素自己的局部坐标系里生效，
               会跟着液体一起挪：事故里液面从 base 涨到 surge，瓶底那圈就被裁掉/液体下缘浮起来。
          所以裁剪挂在不动的外层 `<g transform>`，动的只有里面 `data-i="liquid"` 那层。
        */}
        <defs>
          <clipPath id={opts.clipId}>
            <path d={a.bodyD} />
          </clipPath>
        </defs>

        <g transform={bodyTransform(a)} clipPath={`url(#${opts.clipId})`}>
          <g data-i="liquid" style={{ transform: `translateY(${shift(base)}px)` }}>
            <rect
              x={box.x - 6}
              y={(a.surfaceY - a.y) / a.scale}
              width={box.w + 12}
              height={(a.baseY - a.surfaceY + 6) / a.scale}
              fill={WATER}
            />
            <ellipse
              cx={(a.mouthX - a.x) / a.scale}
              cy={(a.surfaceY - a.y) / a.scale}
              rx={a.rx / a.scale}
              ry={4.4 / a.scale}
              fill="none"
              stroke={EDGE}
              strokeWidth={1.2 / a.scale}
            />
          </g>
        </g>

        {/* 加热时器底那圈暖光（画在玻璃里，不是外发光） */}
        {opts.op === "heat" ? (
          <ellipse
            data-i="heatGlow"
            cx={a.mouthX}
            cy={a.baseY - 6}
            rx={a.rx * 0.9}
            ry={5}
            fill="var(--scene-flame)"
            opacity={0}
            style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.baseY}px` }}
            aria-hidden="true"
          />
        ) : null}

        {leadArt(a, opts.op)}
        {art.node}
      </>
    ),
    beats: [liquidBeat, ...leadBeats(a, opts.op, lead), ...hazardBeats],
    ms: INCIDENT_TOTAL_MS,
    cues: [{ at: lead, kind: "impact" }, { at: lead + hazard, kind: "settle" }],
  };
}
