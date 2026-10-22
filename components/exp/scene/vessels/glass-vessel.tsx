"use client";

/**
 * 玻璃器皿 2.5D（三层质感，亮场口径）：
 *   1. 外轮廓：淡墨 1.4px（--glass-outline，rgba(74,87,104,.72)）
 *   2. 内侧 1px 亮边：先铺 3.2px 器皿主色描边，再用 1.4px 外轮廓压住外侧，
 *      最终露出约 1px 的 --exp-accent 内壁（纸白底，不用白色高光）
 *   3. 底部弧形反光：器底一条淡墨 + 器皿色的弧线
 * 液体：上浅下深（叠一层由透明到 --liquid-depth 的渐变）+ 细椭圆液面 + 微光晕 + 3~6 个常驻气泡。
 * 只动 transform / opacity；不用图片、不用 feTurbulence 等重型 filter。
 */

import { useId, type CSSProperties } from "react";
import { mixLiquids } from "@/lib/scene/liquid-mix";
import type { SceneVessel } from "@/lib/scene/types";
import { vesselBubbles } from "@/lib/scene/vessel-paint";
import {
  BURETTE_TICKS,
  MOUTH_Y,
  VESSEL_SCALE,
  bodyPath,
  liquidPath,
  liquidSurfaceRx,
  liquidSurfaceY,
  reflectArc,
  sheenPath,
} from "./vessel-geometry";
import styles from "./vessel.module.css";

const CENTER_X: Readonly<Record<string, number>> = {
  flask: 80,
  beaker: 80,
  volumetric: 80,
  tube: 20,
  dish: 52,
  burette: 60,
};

export interface GlassVesselProps {
  vessel: SceneVessel;
  contents: readonly string[];
  /** 变色反应的终态色（优先级高于混色表）。 */
  liquidOverride?: string | null;
}

/** 器底 y（接地阴影用，局部坐标）。 */
const BASE_Y: Readonly<Record<string, number>> = {
  flask: 184,
  beaker: 188,
  volumetric: 188,
  tube: 194,
  dish: 182,
  burette: 344,
};

export function GlassVessel({ vessel, contents, liquidOverride }: GlassVesselProps) {
  const uid = useId().replace(/:/g, "");
  const kind = vessel.kind;
  const glassId = `glass-${uid}`;
  const depthId = `depth-${uid}`;
  const clipId = `clip-${uid}`;
  const shadowId = `shadow-${uid}`;
  const scale = VESSEL_SCALE[kind];
  const body = bodyPath(kind);

  const mix = mixLiquids(contents);
  // 白色沉淀在白玻璃上会"消失"：压成暖灰白（与旧画法一致）
  const rawLiquid = liquidOverride ?? mix.color;
  const liquid =
    mix.kind === "precipitate" && rawLiquid.toUpperCase() === "#FFFFFF" ? "#EDEAE1" : rawLiquid;
  const liquidOpacity = Math.min(0.8, Math.max(0.45, mix.opacity));
  const showLiquid = kind !== "burette" && contents.length > 0;
  const bubbles = showLiquid ? vesselBubbles(kind) : [];
  const cx = CENTER_X[kind] ?? 80;
  const surfaceY = liquidSurfaceY(kind);
  const surfaceRx = liquidSurfaceRx(kind);

  return (
    <g transform={`translate(${vessel.x} ${vessel.y}) scale(${scale})`} className={styles.art}>
      {/* 接地阴影：器皿坐在台面上，而不是浮着。
          用径向渐变（中心深、边缘全透明），比纯色椭圆更像真实投影，也不用 filter。 */}
      <defs>
        <radialGradient id={shadowId}>
          <stop offset="0%" stopColor="#39485A" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#39485A" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#39485A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={cx}
        cy={BASE_Y[kind] ?? 184}
        rx={surfaceRx * 1.12}
        ry={8}
        fill={`url(#${shadowId})`}
      />
      <defs>
        {/* 玻璃体：左上淡、右下略深，给一点圆柱感 */}
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--glass-fill-deep)" />
          <stop offset="52%" stopColor="var(--glass-fill)" />
          <stop offset="100%" stopColor="var(--glass-reflect)" />
        </linearGradient>
        {/* 液体纵深：上浅下深（只叠墨色，不新造颜色） */}
        <linearGradient id={depthId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--liquid-depth)" stopOpacity="0" />
          <stop offset="62%" stopColor="var(--liquid-depth)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--liquid-depth)" stopOpacity="0.62" />
        </linearGradient>
        {/* 内壁亮边只留在器皿内侧：把宽描边的外侧一半裁掉 */}
        <clipPath id={clipId}>
          <path d={body} />
        </clipPath>
      </defs>

      {/* 第一层：玻璃体填充（淡墨渐变，不用白色玻璃感） */}
      <path d={body} fill={`url(#${glassId})`} stroke="none" />

      {kind === "burette" ? <BuretteParts /> : null}

      {/* 第二层：内侧 1px 亮边 —— 宽描边 + 内侧裁切，再用外轮廓压住 0.7px */}
      <path
        d={body}
        fill="none"
        className={styles.innerEdge}
        strokeWidth={2.6}
        strokeLinejoin="round"
        clipPath={`url(#${clipId})`}
      />
      {/* 第一层：外轮廓淡墨描边 */}
      <path
        d={body}
        fill="none"
        stroke="var(--glass-outline)"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />

      <MouthDetail kind={kind} />
      <Graduations kind={kind} />

      {/* 器皿高光：左上一条主色细线（替代旧的白色高光） */}
      <path d={sheenPath(kind)} className={styles.sheen} />

      {showLiquid ? (
        <g
          className={styles.liquidGroup}
          data-vessel-liquid={vessel.id}
          style={{ transformBox: "view-box", transformOrigin: "0 0" }}
        >
          <path
            d={liquidPath(kind)}
            className={mix.kind === "precipitate" ? styles.liquidThick : styles.liquid}
            style={{ fill: liquid }}
            fillOpacity={liquidOpacity}
          />
          <path d={liquidPath(kind)} fill={`url(#${depthId})`} />
          {/* 液面：细椭圆 + 微光晕（两层描边，不铺白） */}
          <ellipse
            cx={cx}
            cy={surfaceY}
            rx={surfaceRx * 0.98}
            ry={4.2}
            fill="none"
            className={styles.surfaceGlow}
            strokeWidth={3}
          />
          <ellipse
            cx={cx}
            cy={surfaceY}
            rx={surfaceRx}
            ry={4.6}
            fill="none"
            className={styles.surface}
            strokeWidth={1.1}
          />
          {bubbles.map((bubble, index) => (
            <circle
              key={index}
              className={styles.bubble}
              cx={bubble.cx}
              cy={bubble.cy}
              r={bubble.r}
              style={
                {
                  "--bubble-delay": `${bubble.delayMs}ms`,
                  "--bubble-dur": `${bubble.durationMs}ms`,
                  "--bubble-rise": `${bubble.rise}px`,
                } as CSSProperties
              }
            />
          ))}
        </g>
      ) : null}

      {/* 第三层：底部弧形反光（画在液体之上，弧线才露得出来） */}
      <path d={reflectArc(kind)} fill="none" className={styles.reflect} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

/**
 * 刻度：烧杯 20/40/60/80 mL 四条主刻度 + 一条半格线。
 * 纸白底上刻度线要淡（墨 0.45），否则像贴纸；数字只在两条主刻度上出现，避免糊。
 */
function Graduations({ kind }: { kind: SceneVessel["kind"] }) {
  if (kind !== "beaker") return null;
  const rows: readonly { y: number; label?: string }[] = [
    { y: 78, label: "80" },
    { y: 100 },
    { y: 122, label: "40" },
    { y: 144 },
  ];
  return (
    <g className={styles.graduation} aria-hidden="true">
      {rows.map((row) => (
        <g key={row.y}>
          <line x1="115" y1={row.y} x2="130" y2={row.y} strokeWidth="0.9" />
          <line x1="115" y1={row.y + 7} x2="122" y2={row.y + 7} strokeWidth="0.7" opacity="0.45" />
          {row.label ? (
            <text x="110" y={row.y + 3} textAnchor="end" fontSize="8" opacity="0.7">
              {row.label}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  );
}

/** 瓶口 / 塞子 / 刻度这些识别细节：结构沿用旧画法，颜色改走 token。 */
function MouthDetail({ kind }: { kind: SceneVessel["kind"] }) {
  if (kind === "flask") {
    return <line x1="60" y1={MOUTH_Y.flask} x2="100" y2={MOUTH_Y.flask} className={styles.outline} strokeWidth={1.4} />;
  }
  if (kind === "beaker") {
    return <ellipse cx="80" cy={MOUTH_Y.beaker} rx="54" ry="7.5" fill="none" className={styles.outline} strokeWidth={1.4} />;
  }
  if (kind === "volumetric") {
    return (
      <>
        <path d="M66 10 H94 V18 H66 Z" className={styles.glassShape} strokeWidth={1.4} />
        <line x1="66" y1="40" x2="94" y2="40" className={styles.graduation} strokeWidth={1.6} />
        <text x="98" y="43" className={styles.capacity}>
          100
        </text>
      </>
    );
  }
  if (kind === "tube") {
    return <ellipse cx="20" cy={MOUTH_Y.tube} rx="13" ry="3.5" fill="none" className={styles.outline} strokeWidth={1.4} />;
  }
  return null;
}

/** 滴定管：管身 + 旋塞 + 尖嘴 + 11 条刻度（沿用既有几何，换三层描边）。 */
function BuretteParts() {
  return (
    <g>
      <rect x="38" y="300" width="44" height="16" rx="4" className={styles.glassShape} strokeWidth={1.4} />
      <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" className={styles.glassShape} strokeWidth={1.4} />
      <rect x="87" y="303.5" width="12" height="9" rx="2" className={styles.glassShape} strokeWidth={1.4} />
      <line x1="82" y1="308" x2="87" y2="308" className={styles.outline} strokeWidth={1.4} />
      <g className={styles.graduation} strokeWidth={0.9}>
        {Array.from({ length: BURETTE_TICKS }, (_, index) => (
          <line key={index} x1="62" y1={52 + index * 24.4} x2="72.3" y2={52 + index * 24.4} />
        ))}
      </g>
      <path d="M45 14 H75 L73 20 V300 H47 V20 Z" fill="none" className={styles.innerEdge} strokeWidth={3.2} />
      <path d="M45 14 H75 L73 20 V300 H47 V20 Z" fill="none" className={styles.outline} strokeWidth={1.4} />
    </g>
  );
}
