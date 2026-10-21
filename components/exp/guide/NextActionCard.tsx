"use client";

/**
 * NextActionCard —— 引导式操作台的主卡：只突出"当前建议动作"。
 *
 * 结构：`第 2/7 步 · 现在该称量了` + 进度点 + 步骤名 + 一个大按钮（动作名 / 一句为什么 / 快捷键）。
 * 其余动作收在工作台里的「其他做法」折叠区，不放这里。
 */

import type { ActionType } from "@/lib/engine.types";
import { ACTION_VERB, type StepDotState } from "./copy";
import styles from "./guide.module.css";

export interface NextActionCardProps {
  stepNo: number;
  total: number;
  stepTitle: string;
  type: ActionType;
  /** 动作名（≤18 字） */
  name: string;
  /** 一句为什么（≤18 字） */
  why: string;
  dots: readonly StepDotState[];
  /** 快捷键提示，如 "1" */
  keyHint?: string;
  /** 建议动作自己的 data-demo-id（沿用 demo-op-*，演示脚本不用改） */
  demoId?: string;
  disabled?: boolean;
  /** result = 刚出结果；next = 继续引导已滑出，按钮再亮一下 */
  phase: "result" | "next";
  onChoose: () => void;
}

export function NextActionCard({
  stepNo,
  total,
  stepTitle,
  type,
  name,
  why,
  dots,
  keyHint,
  demoId,
  disabled,
  phase,
  onChoose,
}: NextActionCardProps) {
  return (
    <section className={styles.card} data-demo-id="demo-guide-card" data-phase={phase} aria-label="建议动作">
      <p className={styles.progress} data-demo-id="demo-guide-progress">
        第 {stepNo}/{total} 步 · 现在该{ACTION_VERB[type]}了
      </p>
      <div className={styles.dots} aria-hidden="true">
        {dots.map((state, index) => (
          <span key={index} className={styles.dot} data-state={state} />
        ))}
      </div>
      <p className={styles.stepTitle}>{stepTitle}</p>
      <button
        type="button"
        className={`${styles.next} ix`}
        data-demo-id={demoId}
        data-guide="next"
        disabled={disabled}
        onClick={onChoose}
      >
        <span className={styles.nextName}>{name}</span>
        <span className={styles.nextWhy}>{why}</span>
        {keyHint ? (
          <span className={styles.key} aria-hidden="true">
            按 {keyHint}
          </span>
        ) : null}
      </button>
    </section>
  );
}
