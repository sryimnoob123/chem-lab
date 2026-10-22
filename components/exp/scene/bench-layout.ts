/**
 * 实验台版面（纯数据 + 纯函数，不含 React）。
 *
 * 只决定「东西摆在哪」，不决定「画成什么样」：绘制仍在 vessel-art / sink / tool-tray。
 * 为什么单拆一份：器皿坐标来自 lib/scene/palette（六个器皿原始 x 从 48 排到 676，
 * 其中滴定管 / 锥形瓶落在 viewBox 左边界外被裁掉），而版面要按「这一屏实际摆几只」
 * 重新均分 —— 这属于视觉布局，不该改数据源，也不该散落在 600 行的 bench-scene 里。
 *
 * 版面（单位 = viewBox 单位）：
 *   370 ┌───────────────────────────────────────────────┐ 1164
 *       │           器皿 / 仪器（站在 340 台面线上）        │
 *   340 ├───────────────────────────────────────────────┤  台面
 *       │  器皿名 / 内容（印在台面前沿）                    │
 *   430 ├───────────────────────────────────────────────┤  前沿
 *       │  洗涤槽（左）             工具导轨（右）           │
 *   560 └───────────────────────────────────────────────┘
 */

import type { SceneVessel } from "@/lib/scene/types";

export const BENCH = {
  /** 台面左右边界；viewBox 两侧各留 14 单位白边 */
  left: 384,
  right: 1150,
  /** 台面线上沿 / 前沿下沿 */
  top: 340,
  front: 430,
  /** 背墙与台面的接缝（画在器皿站位之后方，器皿才有「站在台面里」的纵深） */
  surface: 286,
  /** 整块版面的下沿（洗涤槽标签底） */
  bottom: 560,
  /** 器皿站位区：右侧给仪器留位置 */
  rowLeft: 400,
  rowRight: 980,
  /** 这一屏没有仪器时，器皿可以一直排到右边界 */
  rowRightWide: 1126,
  /** 仪器（天平 / pH 计）左上角 */
  instrumentX: 996,
  /** 标签：名称 / 内容（台面前沿上的两行字） */
  labelY: 356,
  contentY: 374,
  /** 单只器皿的最大站位宽度：器皿少时不至于摊得像散架 */
  maxSlot: 232,
  /** 洗涤槽原点（槽口左上角） */
  sink: { x: 400, y: 438 },
  /** 工具导轨（托盘底框） */
  tray: { x: 612, y: 438, w: 538, h: 112 },
} as const;

export type PlacedVessel = {
  vessel: SceneVessel;
  /** 摆放后的左上角（GlassVessel 用 translate(x y) 定位，所以这里仍是包围盒左上） */
  x: number;
  y: number;
  /** 中心 x：标签、光环、拖放命中区都用它 */
  cx: number;
};

/**
 * 器皿横向均匀分布：按可见器皿数量均分站位，宽度/高度一律不动（只挪位置）。
 * 站位宽度取 min(可用宽度 / 只数, maxSlot)，整组在可用区间里居中 ——
 * 两只器皿时不会被推到两头、六只时也不会挤成一坨。
 */
export function placeVessels(
  vessels: readonly SceneVessel[],
  hasInstrument: boolean,
): PlacedVessel[] {
  if (vessels.length === 0) return [];
  const left = BENCH.rowLeft;
  const right = hasInstrument ? BENCH.rowRight : BENCH.rowRightWide;
  const avail = right - left;
  const slot = Math.min(avail / vessels.length, BENCH.maxSlot);
  const start = left + (avail - slot * vessels.length) / 2;
  return vessels.map((vessel, index) => {
    const x = Math.round(start + slot * (index + 0.5) - vessel.w / 2);
    return { vessel, x, y: vessel.y, cx: x + vessel.w / 2 };
  });
}

/** viewBox 字符串：横向固定，竖向按这一屏最高/最低的内容收紧。 */
export function benchViewBox(contentTop: number): string {
  return `370 ${Math.round(contentTop)} 794 ${Math.round(BENCH.bottom - contentTop)}`;
}
