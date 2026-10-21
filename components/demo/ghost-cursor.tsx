"use client";

/**
 * GhostCursor —— 一键演示的"真人光标"。
 *
 * 目的：auto 模式原来是 320ms 一次瞬间 dispatch，屏幕上只有结果在变，
 * 看起来像机器刷表；用户要求"曲线光标 0.4~0.8s 移动、悬停 200~400ms、按下涟漪"。
 *
 * 这里只负责画：位置/按下由工作台的状态机驱动，pointer-events 永远 none，
 * 不会抢真实交互。
 */

import styles from "./ghost-cursor.module.css";

export interface GhostState {
  visible: boolean;
  /** 视口坐标（px） */
  x: number;
  y: number;
  /** 按下态：光标缩一下 + 溅出涟漪 */
  pressed: boolean;
  /** 本次移动的时长（ms），CSS transition 用 */
  moveMs: number;
  /** 涟漪的序号，保证每次按下都能重播动画 */
  rippleKey: number;
}

export const GHOST_HIDDEN: GhostState = {
  visible: false,
  x: 0,
  y: 0,
  pressed: false,
  moveMs: 600,
  rippleKey: 0,
};

export function GhostCursor({ state }: { state: GhostState }) {
  return (
    <div
      className={styles.stage}
      data-visible={state.visible ? "true" : "false"}
      data-pressed={state.pressed ? "true" : "false"}
      style={{
        transform: `translate3d(${state.x}px, ${state.y}px, 0)`,
        transitionDuration: `${state.moveMs}ms`,
      }}
      aria-hidden="true"
    >
      <svg className={styles.arrow} width="22" height="24" viewBox="0 0 22 24" fill="none">
        <path
          d="M2 1.6 20 12l-8.3 1.5L8 22 2 1.6Z"
          fill="var(--ink, #1f2a37)"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {state.pressed ? (
        <span key={state.rippleKey} className={styles.ripple} />
      ) : null}
      <span className={styles.halo} />
    </div>
  );
}
