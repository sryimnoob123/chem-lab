"use client";

/**
 * 动作：排液（倒掉 / 吸走）—— 用户 2026-10-23 口径：
 * 「倒水之后不能直接消失掉，要有对应过程，要么吸走，要么倒掉。」
 *
 * 为什么单独一条动作：洗涤（rinse）演完时动作层一卸，器皿里的水就会**凭空消失**，
 * 看着不合逻辑。现在 rinse / dilute 结束 → 自动接这条 drain：液面往下降空、
 * 器口流下一股水带、水带断流淡出，排完再把器皿滑回原位。
 *
 * 画法沿用 rinse.tsx 的两条硬规矩（那两条注释里的坑别再踩）：
 *   1. clipPath 挂在**不动的**外层 `<g transform>`，不在子 path 上写 transform；
 *   2. clip-path 不挂在被 translate 的那层上，否则裁剪会跟着液体一起挪。
 */

import { liquidBox } from "../vessels/vessel-geometry";
import { bodyTransform, levelShift, type VesselAnchor } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, type Beat } from "./timeline";
import type { ActionScene } from "./rinse";

const WATER = "var(--scene-water)";
const EDGE = "var(--scene-water-edge)";

/** 器皿条口到空要多久（ms） */
const DRAIN_MS = 780;

export function buildDrain(
  a: VesselAnchor,
  opts: { clipId: string; levelStart?: number },
): ActionScene {
  const box = liquidBox(a.kind);
  const shift = (level: number) => Number((levelShift(a, level) / a.scale).toFixed(2));
  /** 起点 = 洗涤结束时挂在壁上的高度；终点 = 空 */
  const start = shift(opts.levelStart ?? 0.62);
  const end = shift(0);
  /** 器口流下的那股水：从瓶口往左下斜落，和 rinse 的倒水同一个形状 */
  const dumpFromX = a.mouthX - a.rx * 0.6;
  const dumpPath = `M${dumpFromX} ${a.mouthY + 4} Q${a.mouthX - a.rx - 18} ${a.mouthY + 30} ${a.mouthX - a.rx - 26} ${a.mouthY + 74}`;

  const node = (
    <>
      <defs>
        <clipPath id={opts.clipId}>
          <path d={a.bodyD} />
        </clipPath>
      </defs>

      {/* 器内的水：整层往下退到空（液面下降），末帧再淡出，不留残影 */}
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

      {/* 倒出去的那股水：先流出来，再断流 */}
      <path
        data-a="dump"
        d={dumpPath}
        fill="none"
        stroke={WATER}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray="120"
        strokeDashoffset="120"
      />
      {/* 落点溅起的水花（器皿外侧下方，表示水真的流走了） */}
      {[0, 1, 2].map((index) => (
        <circle key={`splash-${index}`} data-a="splash" cx={a.mouthX - a.rx - 26 + index * 5} cy={a.mouthY + 78} r={1.8} fill={EDGE} />
      ))}
    </>
  );

  const beats: Beat[] = [
    // 水带：从器口长出来
    {
      sel: '[data-a="dump"]',
      frames: [
        { strokeDashoffset: 120, opacity: 0 },
        { strokeDashoffset: 24, opacity: 0.95, offset: 0.45 },
        { strokeDashoffset: 0, opacity: 0.95, offset: 0.8 },
        { strokeDashoffset: 0, opacity: 0, offset: 1 },
      ],
      duration: 620,
      easing: EASE_IN_OUT,
    },
    // 液面退空：先慢后快，排到空再淡出
    {
      sel: '[data-a="water"]',
      frames: [
        { transform: `translateY(${start}px)`, opacity: 1 },
        { transform: `translateY(${(start + (end - start) * 0.62).toFixed(2)}px)`, opacity: 1, offset: 0.62 },
        { transform: `translateY(${end}px)`, opacity: 1, offset: 0.88 },
        { transform: `translateY(${end}px)`, opacity: 0 },
      ],
      duration: DRAIN_MS - 60,
      delay: 60,
      easing: EASE_OUT,
    },
    // 水花：落到地上就消失
    {
      sel: '[data-a="splash"]',
      frames: [
        { transform: "scale(0.6)", opacity: 0 },
        { transform: "scale(1)", opacity: 0.8, offset: 0.5 },
        { transform: "scale(1.5) translateY(6px)", opacity: 0 },
      ],
      duration: 520,
      delay: 180,
      stagger: 70,
      easing: EASE_OUT,
    },
  ];

  return { node, beats, ms: DRAIN_MS };
}
