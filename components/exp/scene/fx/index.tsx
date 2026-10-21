"use client";

import { useEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { getFxAftermath, type FxKey } from "@/lib/scene/fx";
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
import impact from "./fx-impact.module.css";

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

/** 场景舞台兜底选择器：真实工作台的 [data-scene]，演示页的两个舞台。 */
const SCENE_TARGETS = "[data-scene], [data-demo-id='demo-fx-stage'], [data-fx-active]";

/**
 * 事故后只抖「实验台/场景层」，不抖整页：
 * 1. 找到最近的场景舞台（SceneStage 根 / 演示舞台）；
 * 2. 舞台里有 [data-bench]（实验台）就只抖它，桌面试剂架等 UI 不动；
 * 3. 找不到场景（如组件被单独使用）则退化为抖特效外壳。
 * 时长走 --fx-shake-* 变量；reduced-motion 下全程静止；结束移除临时类，不残留样式。
 */
function useSceneImpact(level: FxLevel, shellRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = shell.closest<HTMLElement>(SCENE_TARGETS);
    const bench = stage?.querySelector<HTMLElement>("[data-bench]") ?? null;
    const target = bench ?? stage ?? shell;
    const cls = `fx-scene-impact-${level.slice(1)}`;
    target.classList.remove(cls);
    // 读一次布局，强制重播（同一元素连续两次事故也能抖）。
    target.getBoundingClientRect();
    target.classList.add(cls);
    const timer = window.setTimeout(() => target.classList.remove(cls), SHAKE_MS[level]);
    return () => {
      window.clearTimeout(timer);
      target.classList.remove(cls);
    };
  }, [level, shellRef]);
}

/** 每类事故固定 4 个余烬；粒子总数 6（4 余烬 + 2 烟尾），远低于 12 上限。 */
function Remainder({ kind }: { kind: "ember" | "smoke" | "spark" }) {
  return (
    <div className={impact.aftermath} data-aftermath={kind} aria-hidden="true">
      <span className={impact.aftermathEmber} />
      <span className={impact.aftermathEmber} />
      <span className={impact.aftermathEmber} />
      <span className={impact.aftermathEmber} />
      <span className={impact.aftermathWisp} />
      <span className={impact.aftermathWisp} />
    </div>
  );
}

/**
 * 按 key 渲染对应事故特效，并叠加强负反馈冲击层：
 * - L1/L2：特效本体 + 分级震动，不压暗；
 * - L3：场景块局部暗场（--bench-ink-dark，只这一块）+ 280ms 轻震；
 * - L4：全屏压暗 + 红色边框收束由 IncidentBanner 负责（不依赖是否有 fx，
 *   且 z-index 低于右栏 10 / 顶栏 30 / 任务看板 12），这里只保留最强震动。
 */
export function FxByKey({ fx, level = "L2", ...props }: { fx: FxKey; level?: FxLevel } & FxProps) {
  const Component = FX_COMPONENTS[fx];
  const shellRef = useRef<HTMLDivElement | null>(null);
  useSceneImpact(level, shellRef);
  const reducedMotion = useReducedMotion();
  const aftermath = level === "L1" ? null : getFxAftermath(fx);
  return (
    <div ref={shellRef} className={impact.shell} data-fx-level={level} data-fx-key={fx}>
      <Component {...props} />
      {level === "L3" ? <div className={impact.stageDim} aria-hidden="true" /> : null}
      {aftermath ? <Remainder kind={aftermath} /> : null}
      {level === "L4" && !reducedMotion && (fx === "explosion" || fx === "glassBreak") ? (
        <FxParticles kind={fx} />
      ) : null}
    </div>
  );
}
