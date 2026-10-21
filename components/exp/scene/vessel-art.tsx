"use client";

/**
 * 场景器皿绘制（asset-pipeline 独占）
 *
 * 复用 public/instruments 的几何与规范：描边 #16202C @70% / 1.4px、玻璃白 50%、
 * 左上一条 2px 白高光 @35%、无渐变/投影。局部坐标系与 assets 一致
 * （锥形瓶/烧杯 160×200，滴定管 120×360，试管另设 40×200），外层 translate+scale。
 */

import type { CSSProperties } from "react";
import { mixLiquids } from "@/lib/scene/liquid-mix";
import type { SceneOutcome, SceneVessel } from "@/lib/scene/types";
import styles from "./scene.module.css";

const INK = "#16202C";
const GLASS = { fill: "#fff", fillOpacity: 0.5 } as const;

const scaleOf = (kind: SceneVessel["kind"]): number => {
  switch (kind) {
    case "flask":
      return 0.8;
    case "beaker":
      return 0.72;
    case "burette":
      return 0.7;
    case "volumetric":
      return 0.85;
    default:
      return 0.64;
  }
};

const FLASK_BODY = "M63 16 H97 V62 L128 178 Q128 184 122 184 H38 Q32 184 32 178 L63 62 Z";
const BEAKER_BODY = "M26 41 V188 H134 V41 Z";
const TUBE_BODY = "M7 10 V188 Q7 196 20 196 Q33 196 33 188 V10";
const VOLUMETRIC_BODY =
  "M68 18 H92 V70 C92 80 128 102 132 134 Q136 162 116 176 Q98 188 80 188 Q62 188 44 176 Q24 162 28 134 C32 102 68 80 68 70 Z";

const MOUTH_Y = { flask: 16, beaker: 41, tube: 10, volumetric: 10 } as const;

function liquidPath(kind: SceneVessel["kind"]): string {
  if (kind === "flask") {
    const y = 116;
    const left = 63 - (31 / 116) * (y - 62);
    const right = 97 + (31 / 116) * (y - 62);
    return `M${left.toFixed(1)} ${y} H${right.toFixed(1)} L126 178 Q128 184 122 184 H38 Q32 184 34 178 Z`;
  }
  if (kind === "beaker") return "M29 114 H131 V186 H29 Z";
  if (kind === "volumetric") return "M36 140 H124 Q128 160 112 174 Q96 188 80 188 Q64 188 48 174 Q32 160 36 140 Z";
  return "M9 102 H31 V188 Q31 194 20 194 Q9 194 9 188 Z";
}

/** 沉淀：底部沉积两层 + 颗粒感，并给一层极淡描边，白沉淀在白玻璃上也能看出。 */
function precipitateShape(kind: SceneVessel["kind"], color: string) {
  const speckles = (cx: number, cy: number, rx: number) =>
    [0.18, 0.34, 0.5, 0.66, 0.82].map((t, i) => (
      <circle
        key={i}
        cx={cx - rx + t * rx * 2}
        cy={cy - (i % 2 === 0 ? 1.5 : 3.5)}
        r={1.1 + (i % 3) * 0.35}
        fill={color}
        stroke={INK}
        strokeOpacity="0.16"
        strokeWidth="0.5"
      />
    ));
  if (kind === "flask") {
    return (
      <>
        <ellipse cx="80" cy="180" rx="45" ry="5.4" fill={color} stroke={INK} strokeOpacity="0.14" strokeWidth="0.8" />
        <ellipse cx="80" cy="176" rx="28" ry="3.6" fill={color} />
        {speckles(80, 173, 24)}
      </>
    );
  }
  if (kind === "beaker") {
    return (
      <>
        <ellipse cx="80" cy="185" rx="49" ry="4.8" fill={color} stroke={INK} strokeOpacity="0.14" strokeWidth="0.8" />
        <ellipse cx="80" cy="181" rx="30" ry="3.2" fill={color} />
        {speckles(80, 178, 26)}
      </>
    );
  }
  if (kind === "volumetric") {
    return (
      <>
        <ellipse cx="80" cy="184" rx="46" ry="5" fill={color} stroke={INK} strokeOpacity="0.14" strokeWidth="0.8" />
        <ellipse cx="80" cy="180" rx="30" ry="3.4" fill={color} />
        {speckles(80, 177, 26)}
      </>
    );
  }
  return (
    <>
      <rect x="9" y="184" width="22" height="8" fill={color} rx="1" stroke={INK} strokeOpacity="0.14" strokeWidth="0.6" />
      {speckles(20, 181, 9)}
    </>
  );
}

function bubbleGeo(kind: SceneVessel["kind"]) {
  if (kind === "flask") return { x0: 40, spread: 74, cy: 168, rise: 54 };
  if (kind === "beaker") return { x0: 52, spread: 54, cy: 178, rise: 66 };
  if (kind === "volumetric") return { x0: 40, spread: 80, cy: 176, rise: 46 };
  return { x0: 14, spread: 12, cy: 182, rise: 74 };
}

/** 液体上浮气泡：一次性 1.5s，stagger 由 --delay 控制。 */
function Bubbles({ kind }: { kind: SceneVessel["kind"] }) {
  const g = bubbleGeo(kind);
  // 试管口径细，气泡按同比例会只剩 1~2px：加大半径、多放几颗、加快串出，才看得出“剧烈冒泡”
  const rScale = kind === "tube" ? 1.9 : 1;
  const count = kind === "tube" ? 9 : 7;
  const stagger = kind === "tube" ? 90 : 130;
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          className={styles.bubble}
          cx={g.x0 + ((i * 37) % g.spread)}
          cy={g.cy}
          r={(i % 2 === 0 ? 2.4 : 1.7) * rScale}
          fill="#fff"
          fillOpacity="0.85"
          style={
            {
              "--bubble-rise": `${g.rise}px`,
              "--bubble-delay": `${i * stagger}ms`,
            } as CSSProperties
          }
        />
      ))}
    </g>
  );
}

/** 放热：器口上方 3 条波浪线，opacity 呼吸（循环）。 */
function HeatWaves({ kind }: { kind: SceneVessel["kind"] }) {
  const top = kind === "beaker" ? MOUTH_Y.beaker - 12 : kind === "volumetric" ? MOUTH_Y.volumetric - 2 : MOUTH_Y.flask - 6;
  const x = kind === "tube" ? 2 : 56;
  return (
    <g className={styles.heat} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${x} ${top - i * 13} q8 -7 16 0 t16 0 t16 0`}
          fill="none"
          stroke="#D98324"
          strokeOpacity="0.7"
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{ animationDelay: `${i * 260}ms` }}
        />
      ))}
    </g>
  );
}

/** 雾气：器口上方上浮并变淡（可见气体 / 加热蒸汽）。 */
function Smoke({ kind, color = "#C5E1A5" }: { kind: SceneVessel["kind"]; color?: string }) {
  const cy = kind === "beaker" ? MOUTH_Y.beaker - 6 : kind === "tube" ? MOUTH_Y.tube : kind === "volumetric" ? MOUTH_Y.volumetric : MOUTH_Y.flask;
  const cx = kind === "tube" ? 20 : 80;
  return (
    <g aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          className={styles.smokePuff}
          cx={cx + (i - 1) * 14}
          cy={cy - 8}
          rx={9 + i * 2}
          ry={6 + i}
          fill={color}
          fillOpacity="0.45"
          style={{ animationDelay: `${i * 220}ms` }}
        />
      ))}
    </g>
  );
}

export type VesselArtProps = {
  vessel: SceneVessel;
  contents: readonly string[];
  outcome: SceneOutcome | null;
  /** 每次拖放自增：用作 key，让一次性动画重播。 */
  fxKey: number;
  /** 液面颜色覆盖（如变色反应的终态色）。 */
  liquidOverride?: string | null;
};

export function VesselArt({ vessel, contents, outcome, fxKey, liquidOverride }: VesselArtProps) {
  const s = scaleOf(vessel.kind);
  const mix = mixLiquids(contents);
  const baseColor = mix.color;
  const liquid = liquidOverride ?? outcome?.phenomena.colorChange?.toHex ?? baseColor;
  /** 液体浓度：混色表给的 opacity 夹在 0.45~0.8，太淡看不见、太浓像墨汁。 */
  const liquidOpacity = Math.min(0.8, Math.max(0.45, mix.opacity));
  const fx = outcome?.fx ?? "none";
  const precip = fx === "precipitate" ? outcome?.phenomena.precipitate ?? null : null;
  /** 纯白沉淀在白玻璃上会"消失"：压成暖灰白，保证肉眼能看出浑浊。 */
  const precipFill = precip ? (precip.color.toUpperCase() === "#FFFFFF" ? "#EDEAE1" : precip.color) : null;
  const showLiquid = vessel.kind !== "burette" && contents.length > 0 && baseColor !== null;

  return (
    <g transform={`translate(${vessel.x} ${vessel.y}) scale(${s})`} className={styles.vesselArt}>
      {vessel.kind === "flask" ? (
        <>
          <path d={FLASK_BODY} {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <line x1="60" y1="16" x2="100" y2="16" stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <line x1="67" y1="72" x2="44" y2="164" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}

      {vessel.kind === "beaker" ? (
        <>
          <path d={BEAKER_BODY} {...GLASS} stroke="none" />
          <path d={BEAKER_BODY} fill="none" stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <ellipse cx="80" cy="41" rx="54" ry="7.5" fill="none" stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <line x1="31.5" y1="56" x2="31.5" y2="180" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}

      {vessel.kind === "burette" ? (
        <>
          <path d="M45 14 H75 L73 20 V300 H47 V20 Z" {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <rect x="38" y="300" width="44" height="16" rx="4" {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <rect x="87" y="303.5" width="12" height="9" rx="2" {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <line x1="82" y1="308" x2="87" y2="308" stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <line x1="51" y1="30" x2="51" y2="292" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
          <g stroke={INK} strokeOpacity={0.7} strokeWidth={0.9}>
            {Array.from({ length: 11 }, (_, i) => (
              <line key={i} x1="62" y1={52 + i * 24.4} x2="72.3" y2={52 + i * 24.4} />
            ))}
          </g>
        </>
      ) : null}

      {vessel.kind === "volumetric" ? (
        <>
          <path d={VOLUMETRIC_BODY} {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <path d="M66 10 H94 V18 H66 Z" {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <line x1="66" y1="40" x2="94" y2="40" stroke={INK} strokeOpacity={0.75} strokeWidth={1.6} />
          <text x="98" y="43" fill={INK} fillOpacity="0.6" fontSize="12">
            100
          </text>
          <line x1="74" y1="26" x2="74" y2="60" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}

      {vessel.kind === "tube" ? (
        <>
          <path d={TUBE_BODY} {...GLASS} stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <ellipse cx="20" cy="10" rx="13" ry="3.5" fill="none" stroke={INK} strokeOpacity={0.7} strokeWidth={1.4} />
          <line x1="9.5" y1="18" x2="9.5" y2="184" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}

      {/* 液体：颜色变化用 fill transition 600ms（允许的例外） */}
      {showLiquid && vessel.kind !== "burette" ? (
        <path
          d={liquidPath(vessel.kind)}
          className={styles.liquid}
          style={{ fill: precipFill ?? liquid ?? undefined }}
          fillOpacity={precip ? 0.62 : liquidOpacity}
          stroke={precip ? INK : "none"}
          strokeOpacity={precip ? 0.2 : undefined}
          strokeWidth={precip ? 0.9 : undefined}
        />
      ) : null}

      {/* 现象图层：每次拖放换 key 重播 */}
      <g key={fxKey}>
        {fx === "precipitate" && outcome?.phenomena.precipitate ? (
          <g className={styles.precipitate}>{precipitateShape(vessel.kind, outcome.phenomena.precipitate.color)}</g>
        ) : null}
        {fx === "bubbles" && showLiquid ? <Bubbles kind={vessel.kind} /> : null}
        {fx === "heat" ? <HeatWaves kind={vessel.kind} /> : null}
        {fx === "smoke" ? <Smoke kind={vessel.kind} /> : null}
      </g>
    </g>
  );
}
