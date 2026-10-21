import { DeskScene } from "./login-scene-desk";
import { MobileScene } from "./login-scene-mobile";
import s from "./login-scene.module.css";

/**
 * 登录页背景：与实验操作台同一套器皿画法（几何、描边、玻璃、高光一律照抄
 * components/exp/scene/vessel-art.tsx，保证「登录页 = 实验页」同一视觉语言）。
 *
 * 分层：共享画法 login-scene-kit.tsx、桌面 login-scene-desk.tsx、
 * 窄屏 login-scene-mobile.tsx（拆文件是为了守住单文件 300 行预算）。
 *
 * 动效（login-scene.module.css）：首屏描绘 → 液面呼吸 / 双液滴 + 落点涟漪
 * → 双层视差 → feTurbulence 噪点 → 逐件 hover 揭示。
 * 只动 transform / opacity / stroke-dashoffset / filter；reduced-motion 全静止。
 */
export function LoginScene() {
  return (
    <div className={s.scene} aria-hidden="true">
      <DeskScene />
      <MobileScene />

      {/* 噪点层：feTurbulence 自生成（不引位图），压掉平涂的塑料感 */}
      <svg className={s.grain}>
        <filter id="login-scene-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#login-scene-grain)" />
      </svg>
    </div>
  );
}
