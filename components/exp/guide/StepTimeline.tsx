"use client";

/**
 * StepTimeline —— 已完成步骤的时间线（✓ 第 1 步 · 洗涤 12s）。
 *
 * 替代原来"7 个并列小方块"：走过的步骤给 ✓ 与耗时，当前步骤高亮，未到的淡化。
 * 点击任一步只在场景底部显示一句说明，不跳转、不改状态。
 */

import type { StepDotState } from "./copy";
import styles from "./guide.module.css";

export interface StepTimelineItem {
  index: number;
  title: string;
}

export interface StepTimelineProps {
  steps: readonly StepTimelineItem[];
  states: readonly StepDotState[];
  /** 已用时（秒），按 stepIndex 索引；没有记录就不显示 */
  seconds: Readonly<Record<number, number>>;
  onPeek: (index: number) => void;
}

export function StepTimeline({ steps, states, seconds, onPeek }: StepTimelineProps) {
  return (
    <ol className={styles.timeline} aria-label="步骤时间线">
      {steps.map((step) => {
        const state = states[step.index] ?? "todo";
        const spent = seconds[step.index];
        return (
          <li key={step.index} className={styles.timelineItem} data-state={state}>
            <button
              type="button"
              className={`${styles.timelineButton} ix`}
              onClick={() => onPeek(step.index)}
              data-demo-id={`demo-guide-step-${step.index + 1}`}
              title={
                state === "done" && spent
                  ? `第 ${step.index + 1} 步 · ${step.title} · 已用 ${spent}s`
                  : `第 ${step.index + 1} 步 · ${step.title}`
              }
              aria-label={
                state === "done"
                  ? `第 ${step.index + 1} 步 ${step.title}，已完成${spent ? `，用时 ${spent} 秒` : ""}`
                  : `第 ${step.index + 1} 步 ${step.title}`
              }
            >
              <span className={styles.timelineCheck} aria-hidden="true">
                {state === "done" ? "✓" : String(step.index + 1).padStart(2, "0")}
              </span>
              <span className={styles.timelineName}>{step.title}</span>
              {state === "done" && spent ? <span className={styles.timelineTime}>{spent}s</span> : null}
              {state === "current" ? <span className={styles.timelineNow}>进行中</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
