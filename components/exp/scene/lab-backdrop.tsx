/**
 * 实验室背景（拟真动画风 · 2.5D 固定视角）。
 *
 * 进入实验后**所有实验共用**这一层：各实验的舞台都从 bench-scene 渲染，
 * 所以背景挂在这里，exp01 到 exp10 一起换风格，不用每个实验各画一遍。
 *
 * 要点：**远景虚化 + 光源有方向 + 近景清晰**。这是动画电影背景的做法，不是线稿。
 *   - 墙面：大面积柔和渐变（顶部暖光 → 底部冷影），不描边
 *   - 窗：过曝白光 + 光晕洇到墙上（这是「外面有太阳」的依据）
 *   - 设备/货架：低对比剪影 + 轻度模糊，退到后面（景深）
 *   - 挡水板 + 台沿：给台面一个真实的厚度，把近景托起来
 *
 * 为什么用 SVG 而不是 3D / 图片：
 *   扣子上传有体积上限，一张 2K 背景图就几 MB；矢量渐变零配额，
 *   且模糊只作用在静态层（一次栅格化，不参与每帧重绘），移动端开销可忽略。
 */

import { BENCH } from "./bench-layout";

/** 背景整体高度：越高，实验室的「房间感」越足 */
export const BACKDROP_H = 236;

/** 远景试剂瓶里那点颜色：只暗示「架子上有试剂」，不参与任何判定 */
const REAGENT_TINTS = ["#9DBBA6", "#C0B489", "#A8B6C9", "#C9A6A0", "#9FB6BE"];

export function LabBackdrop({ top }: { top: number }) {
  const wallBottom = BENCH.surface - 20;
  const h = wallBottom - top;
  const shelfTop = top + 74;
  const shelfBottom = top + 158;
  const hoodH = wallBottom - top - 12;

  return (
    <g aria-hidden="true" data-layer="lab-backdrop">
      <defs>
        <linearGradient id="labWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4F1EA" />
          <stop offset="34%" stopColor="#EDEDE7" />
          <stop offset="72%" stopColor="#E4E7E5" />
          <stop offset="100%" stopColor="#D9DFDF" />
        </linearGradient>
        <radialGradient id="labSun" cx="0.72" cy="0.1" r="0.95">
          <stop offset="0%" stopColor="#FFFDF6" stopOpacity="0.95" />
          <stop offset="34%" stopColor="#FFF9EC" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#FFF9EC" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#FFF9EC" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="labPane" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#FBFDFF" />
          <stop offset="55%" stopColor="#EEF4F7" />
          <stop offset="100%" stopColor="#DDE7EC" />
        </linearGradient>
        <linearGradient id="labHood" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#DCE4E7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#C3CFD4" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="labSplash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E9EDEA" />
          <stop offset="58%" stopColor="#DDE3E1" />
          <stop offset="100%" stopColor="#D2D9D8" />
        </linearGradient>
        <filter id="labSoft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <filter id="labVerySoft" x="-14%" y="-14%" width="128%" height="128%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* 墙面 */}
      <rect x={BENCH.viewLeft} y={top} width={BENCH.viewRight - BENCH.viewLeft} height={h} fill="url(#labWall)" />

      {/* 远景设备：低对比剪影 + 强虚化（景深） */}
      <g filter="url(#labVerySoft)" opacity="0.55">
        <rect x="384" y={top + 18} width="120" height={h - 34} rx="3" fill="#CFD8D8" />
        <rect x="392" y={top + 26} width="104" height={h - 60} rx="2" fill="#DCE4E3" />
        <rect x="1082" y={top + 26} width="76" height={h - 52} rx="2" fill="#E7EAE6" />
      </g>

      {/* 窗：主光源 */}
      <g>
        <rect x="876" y={top + 30} width="212" height="128" rx="2" fill="url(#labSun)" />
        <rect x="884" y={top + 36} width="96" height="116" fill="url(#labPane)" />
        <rect x="988" y={top + 36} width="96" height="116" fill="url(#labPane)" />
        <g stroke="#C9D2D2" strokeWidth="2.4" fill="none">
          <rect x="884" y={top + 36} width="200" height="116" />
          <line x1="984" y1={top + 36} x2="984" y2={top + 152} />
          <line x1="884" y1={top + 94} x2="1084" y2={top + 94} />
        </g>
        <path d={`M900 ${top + 132} L944 ${top + 44} L972 ${top + 44} L928 ${top + 132} Z`} fill="#FFFFFF" opacity="0.4" />
        <rect x="876" y={top + 152} width="212" height="7" rx="1" fill="#D3DAD9" />
      </g>

      {/* 光晕洇到墙面：把「有窗户」变成「有光」 */}
      <ellipse cx="980" cy={top + 120} rx="330" ry="150" fill="url(#labSun)" opacity="0.55" />

      {/* 试剂架：中景，轻虚化保留轮廓 */}
      <g filter="url(#labSoft)" opacity="0.82">
        {[shelfTop, shelfBottom].map((shelfY) => (
          <g key={shelfY}>
            <rect x="396" y={shelfY} width="252" height="6" rx="1" fill="#CED6D4" />
            <rect x="396" y={shelfY + 6} width="252" height="2" fill="#BFC8C7" />
            {[0, 1, 2, 3, 4].map((i) => {
              const bw = 20;
              const bh = 42 - (i % 3) * 8;
              const bx = 412 + i * 47;
              return (
                <g key={i}>
                  <rect x={bx} y={shelfY - bh} width={bw} height={bh} rx="3" fill="#DBE2DF" />
                  <rect x={bx} y={shelfY - bh} width={bw / 2} height={bh} rx="3" fill="#FFFFFF" opacity="0.5" />
                  <rect x={bx + 7} y={shelfY - bh - 7} width="6" height="7" rx="1" fill="#C7D0CD" />
                  <rect
                    x={bx + 1}
                    y={shelfY - bh * 0.42}
                    width={bw - 2}
                    height={bh * 0.42}
                    rx="2"
                    fill={REAGENT_TINTS[i % REAGENT_TINTS.length]}
                    opacity="0.55"
                  />
                </g>
              );
            })}
          </g>
        ))}
      </g>

      {/* 右侧通风柜：玻璃 + 金属框（不虚化，它离台面近） */}
      <g>
        <rect x="1096" y={top + 12} width="68" height={hoodH} rx="2" fill="url(#labHood)" />
        <rect x="1096" y={top + 12} width="68" height={hoodH} rx="2" fill="none" stroke="#B9C4C7" strokeWidth="2" />
        <line x1="1096" y1={top + 78} x2={BENCH.viewRight} y2={top + 78} stroke="#B9C4C7" strokeWidth="1.6" />
        <line x1="1096" y1={top + 150} x2={BENCH.viewRight} y2={top + 150} stroke="#B9C4C7" strokeWidth="1.6" />
        <rect x="1104" y={top + 24} width="52" height="44" rx="2" fill="#A9B7BC" opacity="0.35" />
        <rect x="1118" y={top + 96} width="20" height="44" rx="3" fill="#C9D3D2" />
      </g>

      {/* 挡水板：台面靠墙的那道真实厚度 */}
      <rect x={BENCH.viewLeft} y={wallBottom} width={BENCH.viewRight - BENCH.viewLeft} height="20" fill="url(#labSplash)" />
      <line x1={BENCH.viewLeft} y1={wallBottom + 0.5} x2={BENCH.viewRight} y2={wallBottom + 0.5} stroke="#FFFFFF" strokeWidth="1.4" opacity="0.75" />
    </g>
  );
}
