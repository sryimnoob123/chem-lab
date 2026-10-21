"use client";

/**
 * MissionBoardDetails —— 看板折叠区的内容（详细流程 / 参数格 / 提示阶梯 / 老师会说）。
 *
 * 从 mission-board.tsx 拆出来（看板本体要守住 ≤200 行）：
 * 本体只管"四行一眼看懂 + 展开开关"，细则全在这里，默认不渲染（挂载时才展开）。
 */

import type { ReactNode } from "react";
import type { StepDotState } from "./copy";
import type { MissionHint, MissionParam, MissionStep } from "./mission-board";
import styles from "./mission-board.module.css";

export interface MissionBoardDetailsProps {
  steps?: readonly MissionStep[];
  dots: readonly StepDotState[];
  seconds?: Readonly<Record<number, number>>;
  onPeek?: (index: number) => void;
  params?: readonly MissionParam[];
  hint?: MissionHint;
  note?: { label: string; text: string };
  done?: boolean;
  footer?: ReactNode;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function MissionBoardDetails({
  steps,
  dots,
  seconds,
  onPeek,
  params,
  hint,
  note,
  done = false,
  footer,
}: MissionBoardDetailsProps) {
  return (
    <>
      {steps && steps.length > 0 ? (
        <ol className={styles.steps} aria-label="实验流程">
          {steps.map((step) => {
            const state = dots[step.index] ?? "todo";
            const spent = seconds?.[step.index];
            return (
              <li key={step.index} className={styles.stepItem} data-state={state}>
                <button
                  type="button"
                  className={`${styles.stepButton} ix`}
                  data-demo-id={`demo-guide-step-${step.index + 1}`}
                  onClick={() => onPeek?.(step.index)}
                  title={`第 ${step.index + 1} 步 · ${step.title}`}
                  aria-label={
                    state === "done"
                      ? `第 ${step.index + 1} 步 ${step.title}，已完成${spent ? `，用时 ${spent} 秒` : ""}`
                      : `第 ${step.index + 1} 步 ${step.title}`
                  }
                >
                  <span className={styles.stepNo} aria-hidden="true">
                    {state === "done" ? "✓" : pad2(step.index + 1)}
                  </span>
                  <span className={styles.stepName}>{step.title}</span>
                  {state === "done" && spent ? <span className={styles.stepTime}>{spent}s</span> : null}
                  {state === "current" ? <span className={styles.stepNow}>进行中</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      {params && params.length > 0 ? (
        <dl className={styles.params}>
          {params.map((param) => (
            <div key={param.label} className={styles.param} data-tone={param.tone ?? "normal"}>
              <dt className={styles.paramLabel}>{param.label}</dt>
              <dd className={styles.paramValue}>
                {param.value}
                {param.unit ? <em>{param.unit}</em> : null}
              </dd>
              {param.note ? <dd className={styles.paramNote}>{param.note}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}

      {hint ? (
        <div className={styles.hintBox}>
          <span className={styles.hintLevel}>{hint.active ? `H${hint.level}` : "H0–H3"}</span>
          <span className={styles.hintMeter} aria-hidden="true">
            {[0, 1, 2, 3].map((level) => (
              <span
                key={level}
                className={styles.hintTick}
                data-active={hint.active && hint.level >= level ? "true" : "false"}
                data-warn={level >= 2 ? "true" : "false"}
              />
            ))}
          </span>
          <button type="button" className={`${styles.hintButton} ix`} onClick={hint.onAsk}>
            {done ? "已完成" : "取一条提示"}
          </button>
          {hint.active && hint.deduct ? <p className={styles.hintWarn}>用提示会扣独立完成分</p> : null}
        </div>
      ) : null}

      {note ? (
        <p className={styles.note}>
          <span>{note.label}</span>
          {note.text}
        </p>
      ) : null}
      {footer}
    </>
  );
}
