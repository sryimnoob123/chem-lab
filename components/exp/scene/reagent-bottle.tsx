/**
 * 试剂瓶 —— 画法照 preview/drag-pour.html 的试剂架：细颈圆肩瓶，只有一条玻璃轮廓、
 * 一条瓶盖线、一块液体和一条瓶身反光。试剂架 / 拖动影子 / 倾倒动画共用这一个组件，
 * 所以三处的瓶子一定是同一只（不会出现"架上是方瓶、飞过去变圆瓶"）。
 */

export const BOTTLE_VIEWBOX = "0 0 46 66";
/** 瓶口中心（局部坐标）—— 倾倒时绕这一点旋转，液柱起点就是它。 */
export const BOTTLE_MOUTH = { x: 23, y: 4 } as const;
export const BOTTLE_SIZE = { w: 46, h: 66 } as const;

const GLASS_PATH = "M18 4h10v12c7 2.4 11 8 11 15v22a7 7 0 0 1-7 7H14a7 7 0 0 1-7-7V31c0-7 4-12.6 11-15Z";
const LIQUID_PATH = "M9 40h28v12a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7Z";
const SHINE_PATH = "M12 22c2-4 5-6.4 10-7";

export type ReagentBottleProps = {
  /** 瓶里液体的颜色（试剂主色；无色试剂给水色）。 */
  color: string;
  /** 外层 svg 的尺寸：试剂架 22、拖动影子 26、倾倒动画直接嵌进场景 SVG。 */
  width?: number;
  height?: number;
  className?: string;
  /** 倾倒时液体要看起来更满；1 = 默认液面。 */
  fill?: number;
  title?: string;
};

export function ReagentBottle({ color, width = 22, height = 32, className, fill = 1, title }: ReagentBottleProps) {
  const liquidTop = 40 - Math.round(6 * Math.max(0, Math.min(1, fill)));
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={BOTTLE_VIEWBOX}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      overflow="visible"
    >
      {title ? <title>{title}</title> : null}
      {/* 玻璃：极淡墨玻璃面 + 一条 1.6 墨线 */}
      <path d={GLASS_PATH} fill="var(--canvas-glass-fill)" stroke="var(--canvas-glass-line)" strokeWidth="1.6" />
      {/* 瓶盖线 */}
      <path d="M20 6h6" stroke="var(--canvas-bottle-lid)" strokeWidth="1.4" strokeLinecap="round" />
      {/* 液体：瓶身下部一块，底边跟着圆肩收 */}
      <path
        d={LIQUID_PATH}
        fill={color}
        fillOpacity="0.88"
        transform={liquidTop === 40 ? undefined : `translate(0 ${liquidTop - 40})`}
      />
      {/* 瓶身反光：一条淡墨短弧（纸白底不用白高光） */}
      <path d={SHINE_PATH} fill="none" stroke="var(--canvas-shine)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
