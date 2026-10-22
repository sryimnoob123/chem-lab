"use client";

/**
 * 试剂加入动画（asset-pipeline 独占）
 *
 * 用户 2026-10-22 口径："拖进来之后要有一个瓶子飞过去、倾斜、倒进去，
 * 不是水凭空出现在瓶里。" 所以一次加入 = 5 段，总时长约 1150ms：
 *
 *   0ms     试剂瓶从架上（from）飞到器皿上方（290ms，缓出）
 *   290ms   瓶身倾转 −58°（180ms）——"举起来倒"的姿态
 *   430ms   2~3 条液流从瓶口落到器皿（每条 380ms，错开 90ms）
 *   620ms   落点涟漪（圆环 scale .3→1 + opacity 1→0，380ms）
 *   640ms   液面抬升（scaleY .12→1，260ms，缓出）
 *   900ms   瓶子飞回架上并淡出（250ms）
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

const FLY_MS = 290;
const TILT_MS = 180;
const DROP_START = 430;
const DROP_FLIGHT_MS = 380;
const STAGGER_MS = 90;
const RIPPLE_DELAY = 620;
const RIPPLE_MS = 380;
const RISE_DELAY = 640;
const RISE_MS = 260;
const RETURN_DELAY = 900;
const RETURN_MS = 250;
const TOTAL_MS = 1160;

const DROP_COUNT = 3;
const TILT_DEG = -58;

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

/** 瓶子飞行轨迹：先微微上抬再落到器皿上方（二次贝塞尔采样）。 */
function flyPath(from: { x: number; y: number }, to: { x: number; y: number }, t: number) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 70;
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
    const flying = root.querySelector<HTMLElement>("[data-pour-bottle]");
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

    // 瓶子飞行的终点：器皿正上方（瓶口朝下，留出倾倒空间）
    const hover = { x: to.x, y: to.y - 64 };

    if (flying) {
      flying.style.left = `${pour.from.x}px`;
      flying.style.top = `${pour.from.y}px`;
      const frames: Keyframe[] = [];
      const STEP = 14;
      for (let i = 0; i <= STEP; i += 1) {
        const t = i / STEP;
        const p = flyPath(pour.from, hover, t);
        frames.push({
          transform: `translate(${(p.x - pour.from.x).toFixed(1)}px, ${(p.y - pour.from.y).toFixed(1)}px) rotate(0deg)`,
          offset: t,
        });
      }
      // 到达后倾斜
      frames.push({
        transform: `translate(${(hover.x - pour.from.x).toFixed(1)}px, ${(hover.y - pour.from.y).toFixed(1)}px) rotate(${TILT_DEG}deg)`,
        offset: 1,
      });
      anims.push(
        flying.animate(frames, {
          duration: FLY_MS + TILT_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
        }),
      );
      // 倒完飞回并淡出
      anims.push(
        flying.animate(
          [
            {
              transform: `translate(${(hover.x - pour.from.x).toFixed(1)}px, ${(hover.y - pour.from.y).toFixed(1)}px) rotate(${TILT_DEG}deg)`,
              opacity: 1,
            },
            { transform: "translate(0px, 0px) rotate(0deg)", opacity: 0 },
          ],
          {
            duration: RETURN_MS,
            delay: RETURN_DELAY,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "both",
          },
        ),
      );
    }

    // 液流：从倾倒后的瓶口落到器皿液面
    const mouth = { x: hover.x + 6, y: hover.y + 16 };
    drops.forEach((drop, index) => {
      drop.style.left = `${pour.from.x - 3.5}px`;
      drop.style.top = `${pour.from.y - 5}px`;
      const dx = mouth.x - pour.from.x;
      const dy = mouth.y - pour.from.y;
      anims.push(
        drop.animate(
          [
            { transform: "translate(0px, 0px) scale(0.4)", opacity: 0 },
            { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(1)`, opacity: 1, offset: 0.34 },
            {
              transform: `translate(${(mouth.x - pour.from.x).toFixed(1)}px, ${(to.y - pour.from.y).toFixed(1)}px) scale(0.7)`,
              opacity: 0.9,
              offset: 1,
            },
          ],
          {
            duration: DROP_FLIGHT_MS,
            delay: DROP_START + index * STAGGER_MS,
            easing: "cubic-bezier(0.4, 0, 0.6, 1)",
            fill: "both",
          },
        ),
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
      {/* 飞过去的瓶子：从试剂架出发，到器皿上方倾斜，倒完飞回 */}
      <span data-pour-bottle className={styles.pourBottle} style={{ borderColor: color }}>
        <span className={styles.pourBottleNeck} style={{ borderColor: color }} />
        <span className={styles.pourBottleFill} style={{ background: color }} />
      </span>
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
