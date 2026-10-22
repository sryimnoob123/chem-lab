"use client";

/**
 * 试剂加入动画（asset-pipeline 独占）
 *
 * 用户 2026-10-22 口径："拖进来之后要有一个瓶子飞过去、倾斜、倒进去，
 * 不是水凭空出现在瓶里。" 所以一次加入 = 5 段，总时长约 1150ms：
 *
 *   0ms     试剂瓶从架上（from）飞到器皿上方（290ms，缓出）
 *   290ms   瓶身绕**瓶口**倾转 118°（180ms）——瓶口不动、瓶身甩到一侧上方
 *   370ms   连续液柱从瓶口竖直落下（scaleY 0.12→1，560ms，中途不断线）
 *   430ms   3 颗液滴沿同一条竖线错开下坠（每条 380ms，错开 90ms）
 *   620ms   落点涟漪（圆环 scale .3→1 + opacity 1→0，380ms）
 *   640ms   液面抬升（scaleY .12→1，260ms，缓出）
 *   900ms   瓶子飞回架上并淡出（250ms），液柱同步收尾
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
  /** 台面场景：倒进哪台器皿（HTML 层不用；bench-pour 靠它取器皿几何算瓶口坐标）。 */
  vesselId?: string | null;
  /** 松手点的视口坐标：SVG 里的瓶子从手指松开的地方起飞，接上拖动影子。 */
  release?: { x: number; y: number } | null;
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

/**
 * 倾倒角：118°（瓶口朝下、低于瓶身主体）。
 * CSS 的 transform-origin 挂在**瓶口中心**（`.pourBottle { transform-origin: 50% -8px }`），
 * 所以旋转只甩瓶身、瓶口位置不动 —— 液流才能从瓶口竖直落到液面，不会从瓶身侧面冒出来。
 * 方向按「瓶子从哪侧来」取符号：从左侧来 → 顺时针 +118°（瓶身在左上，口朝右下）。
 */
const TILT_DEG = 118;

/** 瓶身左上角相对瓶口中心的偏移（宽 30、高 46，瓶口在元素上沿外 8px）。 */
const MOUTH_TO_BOX = { x: 15, y: -8 };

/** 瓶口悬停在液面上方的高度（px）。液流长度 = 这段距离，必须 > 0 才不断线。 */
const MOUTH_GAP = 68;

/** 液柱开始落下的时间点：比第一颗液滴早 60ms，让"水流先出来、水珠跟着落"。 */
const STREAM_DELAY = DROP_START - 60;
/** 液柱生长时长：要在第 3 颗液滴落地前落满全段。 */
const STREAM_GROW_MS = 220;
/** 液柱持续时间（含收尾淡出）。 */
const STREAM_MS = 560;

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
    const stream = root.querySelector<HTMLElement>("[data-pour-stream]");
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

    // 瓶口停在器皿液面正上方：瓶口 = 元素左上角 + (15, -8)。
    // transform-origin 挂在瓶口，旋转不会挪动它，液流起点因此稳定、可以竖直落。
    const fromRight = pour.to.x > pour.from.x;
    const tilt = TILT_DEG * (fromRight ? 1 : -1);
    const mouth = { x: to.x, y: to.y - MOUTH_GAP };
    const hover = { x: mouth.x - MOUTH_TO_BOX.x, y: mouth.y - MOUTH_TO_BOX.y };

    if (flying) {
      flying.style.left = `${pour.from.x}px`;
      flying.style.top = `${pour.from.y}px`;
      const frames: Keyframe[] = [];
      const STEP = 14;
      for (let i = 0; i <= STEP; i += 1) {
        const t = i / STEP;
        const p = flyPath(pour.from, hover, t);
        // 空中先微微倾斜（像被人拎起来），落位时再一口气倒下去
        const lean = tilt * 0.12 * t;
        frames.push({
          transform: `translate(${(p.x - pour.from.x).toFixed(1)}px, ${(p.y - pour.from.y).toFixed(1)}px) rotate(${lean.toFixed(1)}deg)`,
          offset: t,
        });
      }
      // 到达后倾斜到倾倒角
      frames.push({
        transform: `translate(${(hover.x - pour.from.x).toFixed(1)}px, ${(hover.y - pour.from.y).toFixed(1)}px) rotate(${tilt.toFixed(1)}deg)`,
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
              transform: `translate(${(hover.x - pour.from.x).toFixed(1)}px, ${(hover.y - pour.from.y).toFixed(1)}px) rotate(${tilt.toFixed(1)}deg)`,
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

    // 液柱：一条从瓶口竖直落到液面的连续水流（参考 preview/drag-pour.html 的做法）。
    // 只用 scaleY 生长，不碰 height，避免逐帧重排；落满后再淡出，保证中途"不断线"。
    if (stream) {
      stream.style.left = `${mouth.x - 1.4}px`;
      stream.style.top = `${mouth.y}px`;
      stream.style.height = `${MOUTH_GAP}px`;
      anims.push(
        stream.animate(
          [
            { transform: "scaleY(0.06)", opacity: 0.85, offset: 0 },
            { transform: "scaleY(1)", opacity: 0.95, offset: STREAM_GROW_MS / STREAM_MS },
            { transform: "scaleY(1)", opacity: 0.95, offset: 0.86 },
            { transform: "scaleY(1)", opacity: 0, offset: 1 },
          ],
          {
            duration: STREAM_MS,
            delay: STREAM_DELAY,
            easing: "cubic-bezier(0.3, 0.02, 0.66, 1)",
            fill: "both",
          },
        ),
      );
    }

    // 液滴：沿同一条竖线跟着水流落，只做轻微摆动，不能斜着从瓶身侧面飞
    drops.forEach((drop, index) => {
      drop.style.left = `${mouth.x - 3.5}px`;
      drop.style.top = `${mouth.y - 5}px`;
      const sway = (index - 1) * 2.5;
      anims.push(
        drop.animate(
          [
            { transform: "translate(0px, 0px) scale(0.55)", opacity: 0 },
            {
              transform: `translate(${sway.toFixed(1)}px, ${(MOUTH_GAP * 0.55).toFixed(1)}px) scale(0.9)`,
              opacity: 1,
              offset: 0.55,
            },
            {
              transform: `translate(${(sway * 1.6).toFixed(1)}px, ${MOUTH_GAP}px) scale(0.7)`,
              opacity: 0.7,
              offset: 1,
            },
          ],
          {
            duration: DROP_FLIGHT_MS,
            delay: DROP_START + index * STAGGER_MS,
            easing: "cubic-bezier(0.45, 0, 0.55, 1)",
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
      {/* 连续液柱：从瓶口竖直落到液面，是"水在流"的主体 */}
      <span
        data-pour-stream
        className={styles.pourStream}
        style={{ left: to.x - 1.4, top: to.y - MOUTH_GAP, height: MOUTH_GAP, background: color, ...vars }}
      />
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
