"use client";

/**
 * 动作：洗涤（冲水 → 刷洗 → 倒水 → 沥干）
 *
 * 用户口径（2026-10-22）：「把玻璃瓶接了水，用水洗……它都没有任何的动画」。
 * 一次洗涤必须让人看到五件事：水进来、刷/水在器皿里动、水倒出去、内壁挂水珠、晾干。
 *
 * 全部画在实验台同一个 SVG 坐标系里（viewBox 单位），液体用器皿外壳做 clipPath，
 * 所以液面只会长在玻璃里，不会糊到台面上。
 */

import type { ReactNode } from "react";
import { bodyTransform, levelShift, type VesselAnchor } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, type Beat } from "./timeline";

export type RinseVariant = "wash" | "dilute";

export type ActionScene = {
  node: ReactNode;
  beats: Beat[];
  ms: number;
  /** 天平/仪器读数：动作期间数字从 0 滚到 to（小数位 decimals）。 */
  readout?: { to: number; decimals: number };
};

const WATER = "var(--scene-water)";
const EDGE = "var(--scene-water-edge)";

export function buildRinse(
  a: VesselAnchor,
  opts: { variant: RinseVariant; clipId: string; levelStart?: number },
): ActionScene {
  const isDilute = opts.variant === "dilute";
  const empty = levelShift(a, 0);
  const wet = levelShift(a, isDilute ? 0.55 : 0.62);
  const start = levelShift(a, opts.levelStart ?? 0);
  /** 水柱起点：洗瓶嘴在瓶口上方 58 单位处 */
  const spoutY = a.mouthY - 58;

  const node = (
    <>
      <defs>
        <clipPath id={opts.clipId}>
          <path d={a.bodyD} transform={bodyTransform(a)} />
        </clipPath>
      </defs>

      {/* 器皿里的水（被玻璃剪影裁住） */}
      <g
        data-a="water"
        clipPath={`url(#${opts.clipId})`}
        style={{ transform: `translateY(${start}px)` }}
      >
        <rect
          x={a.x - 4}
          y={a.surfaceY}
          width={a.w + 8}
          height={a.baseY - a.surfaceY + 6}
          fill={WATER}
        />
        <ellipse cx={a.mouthX} cy={a.surfaceY} rx={a.rx} ry={4.4} fill="none" stroke={EDGE} strokeWidth={1.2} />
      </g>

      {/* 洗瓶 + 连续水柱 */}
      <g data-a="bottle">
        <rect x={a.mouthX + 10} y={spoutY - 26} width={18} height={26} rx={6} fill="var(--scene-glass-fill)" stroke={EDGE} strokeWidth={1.4} />
        <path d={`M${a.mouthX + 19} ${spoutY - 26} q0 -8 -8 -8 h-4`} fill="none" stroke={EDGE} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      <rect
        data-a="stream"
        x={a.mouthX - 1.8}
        y={spoutY}
        width={3.6}
        height={a.mouthY - spoutY + 6}
        rx={1.8}
        fill={WATER}
        style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
      />
      {Array.from({ length: 3 }, (_, index) => (
        <circle
          key={`drop-${index}`}
          data-a="drop"
          cx={a.mouthX}
          cy={spoutY + 10}
          r={2.4}
          fill={EDGE}
        />
      ))}

      {/* 毛刷：伸进器皿上下刷 */}
      <g data-a="brush">
        <rect x={a.mouthX - 2} y={a.mouthY - 44} width={4} height={40} rx={2} fill="var(--scene-glass-fill)" stroke={EDGE} strokeWidth={1.4} />
        <path
          d={`M${a.mouthX - 11} ${a.mouthY - 4} h22 l-4 14 h-14 z`}
          fill="rgba(120, 132, 148, .55)"
          stroke={EDGE}
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      </g>

      {/* 倒水：从瓶口斜落的一条水带 */}
      <path
        data-a="dump"
        d={`M${a.mouthX - a.rx * 0.6} ${a.mouthY + 4} Q${a.mouthX - a.rx - 18} ${a.mouthY + 30} ${a.mouthX - a.rx - 26} ${a.mouthY + 74}`}
        fill="none"
        stroke={WATER}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray="120"
        strokeDashoffset="120"
      />

      {/* 沥干：内壁挂的水珠往下滑 */}
      {Array.from({ length: 5 }, (_, index) => (
        <circle
          key={`bead-${index}`}
          data-a="bead"
          cx={a.mouthX - a.rx * 0.72 + index * 4}
          cy={a.surfaceY + 6}
          r={1.9}
          fill={EDGE}
        />
      ))}
    </>
  );

  const beats: Beat[] = [
    // 水柱：从中断处一路长到底，再淡出
    {
      sel: '[data-a="stream"]',
      frames: [
        { transform: "scaleY(0)", opacity: 0 },
        { transform: "scaleY(1)", opacity: 0.95, offset: 0.55 },
        { transform: "scaleY(1)", opacity: 0.95, offset: 0.85 },
        { transform: "scaleY(1)", opacity: 0 },
      ],
      duration: 900,
      delay: 60,
      easing: EASE_IN_OUT,
    },
    {
      sel: '[data-a="bottle"]',
      frames: [
        { transform: "translate(0px, -10px)", opacity: 0 },
        { transform: "translate(0px, 0px)", opacity: 1 },
        { transform: "translate(0px, 0px)", opacity: 1, offset: 0.8 },
        { transform: "translate(0px, -8px)", opacity: 0 },
      ],
      duration: 1000,
      delay: 40,
    },
    // 水落进水里：液面从 0 升到 0.62
    {
      sel: '[data-a="water"]',
      frames: [
        { transform: `translateY(${start}px)` },
        { transform: `translateY(${wet}px)` },
      ],
      duration: 760,
      delay: 420,
    },
    // 水滴跟着水流落
    {
      sel: '[data-a="drop"]',
      frames: [
        { transform: "translate(0px, 0px) scale(.6)", opacity: 0 },
        { transform: `translate(0px, ${a.mouthY - spoutY - 8}px) scale(1)`, opacity: 1, offset: 0.7 },
        { transform: `translate(0px, ${a.mouthY - spoutY}px) scale(.7)`, opacity: 0 },
      ],
      duration: 520,
      delay: 260,
      stagger: 120,
    },
    // 刷洗：伸进去，来回三次，再抽出来
    {
      sel: '[data-a="brush"]',
      frames: [
        { transform: "translate(0px, -34px) rotate(-8deg)", opacity: 0 },
        { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1, offset: 0.12 },
        { transform: "translate(0px, 16px) rotate(6deg)", offset: 0.3 },
        { transform: "translate(0px, -2px) rotate(-6deg)", offset: 0.48 },
        { transform: "translate(0px, 16px) rotate(6deg)", offset: 0.64 },
        { transform: "translate(0px, -2px) rotate(-6deg)", offset: 0.8 },
        { transform: "translate(0px, -34px) rotate(-8deg)", opacity: 0 },
      ],
      duration: 1150,
      delay: 420,
    },
    // 倒水：水带画出 → 液面见底
    {
      sel: '[data-a="dump"]',
      frames: [
        { strokeDashoffset: 120, opacity: 0 },
        { strokeDashoffset: 0, opacity: 1, offset: 0.45 },
        { strokeDashoffset: 0, opacity: 1, offset: 0.8 },
        { strokeDashoffset: 0, opacity: 0 },
      ],
      duration: 620,
      delay: 1420,
      easing: EASE_IN_OUT,
    },
    {
      sel: '[data-a="water"]',
      frames: [{ transform: `translateY(${wet}px)` }, { transform: `translateY(${empty}px)` }],
      duration: 620,
      delay: 1500,
      easing: EASE_IN_OUT,
    },
    // 沥干：水珠沿着内壁往下滑、消失
    {
      sel: '[data-a="bead"]',
      frames: [
        { transform: "translate(0px, 0px)", opacity: 0 },
        { transform: "translate(0px, 6px)", opacity: 0.9, offset: 0.2 },
        { transform: `translate(0px, ${(a.baseY - a.surfaceY) * 0.75}px)`, opacity: 0 },
      ],
      duration: 520,
      delay: 1980,
      stagger: 55,
      easing: EASE_OUT,
    },
  ];

  return { node, beats, ms: 2520 };
}
