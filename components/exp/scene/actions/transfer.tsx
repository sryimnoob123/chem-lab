"use client";

/**
 * 动作：转移液体（源液面下降 → 提起挂一滴 → 移到目标 → 放液、目标液面上升）
 *
 * 用户口径（2026-10-22 第 4 条）：「移液管吸液（源液面下降）→ 提起（管尖挂一滴）→
 * 移到目标 → 放液（目标液面上升）」。这里用一根玻璃棒/移液管 + 两段液面变化表达，
 * 中间一条沿管身落下的液柱，避免"液体凭空出现"。
 */

import { bodyTransform, levelShift, type VesselAnchor } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, type Beat } from "./timeline";
import type { ActionScene } from "./rinse";

const WATER = "var(--scene-water)";
const EDGE = "var(--scene-water-edge)";

export function buildTransfer(
  from: VesselAnchor,
  to: VesselAnchor,
  opts: { clipFrom: string; clipTo: string },
): ActionScene {
  const fromFull = levelShift(from, 0.72);
  const fromLow = levelShift(from, 0.28);
  const toLow = levelShift(to, 0.1);
  const toHigh = levelShift(to, 0.66);

  /** 管身：源瓶口 → 目标瓶口，中途提起 */
  const startX = from.mouthX;
  const startY = from.mouthY - 26;
  const endX = to.mouthX;
  const endY = to.mouthY - 26;

  const node = (
    <>
      <defs>
        <clipPath id={opts.clipFrom}>
          <path d={from.bodyD} transform={bodyTransform(from)} />
        </clipPath>
        <clipPath id={opts.clipTo}>
          <path d={to.bodyD} transform={bodyTransform(to)} />
        </clipPath>
      </defs>

      {/* 源器皿：液面先降 */}
      <g data-a="from" clipPath={`url(#${opts.clipFrom})`} style={{ transform: `translateY(${fromFull}px)` }}>
        <rect x={from.x - 4} y={from.surfaceY} width={from.w + 8} height={from.baseY - from.surfaceY + 6} fill={WATER} />
      </g>
      {/* 目标器皿：液面后升 */}
      <g data-a="to" clipPath={`url(#${opts.clipTo})`} style={{ transform: `translateY(${toLow}px)` }}>
        <rect x={to.x - 4} y={to.surfaceY} width={to.w + 8} height={to.baseY - to.surfaceY + 6} fill={WATER} />
        <ellipse cx={to.mouthX} cy={to.surfaceY} rx={to.rx} ry={4.4} fill="none" stroke={EDGE} strokeWidth={1.2} />
      </g>

      {/* 移液管：一根细管 + 中部球 */}
      <g data-a="pipe" style={{ transform: `translate(${startX}px, ${startY}px)` }}>
        <rect x={-1.6} y={-40} width={3.2} height={64} fill="var(--scene-glass-fill)" stroke={EDGE} strokeWidth={1.1} />
        <ellipse cx={0} cy={-14} rx={6} ry={8} fill="rgba(226, 236, 244, .95)" stroke={EDGE} strokeWidth={1.2} />
        <rect x={-1.6} y={24} width={3.2} height={22} fill="var(--scene-glass-fill)" stroke={EDGE} strokeWidth={1.1} />
      </g>
      {/* 管尖挂着的那一滴 */}
      <circle data-a="hanging" cx={startX} cy={startY + 30} r={2.6} fill={EDGE} opacity={0} />

      {/* 放液：从目标瓶口落下的液柱 */}
      <rect
        data-a="stream"
        x={endX - 1.6}
        y={endY + 10}
        width={3.2}
        height={to.mouthY - endY + 8}
        rx={1.6}
        fill={WATER}
        style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
      />
    </>
  );

  const beats: Beat[] = [
    // 管尖插进源液、液面下降
    {
      sel: '[data-a="pipe"]',
      frames: [
        { transform: `translate(${startX}px, ${startY - 30}px)`, opacity: 0 },
        { transform: `translate(${startX}px, ${startY}px)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${startX}px, ${startY}px)`, opacity: 1, offset: 0.42 },
        { transform: `translate(${endX}px, ${endY}px)`, opacity: 1, offset: 0.74 },
        { transform: `translate(${endX}px, ${endY}px)`, opacity: 1, offset: 0.9 },
        { transform: `translate(${endX}px, ${endY - 20}px)`, opacity: 0 },
      ],
      duration: 1500,
      delay: 40,
      easing: EASE_IN_OUT,
    },
    {
      sel: '[data-a="from"]',
      frames: [{ transform: `translateY(${fromFull}px)` }, { transform: `translateY(${fromLow}px)` }],
      duration: 700,
      delay: 260,
      easing: EASE_IN_OUT,
    },
    // 提起时挂一滴
    {
      sel: '[data-a="hanging"]',
      frames: [
        { transform: "translate(0px, 0px) scale(.4)", opacity: 0 },
        { transform: "translate(0px, 0px) scale(1)", opacity: 1, offset: 0.3 },
        { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(1)`, opacity: 1, offset: 0.72 },
        { transform: `translate(${endX - startX}px, ${endY - startY + 14}px) scale(.5)`, opacity: 0 },
      ],
      duration: 1300,
      delay: 300,
      easing: EASE_IN_OUT,
    },
    // 放液：液柱落下 + 目标液面上升
    {
      sel: '[data-a="stream"]',
      frames: [
        { transform: "scaleY(0)", opacity: 0 },
        { transform: "scaleY(1)", opacity: 0.95, offset: 0.35 },
        { transform: "scaleY(1)", opacity: 0.95, offset: 0.8 },
        { transform: "scaleY(1)", opacity: 0 },
      ],
      duration: 620,
      delay: 1080,
      easing: EASE_OUT,
    },
    {
      sel: '[data-a="to"]',
      frames: [{ transform: `translateY(${toLow}px)` }, { transform: `translateY(${toHigh}px)` }],
      duration: 760,
      delay: 1140,
      easing: EASE_IN_OUT,
    },
  ];

  return { node, beats, ms: 1980 };
}
