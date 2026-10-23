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
  /** 台面左右边界；viewBox 两侧各留 14 单位白边
   *  2026-10-23：从 384..1150 放宽到 60..1540 —— 原来台面只占容器中间的 60%，
   *  左右两条空带，用户要求「从左上角到右下角都有场景」。 */
  left: 60,
  right: 1540,
  /** viewBox 全域（背景墙铺到这里，台面内收 40 单位，读得出「墙 + 台」两层）。
   *  单一真值源：bench-scene 的 viewBox 字符串也从这里拼，不再各处写死 370/794。 */
  viewLeft: 20,
  viewRight: 1580,
  /** 台面线上沿 / 前沿下沿 */
  top: 340,
  front: 430,
  /** 台面的后沿（靠墙那条线）：器皿站在这条线之下的台面纵深里。
   *  2026-10-23 从 320 提到 200 —— 原来台面只占舞台下半截，上半截全是墙，
   *  用户要「台面占篇幅要够，从左上角铺开」。 */
  backEdge: 200,
  /** 背墙与台面的接缝（画在器皿站位之后方，器皿才有「站在台面里」的纵深） */
  surface: 286,
  /** 整块版面的下沿（洗涤槽标签底） */
  bottom: 560,
  /** 器皿站位区：右侧给仪器留位置 */
  rowLeft: 140,
  rowRight: 1060,
  /** 这一屏没有仪器时，器皿可以一直排到右边界 */
  rowRightWide: 1470,
  /** 仪器（天平 / pH 计）左上角。
   *  2026-10-23 二次调整：从 1108（右端孤零零一台）移到 150 —— 用户要「天平与器皿同一条线」，
   *  现在它站在器皿行最左端，底边同样压 340 台面线。 */
  instrumentX: 210,
  /** 标签：名称 / 内容（台面前沿上的两行字） */
  labelY: 356,
  contentY: 374,
  /** 单只器皿的最大站位宽度：器皿少时不至于摊得像散架
   *  2026-10-23：232 → 320，台面变宽后器皿能再大一圈 */
  maxSlot: 320,
  /** 洗涤槽原点（槽口左上角） */
  sink: { x: 92, y: 438 },
  /** 工具导轨（托盘底框）：跟着台面放宽，从左槽右侧铺到仪器左侧。
   *  宽度只是「右栏不挡时的满宽」—— 实际宽度由 fitTray() 按右栏左沿收边，
   *  否则窄视口（≤1250px）托盘右端会钻到浮在台面上的任务/错误卡底下（2026-10-23 实测）。 */
  tray: { x: 640, y: 432, w: 650, h: 112 },
} as const;

/** 器具与右栏之间留的净空（viewBox 单位）。16 单位在 1280 宽下约 12px。 */
export const RAIL_GAP = 16;

/**
 * 分析天平画出来的外沿（局部坐标 = `<g transform="scale(1.2)">` 里面的坐标系）。
 *
 * 数值就是底座 0..132 / 底边 126 —— 底边与台面线（`BENCH.top`）对齐，防风罩顶在 y=2。
 * 命中区不许再手写第二组数字：写死过一次（宽高各少 1 个单位），结果就是
 * 「点图形最外一圈没反应 = 命中区比图形小一圈」（2026-10-23 实测边缘外 0.5px 是 MISS）。
 * 命中区一律由本常量 + 描边半宽推（见 `balanceHitBox`），并且有单测 + e2e 守着。
 */
export const BALANCE_ART = { x: 0, y: 0, w: 132, h: 126 } as const;

/** 天平描边宽度（底座 / 防风罩 1.6；显示屏 1.2 更细，按最粗的算）。 */
export const BALANCE_STROKE = 1.6;

/**
 * 天平命中区：绘制外沿 + 描边半宽，再留 `pad` 单位的余量（默认 1，1440 宽下约 0.9px）。
 * 左右上下对称扩，保证「画得到的地方都点得到」，又不至于把旁边洗涤槽的点击抢走。
 */
export function balanceHitBox(pad = 1): BenchBox {
  const p = Math.max(pad, BALANCE_STROKE / 2);
  return {
    x: BALANCE_ART.x - p,
    y: BALANCE_ART.y - p,
    w: BALANCE_ART.w + p * 2,
    h: BALANCE_ART.h + p * 2,
  };
}

/** 托盘最窄也要放得下 8 件工具（每件约 56 单位宽 + 缝）。 */
const TRAY_MIN_W = 480;

export type BenchBox = { x: number; y: number; w: number; h: number };

/**
 * 把工具托盘收到右栏左沿以内。
 *
 * 为什么需要：右栏（任务看板 / 错误演示）是 `position: absolute` 的 HTML 卡，
 * 宽度固定 px、右对齐；台面内容是 viewBox 单位、按容器宽度等比缩放。
 * 两者之间没有任何布局关系 —— 视口一窄，托盘右端就跑到卡片底下（实测 1152 宽被压 21px）。
 * `safeRight` 是右栏左沿换算成 viewBox 单位后的 x（见 use-safe-right.ts），
 * 拿不到量测结果（右栏不在台面上 / 首帧）就返回满宽，行为与改前一致。
 */
export function fitTray(area: BenchBox, safeRight: number | null): BenchBox {
  if (safeRight == null) return area;
  const limit = Math.max(area.x + TRAY_MIN_W, Math.min(area.x + area.w, safeRight - RAIL_GAP));
  return { ...area, w: Math.round(limit - area.x) };
}

/**
 * 器皿行整体左移：让最右那一台也落在右栏左侧。
 * 只动 x（相对间距、尺寸一律不缩），够不着就返回 0 —— 大屏上本来就够宽，别无缘无故挪器具。
 *
 * 返回的 `dx` 要同时给动作层（`anchorOf` 的第三参）：动作动画的锚点来自 palette 原始坐标，
 * 玻璃左移了而动作没跟着走，就会出现"水柱浇在旁边"。
 */
export function shiftInsideRight<T extends { x: number; w: number }>(
  items: readonly T[],
  safeRight: number | null,
  /* 内缩量（viewBox 单位）：palette 的 w 是包围盒宽度，实际画出来的玻璃/接地影会往外探 ~10 单位
     （实测 1152 宽时按 pad=6 收完，DOM 里最右器皿离右栏只剩 2px，太贴）。26 单位在 1152 宽约 19px。 */
  pad = 26,
): { items: T[]; dx: number } {
  if (safeRight == null || items.length === 0) return { items: [...items], dx: 0 };
  const limit = safeRight - RAIL_GAP;
  const over = Math.max(...items.map((i) => i.x + i.w)) + pad - limit;
  if (over <= 0) return { items: [...items], dx: 0 };
  const dx = -Math.round(over * 10) / 10;
  return { items: items.map((i) => ({ ...i, x: Math.round((i.x + dx) * 10) / 10 })), dx };
}

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
 *
 * 2026-10-23：加了「不少于最宽那只器皿」的下限。原先 slot 只按均分算，
 * 器皿一大就比 slot 宽，相邻两只会直接叠在一起（烧杯压住试管）。
 */
export function placeVessels(
  vessels: readonly SceneVessel[],
  hasInstrument: boolean,
): PlacedVessel[] {
  if (vessels.length === 0) return [];
  const left = BENCH.rowLeft;
  const right = hasInstrument ? BENCH.rowRight : BENCH.rowRightWide;
  const avail = right - left;
  const widest = Math.max(...vessels.map((v) => v.w));
  const slot = Math.max(Math.min(avail / vessels.length, BENCH.maxSlot), widest + 6);
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
