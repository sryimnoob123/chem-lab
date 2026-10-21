"use client";

/**
 * ResultBar —— 每次操作的"即时结果 + 继续引导"两段式结果条。
 *
 * 时间轴（由工作台控制 phase）：
 * - 0~600ms：只显示结果（✓ / ✗ + 一句 ≤18 字的结果，带数字）
 * - 600ms 后：下方滑出「下一步：… →」，用户随时可以点别的，不阻塞
 * `prefers-reduced-motion` 下动画全部瞬时，但两段文字都照常出现（信息不丢）。
 */

import type { FeedbackSeverity } from "@/lib/engine.types";
import styles from "./guide.module.css";

export interface ResultBarProps {
  tone: FeedbackSeverity | "success";
  /** 第一行：即时结果，≤18 字 */
  line: string;
  /** 失败时的一句正确做法 */
  line2?: string;
  badge?: string;
  /** 600ms 后滑出的下一步；null 表示不显示 */
  next: string | null;
  demoId?: string;
  retry?: { demoId: string; onClick: () => void };
  hint?: string;
}

export function ResultBar({ tone, line, line2, badge, next, demoId, retry, hint }: ResultBarProps) {
  const state = tone === "danger" ? "danger" : tone === "warn" ? "warn" : tone === "success" ? "success" : "info";
  return (
    <div className={styles.resultBar} data-state={state} data-demo-id={demoId} role="status" aria-live="polite">
      <span className={styles.resultMark} aria-hidden="true" />
      <span className={styles.resultIcon} aria-hidden="true">
        {state === "success" ? "✓" : state === "danger" || state === "warn" ? "✗" : "i"}
      </span>
      <p className={styles.resultText} data-demo-id="demo-scene-event">
        <span className={styles.resultLine} data-tone={state}>
          {line}
        </span>
        {line2 ? <span className={styles.resultSub}>{line2}</span> : null}
        {next ? (
          <span className={styles.resultNext} data-demo-id="demo-guide-next-line">
            {next}
          </span>
        ) : null}
      </p>
      {badge ? <span className={styles.resultBadge}>{badge}</span> : null}
      {retry ? (
        <button
          type="button"
          className={`${styles.retry} ix ix-shake`}
          data-demo-id={retry.demoId}
          onClick={retry.onClick}
        >
          重做本步
        </button>
      ) : hint ? (
        <span className={styles.resultHint}>{hint}</span>
      ) : null}
    </div>
  );
}
