"use client";

/**
 * 试剂加入动画（asset-pipeline 独占）
 *
 * 一次加入 = 4 段，总时长约 700ms：
 *   0ms    瓶身倾转（rotate -14° → 0，300ms）
 *   0ms    2~3 滴试剂沿二次贝塞尔飞向器皿（每滴 420ms，错开 90ms）
 *   360ms  落点涟漪（圆环 scale .3→1 + opacity 1→0，420ms）
 *   400ms  液面抬升（scaleY .04→1，260ms，缓出）
 *
 * 全部用 WAAPI `el.animate()`，不引库；下一次加入会 cancel 上一次的
 * 全部 Animation + timer；`prefers-reduced-motion` 下不注册动画（1 帧切换）。
 */

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./scene.module.css";

export type PourGeom = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  mode: "click" | "drag" | "event";
};

export type PourState = PourGeom & { key: number };

const FLIGHT_MS = 300;
const STAGGER_MS = 70;
const RIPPLE_DELAY = 250;
const RIPPLE_MS = 380;
const RISE_DELAY = 270;
const RISE_MS = 260;
const TOTAL_MS = 700;

const DROP_COUNT = 3;

/** 落点校正：exp09 的投放热区是旧布局，和 SVG 里锥形瓶的位置不一致；
 *  优先用实验台 SVG（viewBox 360×640）里锥形瓶瓶口的真实位置，找不到就退回父组件给的 to。 */
function anchorOf(root: HTMLElement, fallback: { x: number; y: number }) {
  const stage = root.closest("[class*='sceneStage']");
  const svg = stage?.querySelector('svg[viewBox="0 0 360 640"]');
  const base = root.getBoundingClientRect();
  if (!(svg instanceof SVGSVGElement)) return { point: fallback, scale: 1 };
  const rect = svg.getBoundingClientRect();
  if (!rect.width) return { point: fallback, scale: 1 };
  const scale = rect.width / 360;
  return {
    point: { x: rect.left - base.left + 176 * scale, y: rect.top - base.top + 524 * scale },
    scale,
  };
}

const reduced = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 二次贝塞尔采样：从瓶口先微微上抬再落进器皿。 */
function bezier(from: { x: number; y: number }, to: { x: number; y: number }, t: number) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 36;
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
    y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
  };
}

/** 瓶身倾转（可被下一次调用 cancel）。 */
const tiltAnims = new WeakMap<Element, Animation>();

export function tiltBottle(el: Element | null) {
  if (!(el instanceof HTMLElement) || reduced()) return;
  tiltAnims.get(el)?.cancel();
  const anim = el.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-14deg)", offset: 0.45 },
      { transform: "rotate(0deg)" },
    ],
    { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  );
  tiltAnims.set(el, anim);
  anim.onfinish = () => tiltAnims.delete(el);
}

/** 一条加入动画的画面层；由父组件用 key 触发，onDone 后卸下。 */
export function PourFX({ pour, onDone }: { pour: PourState | null; onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** onDone 每次渲染都是新函数；放进 ref，避免父组件重渲染时把计时器/动画反复重置。 */
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!pour) return;
    if (reduced()) {
      onDoneRef.current();
      return;
    }
    const root = rootRef.current;
    if (!root) return;

    const drops = Array.from(root.querySelectorAll<HTMLElement>("[data-pour-drop]"));
    const ripple = root.querySelector<HTMLElement>("[data-pour-ripple]");
    const liquid = root.querySelector<HTMLElement>("[data-pour-liquid]");
    const anims: Animation[] = [];

    // 落点校正到 SVG 里锥形瓶瓶口；同时按实验台缩放调整涟漪/液面尺寸
    const { point: to, scale } = anchorOf(root, pour.to);
    if (ripple) {
      ripple.style.left = `${to.x - 28}px`;
      ripple.style.top = `${to.y - 28}px`;
    }
    if (liquid) {
      const w = 116 * scale;
      const h = 96 * scale;
      liquid.style.left = `${to.x - w / 2}px`;
      liquid.style.top = `${to.y}px`;
      liquid.style.width = `${w}px`;
      liquid.style.height = `${h}px`;
    }

    drops.forEach((drop, index) => {
      const step = 8;
      const frames: Keyframe[] = [];
      for (let i = 0; i <= step; i += 1) {
        const t = i / step;
        const p = bezier(pour.from, to, t);
        frames.push({
          transform: `translate(${(p.x - pour.from.x).toFixed(1)}px, ${(p.y - pour.from.y).toFixed(1)}px) scale(${(1 - t * 0.35).toFixed(3)})`,
          opacity: i === 0 ? 1 : 0.95,
          offset: t,
        });
      }
      anims.push(
        drop.animate(frames, {
          duration: FLIGHT_MS,
          delay: index * STAGGER_MS,
          easing: "linear",
          fill: "both",
        }),
      );
    });

    if (ripple) {
      anims.push(
        ripple.animate(
          [
            { transform: "scale(0.3)", opacity: 0.9 },
            { transform: "scale(1)", opacity: 0 },
          ],
          { duration: RIPPLE_MS, delay: RIPPLE_DELAY, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
        ),
      );
    }

    // 液面抬升：直接抬 SVG 里锥形瓶的真实液面（rect y=604）与液面线，
    // 比叠一层色块干净，也不会盖住瓶身。
    const svg = root.closest("[class*='sceneStage']")?.querySelector('svg[viewBox="0 0 360 640"]');
    const liquidRect = svg?.querySelector('rect[y="604"]');
    const surface = svg?.querySelector('path[d="M88 604 H260"]');
    if (liquidRect) {
      anims.push(
        liquidRect.animate(
          [
            { transform: "scaleY(0.12)", transformOrigin: "50% 100%" },
            { transform: "scaleY(1)", transformOrigin: "50% 100%" },
          ],
          { duration: RISE_MS, delay: RISE_DELAY, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
        ),
      );
    }
    if (surface) {
      anims.push(
        surface.animate(
          [
            { transform: "translateY(34px)" },
            { transform: "translateY(0px)" },
          ],
          { duration: RISE_MS, delay: RISE_DELAY, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
        ),
      );
    }

    if (liquid) {
      // 旧版色块层：保留但不显示（液面改走真实 SVG 液面）
      liquid.style.display = "none";
    }

    const timer = window.setTimeout(() => onDoneRef.current(), TOTAL_MS);
    return () => {
      anims.forEach((a) => a.cancel());
      window.clearTimeout(timer);
    };
    // 只在 pour 变化时重播；onDone 走 ref，避免父组件重渲染重置计时器。
  }, [pour]);

  if (!pour) return null;

  const { from, to, color } = pour;
  const vars = { "--pour-color": color } as CSSProperties;

  return (
    <div ref={rootRef} className={styles.pourLayer} aria-hidden="true" data-pour-key={pour.key}>
      {Array.from({ length: DROP_COUNT }, (_, i) => (
        <span
          key={i}
          data-pour-drop
          className={styles.pourDrop}
          style={{ left: from.x - 3.5, top: from.y - 5, ...vars }}
        />
      ))}
      <span
        data-pour-ripple
        className={styles.pourRipple}
        style={{ left: to.x - 28, top: to.y - 28, borderColor: color, ...vars }}
      />
      <span
        data-pour-liquid
        className={styles.pourLiquid}
        style={{ left: to.x - 22, top: to.y - 8, ...vars }}
      />
    </div>
  );
}
