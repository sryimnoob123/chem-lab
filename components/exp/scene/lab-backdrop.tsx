/**
 * 实验室背景（拟真动画风 · 2.5D 固定视角）。
 *
 * 进入实验后**所有实验共用**这一层：各实验的舞台都从 bench-scene 渲染，
 * 所以背景挂在这里，exp01 到 exp10 一起换风格，不用每个实验各画一遍。
 *
 * 2026-10-23 收敛（用户口径：风格以新版为主、试剂架融入台面、台面占篇幅要够）：
 * 这一层只干三件事，不再画窗、通风柜、远景货架 —— 在这么扁的舞台里它们全成了
 * 台面上方的杂讯，还会跟 DOM 那排试剂瓶互相打架。
 *   - 墙面：极淡暖白渐变，把台面以上交代成「房间」，不描边、不画窗框
 *   - 光：右上方一团柔光（把「有窗」变成「有光」）
 *   - 挡水板 + 台沿：给台面一个真实厚度，把近景托起来
 *
 * 为什么用 SVG 而不是 3D / 图片：
 *   扣子上传有体积上限，一张 2K 背景图就几 MB；矢量渐变零配额，
 *   且模糊只作用在静态层（一次栅格化，不参与每帧重绘），移动端开销可忽略。
 */

import { BENCH } from "./bench-layout";

/** 背景整体高度：越高，房间感越足（舞台上沿到台面线之间） */
export const BACKDROP_H = 160;

export function LabBackdrop({ top }: { top: number }) {
  const wallBottom = BENCH.backEdge;
  const h = wallBottom - top;
  const cx = (BENCH.viewLeft + BENCH.viewRight) / 2;

  return (
    <g aria-hidden="true" data-layer="lab-backdrop">
      <defs>
        <linearGradient id="labWall" x1="0" y1="0" x2="0" y2="1">
          {/* 颜色走 token（§9.8）：墙脚原来是写死的 #D9DFDF 冷青灰，和暖纸白台面撞色相 */}
          <stop offset="0%" stopColor="var(--lab-wall)" />
          <stop offset="40%" stopColor="var(--lab-wall)" />
          <stop offset="100%" stopColor="var(--lab-wall-foot)" />
        </linearGradient>
        <radialGradient id="labSun" cx="0.72" cy="0.1" r="0.95">
          <stop offset="0%" stopColor="#FFFDF6" stopOpacity="0.95" />
          <stop offset="34%" stopColor="#FFF9EC" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#FFF9EC" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#FFF9EC" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="labSplash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lab-splash, #E9EDEA)" />
          <stop offset="100%" stopColor="var(--bench-edge, #E6E9E4)" />
        </linearGradient>
      </defs>

      {/* 墙面 */}
      <rect x={BENCH.viewLeft} y={top} width={BENCH.viewRight - BENCH.viewLeft} height={h} fill="url(#labWall)" />

      {/* 右上方柔光：把「有窗」变成「有光」，不画窗框 */}
      <ellipse cx={cx + 300} cy={top + h * 0.28} rx="440" ry="210" fill="url(#labSun)" />


      {/* 挡水板：台面靠墙的那道真实厚度。高光不能用白（§9.1：纸白底上白线看不见），改淡墨暗缝 */}
      <rect x={BENCH.viewLeft} y={wallBottom} width={BENCH.viewRight - BENCH.viewLeft} height="20" fill="url(#labSplash)" />
      <line x1={BENCH.viewLeft} y1={wallBottom + 0.5} x2={BENCH.viewRight} y2={wallBottom + 0.5} stroke="rgba(74,87,104,.14)" strokeWidth="1.4" />
    </g>
  );
}
