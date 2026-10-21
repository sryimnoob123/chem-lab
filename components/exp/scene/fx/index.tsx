"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { FxKey } from "@/lib/scene/fx";
import { FxBoilOver } from "./fx-boil-over";
import { FxBurn } from "./fx-burn";
import { FxDeviceAccident } from "./fx-device-accident";
import { FxExplosion } from "./fx-explosion";
import { FxFire } from "./fx-fire";
import { FxGlassBreak } from "./fx-glass-break";
import { FxHeavyMetal } from "./fx-heavy-metal";
import { FxParticles } from "./fx-particles";
import { FxToxicGas } from "./fx-toxic-gas";
import type { FxLevel, FxProps } from "./types";
import styles from "./fx.module.css";

export type { FxProps };

export const FX_COMPONENTS = {
  explosion: FxExplosion,
  toxicGas: FxToxicGas,
  fire: FxFire,
  boilOver: FxBoilOver,
  burn: FxBurn,
  glassBreak: FxGlassBreak,
  heavyMetal: FxHeavyMetal,
  deviceAccident: FxDeviceAccident,
} satisfies Record<FxKey, ComponentType<FxProps>>;

/** 跟随系统「减少动态效果」；用于决定是否渲染 Canvas 粒子（只留静态结局帧）。 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** 屏幕震动时长与 motion.css 里的 --fx-shake-* 对齐（L1~L4 分级）。 */
const SHAKE_MS: Record<FxLevel, number> = { L1: 160, L2: 220, L3: 320, L4: 460 };

/** 挂载时给 body 加临时等级类，整页位移；卸载或超时即移除，不残留。 */
function useImpactShake(level: FxLevel) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cls = `fx-impact-${level.slice(1)}`;
    document.body.classList.add(cls);
    const timer = window.setTimeout(() => document.body.classList.remove(cls), SHAKE_MS[level]);
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove(cls);
    };
  }, [level]);
}

/** 按 key 渲染对应事故特效，并叠加强负反馈冲击层（震动 / 暗场 / vignette / L4 粒子）。 */
export function FxByKey({ fx, level = "L2", ...props }: { fx: FxKey; level?: FxLevel } & FxProps) {
  const Component = FX_COMPONENTS[fx];
  useImpactShake(level);
  const reducedMotion = useReducedMotion();
  const heavy = level === "L3" || level === "L4";
  return (
    <div className={styles.fxShell} data-fx-level={level} data-fx-key={fx}>
      <Component {...props} />
      {heavy ? <div className={styles.impactDark} aria-hidden="true" /> : null}
      {heavy ? <div className={styles.impactVignette} aria-hidden="true" /> : null}
      {level === "L4" && !reducedMotion && (fx === "explosion" || fx === "glassBreak") ? (
        <FxParticles kind={fx} />
      ) : null}
    </div>
  );
}
