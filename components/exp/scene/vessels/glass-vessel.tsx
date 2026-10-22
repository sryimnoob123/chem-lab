"use client";

/**
 * 玻璃器皿 —— 画法照 preview/drag-pour.html（2.5D，纸白场）：
 *   1. 接地阴影：一枚极淡的径向渐变椭圆（器皿坐在台面上，不飘）；
 *   2. 玻璃：一层极淡墨玻璃面 + 一条 1.6px 淡墨外轮廓（vector-effect 恒定线宽，
 *      缩放到哪台器皿都是同一个粗细）+ 内壁一圈 3.5px 的淡墨虚光；
 *   3. 顶面一定是椭圆（瓶口 / 液面），这是 2.5D 唯一的信息来源；
 *   4. 液体 = 矩形 + 同色液面椭圆，两层都被 clipPath（主体轮廓）裁 —— 收腰、圆底自动成立；
 *      液位 level 只挪矩形上沿，所以液面能随倒液连续上升。
 *
 * 只用 transform / opacity 做动效；不用图片、不用 filter。
 */

import { useId } from "react";
import { getSubstance } from "@/lib/chem/substances";
import { mixLiquids, normalizeLiquidIds } from "@/lib/scene/liquid-mix";
import type { SceneVessel } from "@/lib/scene/types";
import {
  BURETTE_TICKS,
  CENTER_X,
  MOUTH_Y,
  SURFACE_RY,
  VESSEL_SCALE,
  bodyPath,
  levelTopY,
  liquidBox,
  mouthOf,
  reflectArc,
  sheenPath,
  surfaceRxAt,
} from "./vessel-geometry";
import styles from "./vessel.module.css";

/** 白色粉末在白玻璃上会消失：压成暖灰白（与旧的沉淀配色一致）。 */
const SOLID_FALLBACK = "#E7E2D6";
/** 固体粉末层的厚度（局部坐标）。 */
const POWDER_H = 9;

export interface GlassVesselProps {
  vessel: SceneVessel;
  contents: readonly string[];
  /** 变色反应的终态色（优先级高于混色表）。 */
  liquidOverride?: string | null;
  /** 液位 0..1；不传就按内容物推（有液体 0.38 / 只有固体 0）。 */
  level?: number;
}

/** 内容物里有没有液体（水、溶液、指示剂都算）。 */
export function hasLiquidContent(contents: readonly string[]): boolean {
  return normalizeLiquidIds(contents).some((id) => {
    const phase = getSubstance(id)?.phase;
    return phase === "liquid" || phase === "aqueous";
  });
}

/** 第一瓶固体：粉末层用它上色（找不到返回 null）。 */
export function solidColorOf(contents: readonly string[]): string | null {
  for (const id of normalizeLiquidIds(contents)) {
    const substance = getSubstance(id);
    if (substance?.phase === "solid") {
      return substance.color.toUpperCase() === "#FFFFFF" ? SOLID_FALLBACK : substance.color;
    }
  }
  return null;
}

export function GlassVessel({ vessel, contents, liquidOverride, level }: GlassVesselProps) {
  const uid = useId().replace(/:/g, "");
  const kind = vessel.kind;
  const clipId = `clip-${uid}`;
  const shadowId = `shadow-${uid}`;
  const scale = VESSEL_SCALE[kind];
  const body = bodyPath(kind);
  const mouth = mouthOf(kind);
  const box = liquidBox(kind);
  const cx = CENTER_X[kind];

  const resolved = level ?? (hasLiquidContent(contents) ? 0.38 : 0);
  const mix = mixLiquids(contents);
  const rawLiquid = liquidOverride ?? mix.color;
  const liquid = mix.kind === "precipitate" && rawLiquid.toUpperCase() === "#FFFFFF" ? "#EDEAE1" : rawLiquid;
  const liquidOpacity = Math.min(0.82, Math.max(0.46, mix.opacity));
  const showLiquid = kind !== "burette" && resolved > 0.004;
  const top = levelTopY(box, resolved);
  const surfaceRx = surfaceRxAt(kind, top);
  const solid = kind === "burette" ? null : solidColorOf(contents);
  const powderTop = box.bottom - POWDER_H;

  return (
    <g transform={`translate(${vessel.x} ${vessel.y}) scale(${scale})`} className={styles.art} data-vessel-art={vessel.id}>
      <defs>
        {/* 接地阴影：器底一圈极淡的墨，不用 filter */}
        <radialGradient id={shadowId}>
          <stop offset="0%" stopColor="var(--canvas-shadow)" stopOpacity="0.9" />
          <stop offset="62%" stopColor="var(--canvas-shadow)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--canvas-shadow)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={body} />
        </clipPath>
      </defs>

      {/* 接地阴影（drag-pour 的 .shadow 椭圆） */}
      <ellipse cx={cx} cy={box.bottom + 2} rx={surfaceRx * 1.06} ry={7} fill={`url(#${shadowId})`} />

      {/* 液面之前先铺一层玻璃面：液体是「装在玻璃里」的，不是贴在纸上 */}
      <path d={body} fill="var(--canvas-glass-fill)" />

      {/* 固体粉末：沉在器底的一层（不是液体，不参与液面动画） */}
      {solid ? (
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          <rect x={box.x} y={powderTop} width={box.w} height={POWDER_H} fill={solid} opacity="0.92" />
          <ellipse cx={box.cx} cy={powderTop} rx={box.w / 2} ry={2.4} fill={solid} opacity="0.75" />
        </g>
      ) : null}

      {/* 液体：矩形 + 液面椭圆，被主体轮廓裁出来。倒液时整组按底边 scaleY 长高。 */}
      {showLiquid ? (
        <g
          clipPath={`url(#${clipId})`}
          className={styles.liquidGroup}
          data-vessel-liquid={vessel.id}
          data-liquid-level={resolved.toFixed(3)}
        >
          <rect
            data-liquid-rect
            x={box.x}
            y={top}
            width={box.w}
            height={Math.max(0, box.bottom - top)}
            fill={liquid}
            fillOpacity={liquidOpacity}
          />
          {/* 液面：同色椭圆压在矩形上沿，露出上半 = 有厚度的液面 */}
          <ellipse
            data-liquid-surface
            cx={box.cx}
            cy={top}
            rx={surfaceRx}
            ry={SURFACE_RY}
            fill={liquid}
            fillOpacity={Math.min(0.95, liquidOpacity + 0.12)}
          />
          <ellipse
            cx={box.cx}
            cy={top}
            rx={surfaceRx}
            ry={SURFACE_RY}
            fill="none"
            stroke="var(--canvas-glass-inner)"
            strokeWidth={0.9}
          />
        </g>
      ) : null}

      {/* 玻璃外轮廓（drag-pour 的 .glass）：恒定 1.6px，缩放到哪台都一样粗 */}
      <path
        d={body}
        fill="none"
        stroke="var(--canvas-glass-line)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* 内壁那圈淡淡的厚度（宽描边被轮廓裁在内侧） */}
      <path
        d={body}
        fill="none"
        className={styles.innerEdge}
        strokeWidth={7}
        strokeLinejoin="round"
        clipPath={`url(#${clipId})`}
      />
      {/* 瓶口：一定是椭圆（2.5D 看见口里面） */}
      <ellipse
        cx={mouth.cx}
        cy={mouth.y}
        rx={mouth.rx}
        ry={mouth.ry}
        fill="none"
        stroke="var(--canvas-glass-line)"
        strokeWidth={1.6}
        vectorEffect="non-scaling-stroke"
      />
      {/* 左壁一条淡墨高光（纸白底不用白高光） */}
      <path d={sheenPath(kind)} className={styles.sheen} />
      {/* 器底一条反光弧：玻璃坐在台面上 */}
      <path d={reflectArc(kind)} className={styles.reflect} />

      {kind === "beaker" ? <BeakerTicks /> : null}
      {kind === "volumetric" ? <VolumetricMark /> : null}
      {kind === "burette" ? <BuretteParts /> : null}
    </g>
  );
}

/** 烧杯刻度：四条主刻度 + 标签，淡墨细线（纸白底不能画粗黑线）。 */
function BeakerTicks() {
  return (
    <g className={styles.graduation} aria-hidden="true">
      {[
        { y: 78, label: "80" },
        { y: 100 },
        { y: 122, label: "40" },
        { y: 144 },
      ].map((row) => (
        <g key={row.y}>
          <line x1="116" y1={row.y} x2="130" y2={row.y} strokeWidth="0.9" />
          {row.label ? (
            <text x="112" y={row.y + 3} textAnchor="end" fontSize="10">
              {row.label}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  );
}

/** 容量瓶 100 mL：颈上一道标线 + 容量数字。 */
function VolumetricMark() {
  return (
    <g aria-hidden="true">
      <line x1="68" y1="40" x2="92" y2="40" className={styles.graduation} strokeWidth="1.6" />
      <text x="96" y="43" className={styles.capacity}>
        100
      </text>
    </g>
  );
}

/** 滴定管：旋塞 + 尖嘴 + 刻度（结构沿用旧画法，线色统一到新 token）。 */
function BuretteParts() {
  return (
    <g>
      <rect x="38" y="300" width="44" height="16" rx="4" className={styles.glassShape} strokeWidth={1.4} />
      <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" className={styles.glassShape} strokeWidth={1.4} />
      <rect x="87" y="303.5" width="12" height="9" rx="2" className={styles.glassShape} strokeWidth={1.4} />
      <line x1="82" y1="308" x2="87" y2="308" className={styles.outline} strokeWidth={1.4} />
      <g className={styles.graduation} strokeWidth="0.9">
        {Array.from({ length: BURETTE_TICKS }, (_, index) => (
          <line key={index} x1="62" y1={52 + index * 24.4} x2="72.3" y2={52 + index * 24.4} />
        ))}
      </g>
      <line x1="47" y1={MOUTH_Y.burette} x2="73" y2={MOUTH_Y.burette} className={styles.outline} strokeWidth={1.4} />
    </g>
  );
}
