"use client";

/**
 * 动作：搅拌 / 溶解 + 滴加
 *
 * 用户口径：「玻璃棒伸进液体里画圈（棒体倾斜、绕圈），液体跟着旋转，固体颗粒逐渐变小消失」。
 * 搅拌用三件事同时表达：棒绕圈、液面打旋（一条旋转弧线）、颗粒缩小消失。
 *
 * 滴加（滴管/滴定）：管尖悬在液面上方，液滴一颗颗落下，落点出涟漪、液面微升。
 */

import { liquidBox } from "../vessels/vessel-geometry";
import { bodyTransform, levelShift, type VesselAnchor } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, type Beat } from "./timeline";
import type { ActionScene } from "./rinse";

const WATER = "var(--scene-water)";
const EDGE = "var(--scene-water-edge)";

export function buildStir(a: VesselAnchor, opts: { clipId: string; levelStart?: number }): ActionScene {
  /** 器皿自己的液面几何（局部坐标）：液体矩形左右各出壁 6 单位，多出来的被器身裁掉 */
  const box = liquidBox(a.kind);
  /** 液位位移一律换算成器皿局部坐标（液体层在外层 `scale()` 里） */
  const shift = (level: number) => Number((levelShift(a, level) / a.scale).toFixed(2));
  const start = Math.max(0, Math.min(0.9, opts.levelStart ?? 0.5));
  const level = shift(start);
  const rodTop = a.mouthY - 46;
  const rodBottom = a.mouthY + (a.baseY - a.mouthY) * 0.52;
  const swirlY = a.surfaceY + 10;

  const node = (
    <>
      <defs>
        <clipPath id={opts.clipId}>
          <path d={a.bodyD} />
        </clipPath>
      </defs>

      {/* 液体层：clipPath 用器皿局部坐标，裁剪挂在不动的外层（见 rinse.tsx 的两条注释） */}
      <g transform={bodyTransform(a)} clipPath={`url(#${opts.clipId})`}>
        <g data-a="water" style={{ transform: `translateY(${level}px)` }}>
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

      {/* 旋转的液面弧线：液面在跟着棒转 */}
      <path
        data-a="swirl"
        d={`M${a.mouthX - a.rx} ${swirlY} a${a.rx} 6 0 1 0 ${a.rx * 2} 0`}
        fill="none"
        stroke={EDGE}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray={`${a.rx * 1.1} ${a.rx * 1.4}`}
        style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${swirlY}px` }}
      />

      {/* 未溶的颗粒：搅着搅着没了 */}
      {Array.from({ length: 5 }, (_, index) => (
        <circle
          key={`grain-${index}`}
          data-a="grain"
          cx={a.mouthX - a.rx * 0.55 + index * (a.rx * 0.28)}
          cy={a.baseY - 14 - (index % 3) * 8}
          r={2.6}
          fill="var(--scene-grain)"
        />
      ))}

      {/* 玻璃棒：倾斜插进液面 */}
      <g
        data-a="rod"
        style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${rodBottom}px` }}
      >
        <rect
          x={a.mouthX - 1.6}
          y={rodTop}
          width={4.6}
          height={rodBottom - rodTop}
          rx={2.3}
          fill="var(--scene-glass-fill)"
          stroke={EDGE}
          strokeWidth={1.2}
          transform={`rotate(10 ${a.mouthX} ${rodBottom})`}
        />
      </g>

      {/* 气泡：搅拌时冒上来 */}
      {Array.from({ length: 3 }, (_, index) => (
        <circle key={`bub-${index}`} data-a="bub" cx={a.mouthX - 8 + index * 8} cy={a.baseY - 16} r={2} fill={EDGE} opacity={0.7} />
      ))}
    </>
  );

  const beats: Beat[] = [
    {
      sel: '[data-a="rod"]',
      frames: [
        { transform: "translate(-14px, -34px) rotate(-12deg)", opacity: 0 },
        { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1, offset: 0.14 },
        { transform: "translate(14px, 0px) rotate(9deg)", offset: 0.32 },
        { transform: "translate(-14px, 0px) rotate(-9deg)", offset: 0.5 },
        { transform: "translate(14px, 0px) rotate(9deg)", offset: 0.68 },
        { transform: "translate(-14px, 0px) rotate(-9deg)", offset: 0.84 },
        { transform: "translate(-14px, -34px) rotate(-12deg)", opacity: 0 },
      ],
      duration: 1500,
      delay: 40,
      easing: EASE_IN_OUT,
    },
    {
      sel: '[data-a="swirl"]',
      frames: [
        { transform: "rotate(0deg)", opacity: 0 },
        { transform: "rotate(40deg)", opacity: 1, offset: 0.15 },
        { transform: "rotate(400deg)", opacity: 1, offset: 0.86 },
        { transform: "rotate(420deg)", opacity: 0 },
      ],
      duration: 1400,
      delay: 160,
      easing: "linear",
    },
    {
      sel: '[data-a="grain"]',
      frames: [
        { transform: "scale(1)", opacity: 1 },
        { transform: "translate(3px, -4px) scale(.55)", opacity: 0.7, offset: 0.55 },
        { transform: "translate(6px, -8px) scale(.1)", opacity: 0 },
      ],
      duration: 1000,
      delay: 460,
      stagger: 90,
      easing: EASE_OUT,
    },
    {
      sel: '[data-a="bub"]',
      frames: [
        { transform: "translate(0px, 0px) scale(.5)", opacity: 0 },
        { transform: `translate(0px, ${-(a.baseY - a.surfaceY) * 0.6}px) scale(1)`, opacity: 0.8, offset: 0.6 },
        { transform: `translate(0px, ${-(a.baseY - a.surfaceY) * 0.8}px) scale(.8)`, opacity: 0 },
      ],
      duration: 900,
      delay: 380,
      stagger: 150,
    },
  ];

  return { node, beats, ms: 1620 };
}

/** 滴加：滴管悬在液面上方，液滴一颗颗落。 */
export function buildDrops(a: VesselAnchor, opts: { clipId: string; levelStart?: number }): ActionScene {
  /** 器皿自己的液面几何（局部坐标） */
  const box = liquidBox(a.kind);
  /** 液位位移一律换算成器皿局部坐标（液体层在外层 `scale()` 里） */
  const shift = (level: number) => Number((levelShift(a, level) / a.scale).toFixed(2));
  /** 第 4 轮修：从台面真实液位起画、只涨一格（+0.22），播完状态同步 +1，卸层时不跳 */
  const startLevel = Math.max(0, Math.min(0.75, opts.levelStart ?? 0.22));
  const level = shift(startLevel);
  const tipY = a.mouthY - 18;
  const rise = shift(startLevel + 0.22);

  const node = (
    <>
      <defs>
        <clipPath id={opts.clipId}>
          <path d={a.bodyD} />
        </clipPath>
      </defs>
      <g transform={bodyTransform(a)} clipPath={`url(#${opts.clipId})`}>
        <g data-a="water" style={{ transform: `translateY(${level}px)` }}>
          <rect
            x={box.x - 6}
            y={(a.surfaceY - a.y) / a.scale}
            width={box.w + 12}
            height={(a.baseY - a.surfaceY + 6) / a.scale}
            fill={WATER}
          />
        </g>
      </g>

      {/* 滴管 */}
      <g data-a="dropper">
        <ellipse cx={a.mouthX} cy={tipY - 44} rx={7} ry={8} fill="rgba(150, 165, 182, .55)" stroke={EDGE} strokeWidth={1.3} />
        <path
          d={`M${a.mouthX - 2.2} ${tipY - 36} L${a.mouthX - 1.2} ${tipY} h2.4 L${a.mouthX + 2.2} ${tipY - 36} Z`}
          fill="var(--scene-glass-fill)"
          stroke={EDGE}
          strokeWidth={1.2}
        />
      </g>

      {Array.from({ length: 3 }, (_, index) => (
        <circle key={`dd-${index}`} data-a="dst" cx={a.mouthX} cy={tipY + 2} r={2.3} fill={EDGE} />
      ))}
      <ellipse
        data-a="ripple"
        cx={a.mouthX}
        cy={a.surfaceY + levelShift(a, 0.6) - (a.baseY - a.surfaceY) * 0.6}
        rx={a.rx * 0.5}
        ry={3}
        fill="none"
        stroke={EDGE}
        strokeWidth={1.2}
      />
      {/* 悬滴（C6 定容）：最后一滴先挂在管口涨大、再落下 —— 读成「半滴控制到刻度」 */}
      <circle
        data-a="hang"
        cx={a.mouthX}
        cy={tipY + 3.4}
        r={2.8}
        fill={EDGE}
        opacity={0}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      {/* 摇匀（C6 尾段）：液面两条弧线来回摆。器皿本体不画在这一层，不能整瓶转，
          所以用液面自身的旋转读「摇匀」 */}
      <path
        data-a="swirl"
        d={`M${a.mouthX - a.rx * 0.72} ${a.surfaceY + 3} q${a.rx * 0.72} -6 ${a.rx * 1.44} 0`}
        fill="none"
        stroke={EDGE}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0}
        style={{ transformBox: "view-box", transformOrigin: `${a.mouthX}px ${a.surfaceY}px` }}
      />
    </>
  );

  const fall = a.mouthY + (a.baseY - a.mouthY) * 0.3;
  /**
   * 第五轮：整条压进 2 秒（口径 0.5~2s）。
   * 原来 beats 总长 1920ms + 收尾 → 动作层实测 2134ms，超口径。
   * 压的时候**一拍都没删**：滴管进出、三滴下落、液面涨、涟漪、悬滴、摇匀全留着，
   * 只把各拍的 delay / duration 按比例收紧（最大重叠段从 1920 降到 1550）。
   */
  const beats: Beat[] = [
    {
      sel: '[data-a="dropper"]',
      frames: [
        { transform: "translate(0px, -16px)", opacity: 0 },
        { transform: "translate(0px, 0px)", opacity: 1 },
        { transform: "translate(0px, 0px)", opacity: 1, offset: 0.85 },
        { transform: "translate(0px, -12px)", opacity: 0 },
      ],
      duration: 1180,
      delay: 20,
    },
    {
      sel: '[data-a="dst"]',
      frames: [
        { transform: "translate(0px, 0px) scale(.5)", opacity: 0 },
        { transform: `translate(0px, ${(fall - tipY) * 0.6}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(0px, ${fall - tipY}px) scale(.7)`, opacity: 0 },
      ],
      duration: 420,
      delay: 260,
      stagger: 200,
    },
    {
      sel: '[data-a="water"]',
      frames: [{ transform: `translateY(${level}px)` }, { transform: `translateY(${rise}px)` }],
      duration: 700,
      delay: 380,
      easing: EASE_IN_OUT,
    },
    {
      sel: '[data-a="ripple"]',
      frames: [
        { transform: "scale(.4)", opacity: 0 },
        { transform: "scale(1.5)", opacity: 0.9, offset: 0.4 },
        { transform: "scale(2.1)", opacity: 0 },
      ],
      duration: 440,
      delay: 600,
      easing: EASE_OUT,
    },
    // 悬滴：涨大 → 挂住 → 落下（C6）
    {
      sel: '[data-a="hang"]',
      frames: [
        { opacity: 0, transform: "scale(.3)" },
        { opacity: 1, transform: "scale(1)", offset: 0.55 },
        { opacity: 1, transform: "translate(0px, 2px) scale(1.15)", offset: 0.85 },
        { opacity: 0, transform: "translate(0px, 26px) scale(.6)" },
      ],
      duration: 470,
      delay: 1000,
      easing: EASE_IN_OUT,
    },
    // 摇匀：液面弧线摆两下（C6）
    {
      sel: '[data-a="swirl"]',
      frames: [
        { opacity: 0, transform: "rotate(-5deg) scaleX(.72)" },
        { opacity: 0.9, transform: "rotate(4deg) scaleX(1)", offset: 0.3 },
        { opacity: 0.9, transform: "rotate(-4deg) scaleX(.9)", offset: 0.6 },
        { opacity: 0, transform: "rotate(3deg) scaleX(.98)" },
      ],
      duration: 460,
      delay: 1090,
      easing: EASE_IN_OUT,
    },
  ];

  return { node, beats, ms: 1600 };
}
