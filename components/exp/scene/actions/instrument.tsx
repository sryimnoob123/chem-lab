"use client";

/**
 * 动作：仪器类 —— 称量 / 读数 / 观察 / 加热
 *
 * 用户口径（2026-10-22 第 5 条）：「天平托盘下沉再回弹 + 数字滚动；加热有气泡/蒸汽」。
 * 这些动作作用在仪器上（天平在 bench-scene 里是固定陈设），所以 beat 的选择器
 * 打在整个实验台 SVG 上（`[data-balance-pan]` / `[data-balance-readout]`），
 * 而不是只看动作层自己。
 */

import { bodyTransform, type VesselAnchor } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, type Beat } from "./timeline";
import type { ActionScene } from "./rinse";

const EDGE = "var(--scene-water-edge)";

/** 称量：托盘下沉再回弹，读数从 0 滚到 target。 */
export function buildWeigh(target: number): ActionScene {
  const beats: Beat[] = [
    {
      sel: '[data-balance-pan]',
      frames: [
        { transform: "translateY(0px)" },
        { transform: "translateY(4.5px)", offset: 0.35 },
        { transform: "translateY(0px)", offset: 0.7 },
        { transform: "translateY(2px)", offset: 0.85 },
        { transform: "translateY(0px)" },
      ],
      duration: 760,
      delay: 60,
      easing: EASE_IN_OUT,
    },
    {
      sel: '[data-balance-beam]',
      frames: [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-1.6deg)", offset: 0.35 },
        { transform: "rotate(0.6deg)", offset: 0.7 },
        { transform: "rotate(0deg)" },
      ],
      duration: 760,
      delay: 60,
      easing: EASE_IN_OUT,
    },
  ];
  return {
    node: null,
    beats,
    ms: 900,
    readout: { to: target, decimals: 4 },
  };
}

/** 读数：示数稳住 + 屏幕闪一下高光。 */
export function buildRead(target: number): ActionScene {
  const node = (
    <rect
      data-a="screen"
      x={812}
      y={264}
      width={92}
      height={28}
      rx={3}
      fill="none"
      stroke="var(--scene-accent)"
      strokeWidth={1.6}
    />
  );
  return {
    node,
    beats: [
      {
        sel: '[data-a="screen"]',
        frames: [
          { opacity: 0, transform: "scaleX(.94)" },
          { opacity: 1, transform: "scaleX(1)", offset: 0.3 },
          { opacity: 0, transform: "scaleX(1.02)" },
        ],
        duration: 620,
        delay: 60,
      },
    ],
    ms: 800,
    readout: { to: target, decimals: 2 },
  };
}

/** 观察：一圈放大镜/焦点环扫过器皿。 */
export function buildObserve(a: VesselAnchor): ActionScene {
  const cy = (a.surfaceY + a.baseY) / 2;
  const r = Math.max(a.w, a.h) * 0.42;
  const node = (
    <>
      <circle
        data-a="lens"
        cx={a.mouthX}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--scene-accent)"
        strokeWidth={1.8}
        strokeDasharray="6 5"
        style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${cy}px` }}
      />
      <circle data-a="lens2" cx={a.mouthX} cy={cy} r={r * 0.55} fill="none" stroke="var(--scene-accent)" strokeWidth={1} />
    </>
  );
  return {
    node,
    beats: [
      {
        sel: '[data-a="lens"]',
        frames: [
          { transform: "scale(.72)", opacity: 0 },
          { transform: "scale(1)", opacity: 0.95, offset: 0.28 },
          { transform: "scale(1.04)", opacity: 0.95, offset: 0.75 },
          { transform: "scale(1.08)", opacity: 0 },
        ],
        duration: 900,
        delay: 40,
        easing: EASE_OUT,
      },
      {
        sel: '[data-a="lens2"]',
        frames: [
          { transform: "scale(.6)", opacity: 0 },
          { transform: "scale(1)", opacity: 0.5, offset: 0.4 },
          { transform: "scale(1.1)", opacity: 0 },
        ],
        duration: 760,
        delay: 160,
        easing: EASE_OUT,
      },
    ],
    ms: 1000,
  };
}

/** 加热：火焰 + 气泡 + 蒸汽。 */
export function buildHeat(a: VesselAnchor, opts: { clipId: string }): ActionScene {
  const flameY = a.baseY + 2;
  const node = (
    <>
      <defs>
        <clipPath id={opts.clipId}>
          <path d={a.bodyD} transform={bodyTransform(a)} />
        </clipPath>
      </defs>
      {/* 火焰 */}
      <g data-a="flame" style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${flameY}px` }}>
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
      {/* 器皿里的气泡 */}
      {Array.from({ length: 5 }, (_, index) => (
        <circle
          key={`hb-${index}`}
          data-a="hbub"
          cx={a.mouthX - a.rx * 0.5 + index * (a.rx * 0.25)}
          cy={a.baseY - 12}
          r={2.2}
          fill={EDGE}
        />
      ))}
      {/* 蒸汽 */}
      {Array.from({ length: 2 }, (_, index) => (
        <path
          key={`st-${index}`}
          data-a="steam"
          d={`M${a.mouthX - 6 + index * 12} ${a.mouthY - 4} q8 -12 0 -24 q-8 -12 0 -24`}
          fill="none"
          stroke="var(--scene-steam)"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}
    </>
  );

  return {
    node,
    beats: [
      {
        sel: '[data-a="flame"]',
        frames: [
          { transform: "scaleY(.2) scaleX(.7)", opacity: 0 },
          { transform: "scaleY(1) scaleX(1)", opacity: 1, offset: 0.3 },
          { transform: "scaleY(1.12) scaleX(.94)", opacity: 1, offset: 0.55 },
          { transform: "scaleY(.96) scaleX(1.04)", opacity: 1, offset: 0.8 },
          { transform: "scaleY(1) scaleX(1)", opacity: 0 },
        ],
        duration: 1500,
        delay: 40,
        easing: EASE_IN_OUT,
      },
      {
        sel: '[data-a="hbub"]',
        frames: [
          { transform: "translate(0px, 0px) scale(.5)", opacity: 0 },
          { transform: `translate(0px, ${-(a.baseY - a.mouthY) * 0.5}px) scale(1)`, opacity: 0.75, offset: 0.7 },
          { transform: `translate(0px, ${-(a.baseY - a.mouthY) * 0.72}px) scale(.8)`, opacity: 0 },
        ],
        duration: 1000,
        delay: 260,
        stagger: 120,
      },
      {
        sel: '[data-a="steam"]',
        frames: [
          { transform: "translateY(6px)", opacity: 0 },
          { transform: "translateY(-10px)", opacity: 0.55, offset: 0.45 },
          { transform: "translateY(-26px)", opacity: 0 },
        ],
        duration: 1100,
        delay: 520,
        stagger: 180,
        easing: EASE_OUT,
      },
    ],
    ms: 1700,
  };
}
