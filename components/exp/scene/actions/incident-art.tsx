"use client";

/**
 * 事故的「炸开」那一段（事故时间线的后半段）
 *
 * 事故分两段：起手错操作（incident.ts）+ 出事（本文件）。
 * 出事这一段按 6 个能在器皿上演的视觉键各画一套，但**全部画在实验台同一个 SVG、
 * 同一套器皿几何里**：裂纹从器身长出来、碎玻璃从撞击点飞出去、液体在同一层
 * clipPath 里翻上来。没有第二套素材、没有独立小场景、不用白色高光（AGENTS §9.1）。
 *
 * 只动 transform / opacity（AGENTS §3.1）：不逐帧改 r / cx / stroke-dashoffset。
 * 碎片与液滴逐个飞（各一条 beat，方向来自常量表），所以看起来是「炸开」，
 * 不是「一坨东西整体平移」。
 */

import type { ReactNode } from "react";
import type { Beat } from "./timeline";
import { EASE_BACK, EASE_IN_OUT, EASE_OUT } from "./timeline";
import type { VesselAnchor } from "./geometry";

export type IncidentFx = "glassBreak" | "explosion" | "boilOver" | "fire" | "burn" | "toxicGas";

export type HazardArgs = {
  a: VesselAnchor;
  /** 撞击点（viewBox 绝对坐标）：裂纹、碎片、飞溅都从这一点发散 */
  ix: number;
  iy: number;
};

/** 碎玻璃：每条一个方向 / 旋转（确定性常量，每次播放一致，截图可复现） */
const SHARDS = [
  { dx: -44, dy: -30, rot: -150, d: 10 },
  { dx: 40, dy: -40, rot: 128, d: 12 },
  { dx: 56, dy: 6, rot: 84, d: 9 },
  { dx: -54, dy: 14, rot: -92, d: 11 },
  { dx: 28, dy: 46, rot: 56, d: 10 },
  { dx: -32, dy: 44, rot: -64, d: 9 },
  { dx: 10, dy: -52, rot: 22, d: 8 },
] as const;

/** 飞溅液滴：7 个方向 */
const DROPS = [
  { dx: -64, dy: -56, r: 2.8 },
  { dx: -34, dy: -80, r: 2.1 },
  { dx: 6, dy: -88, r: 3.2 },
  { dx: 50, dy: -66, r: 2.3 },
  { dx: 76, dy: -20, r: 2.8 },
  { dx: 60, dy: 30, r: 1.9 },
  { dx: -76, dy: -14, r: 1.9 },
] as const;

/** 撞击闪光（只在器身上闪一下，不铺满屏幕） */
function Flash({ a, ix, iy, big = false }: HazardArgs & { big?: boolean }) {
  return (
    <circle
      data-i="flash"
      cx={ix}
      cy={iy}
      r={Math.max(a.w, a.h) * (big ? 0.6 : 0.36)}
      fill="var(--scene-blast-core)"
      opacity={0}
      style={{ transformBox: "view-box", transformOrigin: `${ix}px ${iy}px` }}
      aria-hidden="true"
    />
  );
}

/** 裂纹：三条从撞击点放射的折线（从撞击点「长」出来） */
function Cracks({ a, ix, iy }: HazardArgs) {
  const paths = [
    `M${ix} ${iy} l${-a.rx * 0.34} -${a.rx * 0.3} l-${a.rx * 0.22} ${a.rx * 0.17} l-${a.rx * 0.34} -${a.rx * 0.1}`,
    `M${ix} ${iy} l${a.rx * 0.36} -${a.rx * 0.16} l${a.rx * 0.24} ${a.rx * 0.21} l${a.rx * 0.3} -${a.rx * 0.06}`,
    `M${ix} ${iy} l-${a.rx * 0.1} ${a.rx * 0.4} l${a.rx * 0.16} ${a.rx * 0.26} l-${a.rx * 0.2} ${a.rx * 0.3}`,
  ];
  return (
    <>
      {paths.map((path, index) => (
        <path
          key={`crack-${index}`}
          data-i="crack"
          d={path}
          fill="none"
          stroke="var(--scene-crack)"
          strokeWidth={3.2}
          strokeLinecap="round"
          opacity={0}
          style={{ transformBox: "view-box", transformOrigin: `${ix}px ${iy}px` }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/** 冲击环：以撞击点为心向外扩，两圈错开 */
function Rings({ ix, iy }: HazardArgs) {
  const ring = (id: string, width: number) => (
    <circle
      data-i={id}
      cx={ix}
      cy={iy}
      r={12}
      fill="none"
      stroke="var(--scene-blast)"
      strokeWidth={width}
      opacity={0}
      style={{ transformBox: "view-box", transformOrigin: `${ix}px ${iy}px` }}
      aria-hidden="true"
    />
  );
  return (
    <>
      {ring("ring", 2.4)}
      {ring("ring2", 1.2)}
    </>
  );
}

/** 碎玻璃 + 飞溅液滴：从撞击点 / 器口各自朝自己的方向飞 */
function Particles({ a, ix, iy }: HazardArgs) {
  return (
    <>
      {SHARDS.map((shard, index) => (
        <path
          key={`shard-${index}`}
          data-i={`shard-${index}`}
          d={`M${ix} ${iy} l${shard.d * 1.45} -${shard.d * 0.6} l${shard.d * 0.62} ${shard.d * 1.15} z`}
          fill="var(--scene-shard)"
          stroke="var(--scene-crack)"
          strokeWidth={0.9}
          opacity={0}
          style={{ transformBox: "view-box", transformOrigin: `${ix}px ${iy}px` }}
          aria-hidden="true"
        />
      ))}
      {DROPS.map((drop, index) => (
        <circle
          key={`drop-${index}`}
          data-i={`drop-${index}`}
          cx={a.mouthX}
          cy={a.mouthY + 6}
          r={drop.r}
          fill={index % 3 === 0 ? "var(--scene-blast)" : "var(--scene-water)"}
          opacity={0}
          style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.mouthY + 6}px` }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

function shardBeats(delay: number): Beat[] {
  return SHARDS.map((shard, index) => ({
    sel: `[data-i="shard-${index}"]`,
    frames: [
      { opacity: 0, transform: "translate(0px, 0px) rotate(0deg) scale(.4)" },
      { opacity: 1, offset: 0.14 },
      {
        opacity: 1,
        transform: `translate(${shard.dx * 1.5}px, ${shard.dy * 1.5}px) rotate(${shard.rot}deg) scale(1)`,
        offset: 0.6,
      },
      {
        opacity: 0,
        transform: `translate(${shard.dx * 1.9}px, ${shard.dy * 1.9 + 28}px) rotate(${shard.rot * 1.5}deg) scale(.85)`,
      },
    ],
    duration: 960,
    delay: delay + index * 18,
    easing: EASE_OUT,
  }));
}

function dropBeats(delay: number, duration = 700): Beat[] {
  return DROPS.map((drop, index) => ({
    sel: `[data-i="drop-${index}"]`,
    frames: [
      { opacity: 0, transform: "translate(0px, 0px) scale(.5)" },
      { opacity: 1, transform: `translate(${drop.dx * 0.5}px, ${drop.dy * 0.9}px) scale(1.1)`, offset: 0.35 },
      { opacity: 0, transform: `translate(${drop.dx * 1.2}px, ${drop.dy * 1.4 + 30}px) scale(.7)` },
    ],
    duration,
    delay: delay + index * 20,
    easing: EASE_OUT,
  }));
}

/** 蒸汽 / 烟雾：从器口升起的两股 */
function Steam({ a }: HazardArgs) {
  return (
    <>
      {[0, 1].map((index) => (
        <path
          key={`steam-${index}`}
          data-i="steam"
          d={`M${a.mouthX - 7 + index * 14} ${a.mouthY - 4} q7 -13 0 -25 q-7 -13 0 -26`}
          fill="none"
          stroke="var(--scene-steam)"
          strokeWidth={2.6}
          strokeLinecap="round"
          opacity={0}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/** 暴沸：泡沫涨过瓶口 + 沿外壁流下 */
function Foam({ a }: HazardArgs) {
  return (
    <>
      <ellipse
        data-i="foam"
        cx={a.mouthX}
        cy={a.mouthY - 3}
        rx={a.rx}
        ry={5}
        fill="var(--scene-water)"
        stroke="var(--scene-water-edge)"
        strokeWidth={1}
        opacity={0}
        style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.mouthY}px` }}
        aria-hidden="true"
      />
      {[0, 1].map((index) => (
        <rect
          key={`overflow-${index}`}
          data-i="overflow"
          x={index === 0 ? a.x + 5 : a.x + a.w - 11}
          y={a.mouthY}
          width={5}
          height={Math.max(20, (a.baseY - a.mouthY) * 0.42)}
          rx={2.5}
          fill="var(--scene-water)"
          opacity={0}
          style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/** 泡沫 / 溢出的公共节拍（暴沸与爆炸共用） */
function foamBeats(): Beat[] {
  return [
    {
      sel: '[data-i="foam"]',
      frames: [
        { opacity: 0, transform: "scale(.5)" },
        { opacity: 0.95, transform: "scale(1.45) translateY(-6px)", offset: 0.32 },
        { opacity: 0, transform: "scale(1.85) translateY(-16px)" },
      ],
      duration: 820,
      easing: EASE_OUT,
    },
    {
      sel: '[data-i="overflow"]',
      frames: [
        { opacity: 0, transform: "scaleY(0)" },
        { opacity: 0.85, transform: "scaleY(1)", offset: 0.35 },
        { opacity: 0, transform: "scaleY(1.1)" },
      ],
      duration: 880,
      delay: 60,
      stagger: 90,
      easing: EASE_OUT,
    },
  ];
}

function steamBeats(delay: number): Beat {
  return {
    sel: '[data-i="steam"]',
    frames: [
      { opacity: 0, transform: "translateY(8px) scale(.92)" },
      { opacity: 0.5, transform: "translateY(-18px) scale(1.05)", offset: 0.5 },
      { opacity: 0, transform: "translateY(-42px) scale(1.15)" },
    ],
    duration: 940,
    delay,
    stagger: 90,
    easing: EASE_OUT,
  };
}

/**
 * 按事故类型给出「炸开」那段的画面 + 节拍。
 * 节拍里的 delay 一律相对事故开始（incident.ts 负责整体平移到 lead 之后）。
 */
export function hazardArt(fx: IncidentFx, args: HazardArgs): { node: ReactNode; beats: Beat[] } {
  const { a } = args;

  if (fx === "glassBreak") {
    return {
      node: (
        <>
          <Flash {...args} />
          <Cracks {...args} />
          <Rings {...args} />
          <Particles {...args} />
          <Steam {...args} />
        </>
      ),
      beats: [
        {
          sel: '[data-i="flash"]',
          frames: [
            { opacity: 0, transform: "scale(.5)" },
            { opacity: 0.34, transform: "scale(1)", offset: 0.25 },
            { opacity: 0, transform: "scale(1.1)" },
          ],
          duration: 240,
          easing: EASE_OUT,
        },
        {
          sel: '[data-i="crack"]',
          frames: [
            { opacity: 0, transform: "scale(.35)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          duration: 170,
          delay: 10,
          stagger: 42,
          easing: EASE_BACK,
        },
        {
          sel: '[data-i="ring"]',
          frames: [
            { opacity: 0, transform: "scale(.4)" },
            { opacity: 0.95, transform: "scale(1.9)", offset: 0.3 },
            { opacity: 0, transform: "scale(3.4)" },
          ],
          duration: 520,
          easing: EASE_OUT,
        },
        {
          sel: '[data-i="ring2"]',
          frames: [
            { opacity: 0, transform: "scale(.3)" },
            { opacity: 0.5, transform: "scale(1.2)", offset: 0.4 },
            { opacity: 0, transform: "scale(2.6)" },
          ],
          duration: 640,
          delay: 80,
          easing: EASE_OUT,
        },
        ...shardBeats(40),
        ...dropBeats(50, 620),
        steamBeats(180),
      ],
    };
  }

  if (fx === "explosion") {
    return {
      node: (
        <>
          <Flash {...args} big />
          <Rings {...args} />
          <ellipse
            data-i="blast"
            cx={a.mouthX}
            cy={a.mouthY}
            rx={a.rx * 1.1}
            ry={a.rx * 0.9}
            fill="var(--scene-blast)"
            opacity={0}
            style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.mouthY}px` }}
            aria-hidden="true"
          />
          <Foam {...args} />
          <Particles {...args} />
          <Steam {...args} />
        </>
      ),
      beats: [
        {
          sel: '[data-i="flash"]',
          frames: [
            { opacity: 0, transform: "scale(.35)" },
            { opacity: 0.55, transform: "scale(1)", offset: 0.2 },
            { opacity: 0, transform: "scale(1.7)" },
          ],
          duration: 420,
          easing: EASE_OUT,
        },
        {
          sel: '[data-i="blast"]',
          frames: [
            { opacity: 0, transform: "scale(.3)" },
            { opacity: 0.9, transform: "scale(1)", offset: 0.22 },
            { opacity: 0, transform: "scale(1.8)" },
          ],
          duration: 560,
          easing: EASE_OUT,
        },
        { ...foamBeats()[0], delay: 0 },
        { ...foamBeats()[1], delay: 40 },
        {
          sel: '[data-i="ring"]',
          frames: [
            { opacity: 0, transform: "scale(.3)" },
            { opacity: 0.9, transform: "scale(1.6)", offset: 0.3 },
            { opacity: 0, transform: "scale(4.2)" },
          ],
          duration: 680,
          easing: EASE_OUT,
        },
        {
          sel: '[data-i="ring2"]',
          frames: [
            { opacity: 0, transform: "scale(.2)" },
            { opacity: 0.55, transform: "scale(1.1)", offset: 0.35 },
            { opacity: 0, transform: "scale(3.2)" },
          ],
          duration: 780,
          delay: 100,
          easing: EASE_OUT,
        },
        ...shardBeats(40),
        ...dropBeats(30, 720),
        steamBeats(120),
      ],
    };
  }

  if (fx === "boilOver") {
    return {
      node: (
        <>
          <Rings {...args} />
          <Foam {...args} />
          <Particles {...args} />
          <Steam {...args} />
        </>
      ),
      beats: [{ ...foamBeats()[0], duration: 900 }, { ...foamBeats()[1], delay: 60 }, ...dropBeats(40, 780), steamBeats(140)],
    };
  }

  if (fx === "fire") {
    return {
      node: (
        <>
          <g data-i="flame" style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.mouthY}px` }}>
            <path
              d={`M${a.mouthX} ${a.mouthY} q-16 -12 -10 -34 q8 12 10 12 q4 0 12 -12 q5 22 -12 34 z`}
              fill="var(--scene-flame)"
              opacity={0.85}
            />
            <path
              d={`M${a.mouthX} ${a.mouthY - 4} q-8 -8 -5 -20 q5 8 5 8 q1 0 6 -8 q3 12 -6 20 z`}
              fill="var(--scene-flame-core)"
            />
          </g>
          <Steam {...args} />
        </>
      ),
      beats: [
        {
          sel: '[data-i="flame"]',
          frames: [
            { opacity: 0, transform: "scale(.5) scaleY(.4)" },
            { opacity: 1, transform: "scale(1) scaleY(1)", offset: 0.25 },
            { opacity: 1, transform: "scale(.94) scaleY(1.12)", offset: 0.55 },
            { opacity: 0.9, transform: "scale(1.04) scaleY(1)", offset: 0.8 },
            { opacity: 0, transform: "scale(1) scaleY(1.1)" },
          ],
          duration: 1300,
          easing: EASE_IN_OUT,
        },
        steamBeats(260),
      ],
    };
  }

  if (fx === "burn") {
    return {
      node: (
        <>
          <g data-i="scald" style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.surfaceY}px` }}>
            <ellipse cx={a.mouthX} cy={a.surfaceY} rx={a.rx * 1.1} ry={a.rx * 0.7} fill="var(--danger)" opacity={0.35} />
          </g>
          <Particles {...args} />
          <Steam {...args} />
        </>
      ),
      beats: [
        {
          sel: '[data-i="scald"]',
          frames: [
            { opacity: 0, transform: "scale(.4)" },
            { opacity: 1, transform: "scale(1.05)", offset: 0.3 },
            { opacity: 0.55, transform: "scale(1.15)", offset: 0.7 },
            { opacity: 0, transform: "scale(1.2)" },
          ],
          duration: 1200,
          easing: EASE_OUT,
        },
        ...dropBeats(40, 700),
        steamBeats(100),
      ],
    };
  }

  // toxicGas：黄绿色雾团从器口涌出（不用 filter，纯椭圆 + 透明度）
  return {
    node: (
      <>
        {[0, 1, 2, 3].map((index) => (
          <ellipse
            key={`gas-${index}`}
            data-i="gas"
            cx={a.mouthX - 10 + index * 7}
            cy={a.mouthY - 6}
            rx={a.rx * 0.8}
            ry={a.rx * 0.55}
            fill="var(--scene-toxic)"
            opacity={0}
            style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.mouthY}px` }}
            aria-hidden="true"
          />
        ))}
      </>
    ),
    beats: [
      {
        sel: '[data-i="gas"]',
        frames: [
          { opacity: 0, transform: "translateY(6px) scale(.5)" },
          { opacity: 0.6, transform: "translateY(-14px) scale(1.1)", offset: 0.4 },
          { opacity: 0, transform: "translateY(-46px) scale(1.9)" },
        ],
        duration: 1200,
        stagger: 90,
        easing: EASE_OUT,
      },
    ],
  };
}
