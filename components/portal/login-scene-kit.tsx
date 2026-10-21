import type { CSSProperties } from "react";

import s from "./login-scene.module.css";

/**
 * 登录页背景的共享「画法」：器皿几何 + 玻璃外壳 + 描绘用的 CSS 变量工具。
 * 几何逐字取自 components/exp/scene/vessel-art.tsx，保证登录页与实验台同源。
 *
 * 规范：描边 #16202C @70% / 1.4px、玻璃填充 #fff @50%、左上 2px 白高光 @35%；
 * 液体取真实试剂色 —— 锥形瓶酚酞粉红 #F48FB1、容量瓶高锰酸钾淡紫 #B39DDB、
 * 烧杯硫酸铜淡蓝 #81D4FA、滴定管与量筒的水色 #DCE9F2。
 */

export const INK = "#16202C";
export const GLASS = { fill: "#fff", fillOpacity: 0.5 } as const;

/* ---- 以下 path 与 vessel-art.tsx 中的同名常量逐字一致 ---- */
export const FLASK_BODY = "M63 16 H97 V62 L128 178 Q128 184 122 184 H38 Q32 184 32 178 L63 62 Z";
export const BEAKER_BODY = "M26 41 V188 H134 V41 Z";
export const VOLUMETRIC_BODY =
  "M68 18 H92 V70 C92 80 128 102 132 134 Q136 162 116 176 Q98 188 80 188 Q62 188 44 176 Q24 162 28 134 C32 102 68 80 68 70 Z";

export const FLASK_LIQUID = "M31.0 116 H129.0 L126 178 Q128 184 122 184 H38 Q32 184 34 178 Z";
export const BEAKER_LIQUID = "M29 114 H131 V186 H29 Z";
export const VOLUMETRIC_LIQUID =
  "M36 140 H124 Q128 160 112 174 Q96 188 80 188 Q64 188 48 174 Q32 160 36 140 Z";

export const PINK = "#F48FB1";
export const PURPLE = "#B39DDB";
export const BLUE = "#81D4FA";
export const WATER = "#DCE9F2";

export const S = 0.7; // 描边不透明度
export const W = 1.4; // 描边宽度

/** 内联 CSS 变量：--i = 描绘序号（120ms 错峰），--phase / --drip-rise 按元素覆盖。 */
export const vars = (v: Record<string, string | number>): CSSProperties => v as CSSProperties;
export const at = (i: number): CSSProperties => vars({ "--i": i });

/** 玻璃器皿外壳：白玻璃 + 墨线 + 左上高光。传 i 则参与首屏描绘（只播一次）。 */
export function Glass({ d, highlight, i }: { d: string; highlight: string; i: number }) {
  return (
    <>
      <path className={s.fillIn} style={at(i)} d={d} {...GLASS} />
      <path
        className={s.draw}
        style={at(i)}
        d={d}
        pathLength={1}
        fill="none"
        stroke={INK}
        strokeOpacity={S}
        strokeWidth={W}
      />
      <path
        className={s.sketchIn}
        style={at(i)}
        d={highlight}
        fill="none"
        stroke="#fff"
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  );
}
