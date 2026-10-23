"use client";

/**
 * 玻璃器皿 —— 画法照 preview/drag-pour.html（2.5D，纸白场），2026-10-23 改成实心玻璃：
 *   1. 接地阴影：一枚极淡的径向渐变椭圆（器皿坐在台面上，不飘）；
 *   2. 玻璃：一层淡暖白填充（rgba 暖白 16%，不是线稿）+ **双层描边**
 *      （外 2.6px rgba(74,87,104,.45) 定外形 / 内 1.4px rgba(74,87,104,.13) 是玻璃厚度）
 *      + 内壁一圈 7px 的极淡虚光；
 *   3. 顶面一定是椭圆（瓶口 / 液面），这是 2.5D 唯一的信息来源；
 *   4. 液体 = **实色**矩形（mixLiquids 算出的颜色，不用玻璃色）+ 同色液面椭圆，
 *      两层都被 clipPath（主体轮廓）裁 —— 收腰、圆底自动成立；液位 level 只挪矩形上沿。
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
  VESSEL_SCALE,
  bodyPath,
  levelTopY,
  liquidBox,
  mouthOf,
  reflectArc,
  sheenPath,
  surfaceRxAt,
  surfaceRyAt,
} from "./vessel-geometry";
import styles from "./vessel.module.css";

/** 白色粉末在白玻璃上会消失：压成暖灰白（否则压在实心浅玻璃上看不见）。 */
const SOLID_FALLBACK = "#EDEAE1";
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
  const volumeId = `vol-${uid}`;
  const liquidTopId = `liqTop-${uid}`;
  const liquidDeepId = `liqDeep-${uid}`;
  const scale = VESSEL_SCALE[kind];
  const body = bodyPath(kind);
  const mouth = mouthOf(kind);
  const box = liquidBox(kind);
  const cx = CENTER_X[kind];

  const resolved = level ?? (hasLiquidContent(contents) ? 0.38 : 0);
  const mix = mixLiquids(contents);
  const rawLiquid = liquidOverride ?? mix.color;
  const liquid = mix.kind === "precipitate" && rawLiquid.toUpperCase() === "#FFFFFF" ? "#EDEAE1" : rawLiquid;
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
        {/* 2.5D 体积：横向渐变（左亮 → 中透 → 右暗），让平面轮廓读成圆柱。
            视角固定，靠明暗分左右壁 —— 不引 3D 引擎，性能与体积零代价。 */}
        {/* 液体层次（2026-10-23 用户：不能是一块纯色）：
            液面附近反光偏亮，往下越深越沉 —— 两条叠在液柱上的渐变，被主体轮廓裁住。
            只动静态填充，不参与任何动画。 */}
        <linearGradient id={liquidTopId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30" />
          <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={liquidDeepId} x1="0" y1="0" x2="0" y2="1">
          {/* stop-color 只写十六进制 + stop-opacity 分开：rgba() 在部分浏览器会被当成黑色 */}
          <stop offset="0%" stopColor="#4A5768" stopOpacity="0" />
          <stop offset="62%" stopColor="#4A5768" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#4A5768" stopOpacity="0.20" />
        </linearGradient>
        <linearGradient id={volumeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="14%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="74%" stopColor="rgba(74, 87, 104, 1)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="rgba(74, 87, 104, 1)" stopOpacity="0.17" />
        </linearGradient>
      </defs>

      {/* 接地阴影（drag-pour 的 .shadow 椭圆） */}
      <ellipse cx={cx} cy={box.bottom + 2} rx={surfaceRx * 1.06} ry={7} fill={`url(#${shadowId})`} />

      {/* 玻璃面：淡暖白填充（实心玻璃，不是线稿） */}
      <path d={body} className={styles.glassBody} />

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
            fillOpacity={0.88}
          />
          {/* 上层反光 / 下层沉色：让液柱有厚度（用户 2026-10-23：不能一块纯色） */}
          <rect
            x={box.x}
            y={top}
            width={box.w}
            height={Math.max(0, box.bottom - top)}
            fill={`url(#${liquidTopId})`}
          />
          <rect
            x={box.x}
            y={top}
            width={box.w}
            height={Math.max(0, box.bottom - top)}
            fill={`url(#${liquidDeepId})`}
          />
          {/* 液面：同色椭圆压在矩形上沿，露出上半 = 有厚度的液面（实色，不掺玻璃色）
              ry 按同一视角压缩比推（rx × VIEW_K），细颈容器窄、烧杯宽，才对得上俯视 */}
          <ellipse
            data-liquid-surface
            cx={box.cx}
            cy={top}
            rx={surfaceRx}
            ry={surfaceRyAt(surfaceRx)}
            fill={liquid}
            fillOpacity={1}
          />
          <ellipse
            cx={box.cx}
            cy={top}
            rx={surfaceRx}
            ry={surfaceRyAt(surfaceRx)}
            fill="none"
            stroke="var(--canvas-glass-inner)"
            strokeWidth={0.9}
          />
        </g>
      ) : null}

      {/* 体积明暗：压在液体之上、描边之下，液体也跟着有左亮右暗 */}
      <path d={body} fill={`url(#${volumeId})`} aria-hidden="true" />

      {/* 器底：只画**下半圈**弧（不是整椭圆）。
          整椭圆放在器底会读成「杯子里垫了个盘子」——上半圈横切杯身内部，
          下半圈露出器身之外。真实 2.5D 的圆底就只有贴着器底的一条弧。 */}
      <path
        d={`M ${cx - surfaceRx * 0.94} ${box.bottom - surfaceRyAt(surfaceRx * 0.94)} A ${surfaceRx * 0.94} ${surfaceRyAt(surfaceRx * 0.94)} 0 0 0 ${cx + surfaceRx * 0.94} ${box.bottom - surfaceRyAt(surfaceRx * 0.94)}`}
        clipPath={`url(#${clipId})`}
        fill="none"
        stroke="rgba(74, 87, 104, 0.22)"
        strokeWidth={1.1}
      />

      {/* 玻璃双层描边：外层 2.6px 半透明墨定住外形，内层 1.4px 极淡墨 = 玻璃的厚度
          （2026-10-23 实心玻璃口径；vectorEffect 让缩放到哪台器皿都是同一个粗细） */}
      <path d={body} className={styles.glassEdgeOuter} vectorEffect="non-scaling-stroke" />
      <path d={body} className={styles.glassEdgeInner} vectorEffect="non-scaling-stroke" />
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
        className={styles.mouthLine}
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
