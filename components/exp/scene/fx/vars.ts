/**
 * 事故特效公共小工具：给 SVG 元素传 CSS 自定义属性（--dx/--dy…）时用。
 * 直接 `style={{ "--dx": "8px" }}` 在 strict TS 下会报错，这里收口一次。
 */
import type { CSSProperties } from "react";

export type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

export function vars(values: Record<`--${string}`, string | number>): CSSVars {
  return values as CSSVars;
}
