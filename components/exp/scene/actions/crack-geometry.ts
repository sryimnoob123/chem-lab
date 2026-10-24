/**
 * 玻璃裂纹几何（纯函数，可单测）
 *
 * 用户口径（打磨计划 B5）：裂纹走向要沿器皿几何，不能是一把随机折线。
 * 做法两层：
 *   1. **长度**由器身包围盒决定 —— 每条裂纹朝自己的方向一直裂到壁（矩形最近交点），
 *      再按 `reach` 收一点，所以端点都落在器壁附近，看起来是「沿玻璃裂开」而不是飘在空气里；
 *   2. **形状**用固定折转表（每段转 12~28°），不随机 —— 每次播放一致，截图可复现。
 *
 * 坐标一律用**器皿局部坐标**（与 `bodyPath` 同一坐标系），外面套 `bodyTransform(a)` + 器身 clipPath，
 * 画出来必然只长在玻璃上。
 */

export type CrackBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type CrackSpec = {
  /** 起始方向（度，0 = 向右，90 = 向下 —— SVG 的 y 轴朝下） */
  ang: number;
  /** 裂到壁之后再收多少（0.55~1 之间，主裂纹给足、支纹短一截） */
  reach: number;
  /** 每段折转角度（度）：从起点依次累加 */
  turn: readonly number[];
};

/** 8 条主干，方向覆盖四周；turn 是折转表（段数 = 长度被切几段）。 */
const CRACK_SPECS: readonly CrackSpec[] = [
  { ang: -100, reach: 1, turn: [10, -16, 9] },
  { ang: -56, reach: 0.82, turn: [-14, 18, -8] },
  { ang: -12, reach: 0.9, turn: [12, -20] },
  { ang: 28, reach: 0.76, turn: [-10, 16, -12] },
  { ang: 68, reach: 0.94, turn: [14, -8, 10] },
  { ang: 112, reach: 0.7, turn: [-18, 12] },
  { ang: 156, reach: 0.88, turn: [16, -14, 6] },
  { ang: 196, reach: 0.8, turn: [-12, 20, -9] },
];

function round(value: number): number {
  return Number(value.toFixed(2));
}

/** 方向 (dx,dy) 从 (x,y) 出发到包围盒边界的距离（矩形最近交点，永远正数）。 */
function distanceToBounds(x: number, y: number, dx: number, dy: number, b: CrackBounds): number {
  const tx = dx > 0 ? (b.right - x) / dx : dx < 0 ? (b.left - x) / dx : Number.POSITIVE_INFINITY;
  const ty = dy > 0 ? (b.bottom - y) / dy : dy < 0 ? (b.top - y) / dy : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(tx, ty));
}

/**
 * 生成 8 条从撞击点裂向器壁的折线（局部坐标）。
 * 每条都从撞击点 `M` 起，按 turn 表分段 `L`，最后一段落在包围盒边界附近。
 */
export function glassCrackPaths(lx: number, ly: number, bounds: CrackBounds): string[] {
  return CRACK_SPECS.map(({ ang, reach, turn }) => {
    const rad = (ang * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const avail = distanceToBounds(lx, ly, dx, dy, bounds);
    const total = Math.max(4, avail * reach);
    /* 除零保护：turn 为空表时 total/0 = Infinity。现有 8 条 CRACK_SPECS 的 turn 都非空，
       而且空表根本进不了下面的 for…of（seg 不会写进 d），所以不是线上可见的 NaN；
       但那是靠「循环体恰好不执行」侥幸成立的，将来加一条空 turn 就会埋雷。
       给出 0 段长，语义也对：没有折点 = 一条直裂纹（2026-10-24 审查）。 */
    const seg = turn.length ? total / turn.length : 0;
    let x = lx;
    let y = ly;
    let a = rad;
    const parts = [`M${round(x)} ${round(y)}`];
    for (const t of turn) {
      a += (t * Math.PI) / 180;
      x += Math.cos(a) * seg;
      y += Math.sin(a) * seg;
      parts.push(`L${round(x)} ${round(y)}`);
    }
    return parts.join(" ");
  });
}
