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
import { liquidBox } from "../vessels/vessel-geometry";
import { bodyTransform, levelShift, type VesselAnchor } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, type Beat } from "./timeline";

export type RinseVariant = "wash" | "dilute";

/** 时间线回调：事故演出在 at 毫秒处「炸」（唯一入口用它出声 / 定格） */
export type SceneCue = { at: number; kind: "impact" | "settle" };

export type ActionScene = {
  node: ReactNode;
  beats: Beat[];
  ms: number;
  /** 天平/仪器读数：动作期间数字从 0 滚到 to（小数位 decimals）。 */
  readout?: { to: number; decimals: number };
  /** 时间线中途的回调点（事故段用：正常路径在中间某帧切进事故分支） */
  cues?: readonly SceneCue[];
};

const WATER = "var(--scene-water)";
const EDGE = "var(--scene-water-edge)";

export function buildRinse(
  a: VesselAnchor,
  opts: { variant: RinseVariant; clipId: string; levelStart?: number },
): ActionScene {
  const isDilute = opts.variant === "dilute";
  /** 器皿自己的液面几何（局部坐标）：液体矩形左右各出壁 6 单位，多出来的被器身裁掉 */
  const box = liquidBox(a.kind);
  /** 液位位移一律换算成**器皿局部坐标**（液体层在外层 `scale()` 里，见 node） */
  const shift = (level: number) => Number((levelShift(a, level) / a.scale).toFixed(2));
  const empty = shift(0);
  /** 第 4 轮修：稀释从真实液位起画、涨一格；洗涤仍是冲满一器 */
  const wet = shift(isDilute ? Math.min(0.9, (opts.levelStart ?? 0) + 0.22) : 0.62);
  const start = shift(opts.levelStart ?? 0);
  /** 水柱起点：洗瓶嘴在瓶口上方 58 单位处 */
  const spoutY = a.mouthY - 58;

  const node = (
    <>
      <defs>
        <clipPath id={opts.clipId}>
          <path d={a.bodyD} />
        </clipPath>
      </defs>

      {/*
        器皿里的水（被玻璃剪影裁住）：clipPath 用**器皿局部坐标**；裁剪挂在**不动的**外层
        `<g transform>` 上，动的只有里面那层 translateY。
        两个坑都在这里（2026-10-23 实测）：
          1. 不能把 transform 写在 clipPath 的子 path 上 —— Chrome 会忽略这份裁剪，液体溢出瓶外；
          2. 不能把 clip-path 挂到**被 translate 的那层**上 —— 裁剪会跟着液体一起挪，
             液面一升，瓶身轮廓就跟着下移，液体在底部/两侧露出瓶外（命中测试实测 456 个点）。
      */}
      <g transform={bodyTransform(a)} clipPath={`url(#${opts.clipId})`}>
        <g data-a="water" style={{ transform: `translateY(${start}px)` }}>
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
      duration: 700,
      delay: 40,
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
      duration: 760,
      delay: 30,
    },
    // 水落进水里：液面从 0 升到 0.62
    {
      sel: '[data-a="water"]',
      frames: [
        { transform: `translateY(${start}px)` },
        { transform: `translateY(${wet}px)` },
      ],
      duration: 560,
      delay: 320,
    },
    // 水滴跟着水流落
    {
      sel: '[data-a="drop"]',
      frames: [
        { transform: "translate(0px, 0px) scale(.6)", opacity: 0 },
        { transform: `translate(0px, ${a.mouthY - spoutY - 8}px) scale(1)`, opacity: 1, offset: 0.7 },
        { transform: `translate(0px, ${a.mouthY - spoutY}px) scale(.7)`, opacity: 0 },
      ],
      duration: 400,
      delay: 180,
      stagger: 90,
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
      duration: 860,
      delay: 320,
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
      duration: 460,
      delay: 1060,
      easing: EASE_IN_OUT,
    },
    {
      sel: '[data-a="water"]',
      frames: [{ transform: `translateY(${wet}px)` }, { transform: `translateY(${empty}px)` }],
      duration: 440,
      delay: 1100,
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
      duration: 300,
      delay: 1480,
      stagger: 30,
      easing: EASE_OUT,
    },
  ];

  return { node, beats, ms: 1900 };
}
