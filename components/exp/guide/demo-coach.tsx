"use client";

/**
 * DemoCoach —— 演示模式引导：一条拖着尾巴的光带 + 一个虚拟手指 + 一句柔和气泡。
 *
 * 为什么不是遮罩：用户口径（2026-10-22）「别搞遮罩那种，太硬」。
 * 所以这里只有一条线、一个指尖和一个气泡，pointer-events 全 none，
 * 台面照常能点能拖；用户一动手，引导立刻让位（quiet），不再自己演。
 *
 * 只动 transform / opacity（AGENTS 3.1）：光带本身是静态渐变路径（尾巴淡、头部亮），
 * 动的是指尖与按下涟漪；脉动走 CSS animation，带 prefers-reduced-motion 关闭。
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./demo-coach.module.css";
import type { CoachPlan } from "./coach-plan";

const PRESS_MS = 460;
const TRAVEL_MS = 1000;
const HOLD_MS = 1500;
/** 一段动作最多演两遍就停住等学生：同一动作不许没完没了循环 */
const CYCLES = 2;

type Point = { x: number; y: number };
type Geometry = { from: Point; to: Point; mid: Point };

/** 找元素中心；找不到就依次退到场景线索器皿、台面。 */
function centerOf(selector: string): Point | null {
  const chain = [
    selector,
    '[data-cue="true"]',
    '[data-demo-id$="-bench-scene"]',
    '[data-demo-id="demo-scene-board"]',
    '[data-demo-id="demo-scene-root"]',
  ];
  for (const candidate of chain) {
    const el = document.querySelector(candidate);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  return null;
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function quadAt(from: Point, mid: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * mid.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * mid.y + t * t * to.y,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface DemoCoachProps {
  plan: CoachPlan | null;
  /** 教师端：指尖落到终点时顺手把这一步做掉（演示给学生看） */
  auto?: boolean;
  onPerform?: () => void;
  onClose: () => void;
  /** 学生提问要来的提示：气泡第二行临时换成它 */
  hint?: string | null;
}

export function DemoCoach({ plan, auto = false, onPerform, onClose, hint }: DemoCoachProps) {
  const gradientId = useId();
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resting, setResting] = useState(false);
  const [replay, setReplay] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });
  const fingerRef = useRef<HTMLSpanElement | null>(null);
  const performedRef = useRef(false);
  const planKey = plan?.key ?? "";
  const planFrom = plan?.from ?? null;
  const planTo = plan?.to ?? null;
  const performRef = useRef(onPerform);
  useEffect(() => {
    performRef.current = onPerform;
  }, [onPerform]);

  // 量位置：等布局稳定后再量一次，窗口变化重画
  // （measure 一律走 rAF：effect 里同步 setState 会触发级联渲染，React Compiler 直接判错）
  useEffect(() => {
    const measure = () => {
      if (!planTo) {
        setGeometry(null);
        return;
      }
      const to = centerOf(planTo);
      if (!to) {
        setGeometry(null);
        return;
      }
      const from = planFrom ? centerOf(planFrom) : null;
      const start = from ?? to;
      const dx = to.x - start.x;
      const dy = to.y - start.y;
      const len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(52, len * 0.2);
      const next: Geometry = {
        from: start,
        to,
        mid: {
          x: (start.x + to.x) / 2 - (dy / len) * bend,
          y: (start.y + to.y) / 2 + (dx / len) * bend,
        },
      };
      // 位置没变就别 setState：否则每次渲染都触发一次更新，量位置会变成死循环
      setGeometry((prev) =>
        prev &&
        Math.abs(prev.from.x - next.from.x) < 0.5 &&
        Math.abs(prev.from.y - next.from.y) < 0.5 &&
        Math.abs(prev.to.x - next.to.x) < 0.5 &&
        Math.abs(prev.to.y - next.to.y) < 0.5
          ? prev
          : next,
      );
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [planFrom, planTo, planKey]);

  useEffect(() => {
    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // 用户一碰台面就停手让位（点控制条本身不算）
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-coach-controls="true"]')) return;
      setQuiet(true);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);

  const place = useCallback((point: Point) => {
    const node = fingerRef.current;
    if (node) node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
  }, []);

  // 指尖走一遍：按下 → 移动 → 松手（涟漪）→ 停一会儿；两遍后停在终点
  useEffect(() => {
    if (!geometry || quiet || paused) return;
    let frame = 0;
    let startedAt = 0;
    let cycle = 0;
    let released = false;
    const { from, mid, to } = geometry;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt;
      if (elapsed < PRESS_MS) {
        place(from);
        if (fingerRef.current) fingerRef.current.dataset.pressed = "true";
      } else if (elapsed < PRESS_MS + TRAVEL_MS) {
        if (fingerRef.current) fingerRef.current.dataset.pressed = "false";
        const t = ease((elapsed - PRESS_MS) / TRAVEL_MS);
        place(quadAt(from, mid, to, t));
      } else {
        place(to);
        if (!released) {
          released = true;
          setRippleKey((key) => key + 1);
          if (auto && !performedRef.current) {
            performedRef.current = true;
            performRef.current?.();
          }
        }
        if (elapsed > PRESS_MS + TRAVEL_MS + HOLD_MS) {
          cycle += 1;
          startedAt = now;
          released = false;
          if (cycle >= CYCLES) {
            setResting(true);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [auto, geometry, place, quiet, paused, replay]);

  if (!plan) return null;

  const path = geometry
    ? `M ${geometry.from.x} ${geometry.from.y} Q ${geometry.mid.x} ${geometry.mid.y} ${geometry.to.x} ${geometry.to.y}`
    : "";
  const bubbleWidth = 236;
  const below = !geometry || geometry.to.y < viewport.height * 0.62;
  const bubbleLeft = geometry
    ? clamp(geometry.to.x - bubbleWidth / 2, 12, Math.max(12, viewport.width - bubbleWidth - 12))
    : 0;
  const bubbleTop = geometry ? (below ? geometry.to.y + 30 : geometry.to.y - 108) : 0;

  return (
    <div
      className={styles.layer}
      data-quiet={quiet ? "true" : "false"}
      data-paused={paused ? "true" : "false"}
      data-resting={resting ? "true" : "false"}
      data-auto={auto ? "true" : "false"}
      aria-live="polite"
    >
      {geometry ? (
        <svg className={styles.ribbon} width={viewport.width} height={viewport.height} aria-hidden="true">
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={geometry.from.x}
              y1={geometry.from.y}
              x2={geometry.to.x}
              y2={geometry.to.y}
            >
              <stop offset="0%" stopColor="var(--exp-accent)" stopOpacity="0" />
              <stop offset="45%" stopColor="var(--exp-accent)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--exp-accent)" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path className={styles.ribbonGlow} d={path} />
          <path className={styles.ribbonCore} d={path} stroke={`url(#${gradientId})`} />
        </svg>
      ) : null}

      {geometry ? (
        <>
          <span
            className={styles.halo}
            style={{ transform: `translate3d(${geometry.from.x}px, ${geometry.from.y}px, 0)` }}
            aria-hidden="true"
          />
          <span
            className={styles.target}
            style={{ transform: `translate3d(${geometry.to.x}px, ${geometry.to.y}px, 0)` }}
            aria-hidden="true"
          >
            <span key={rippleKey} className={styles.targetRipple} />
          </span>
          <span ref={fingerRef} className={styles.finger} aria-hidden="true">
            <span className={styles.tip} />
          </span>
        </>
      ) : null}

      {geometry && !quiet ? (
        <div
          className={styles.bubble}
          style={{ left: bubbleLeft, top: bubbleTop, width: bubbleWidth }}
          data-demo-id="demo-coach-bubble"
        >
          <span className={styles.bubbleAction}>{plan.action}</span>
          <span className={styles.bubbleHow}>{hint ?? plan.how}</span>
        </div>
      ) : null}

      <div className={styles.controls} data-coach-controls="true" data-demo-id="demo-coach-controls">
        {quiet ? (
          <span className={styles.controlNote}>你自己来</span>
        ) : (
          <span className={styles.controlNote}>{paused ? "已暂停" : "演示中"}</span>
        )}
        <button
          type="button"
          className={`${styles.control} ix`}
          data-demo-id="demo-coach-pause"
          onClick={() => {
            setQuiet(false);
            setResting(false);
            setPaused((value) => !value);
            if (paused) setReplay((value) => value + 1);
          }}
        >
          {paused || quiet ? "继续" : "暂停"}
        </button>
        <button
          type="button"
          className={`${styles.control} ix`}
          data-demo-id="demo-coach-replay"
          onClick={() => {
            setQuiet(false);
            setPaused(false);
            setResting(false);
            performedRef.current = false;
            setReplay((value) => value + 1);
          }}
        >
          重播
        </button>
        <button
          type="button"
          className={`${styles.control} ix`}
          data-demo-id="demo-coach-close"
          onClick={onClose}
        >
          跳过
        </button>
      </div>
    </div>
  );
}
