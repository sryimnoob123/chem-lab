"use client";

/**
 * NextActionCard —— 只突出"当前建议动作"的一张主操作卡。
 *
 * UI 减法（2026-10-21 第二轮）：进度 / 步骤点 / 步骤名都搬到左上角任务看板了，
 * 右侧只剩「一个主操作」：动作名 + 一句为什么 + 快捷键。
 * 其余动作仍在工作台的「其他做法」折叠区，不放这里。
 */

import { clip } from "./copy";
import styles from "./guide.module.css";

export interface NextActionCardProps {
  /** 动作名（≤18 字） */
  name: string;
  /** 一句为什么（≤18 字） */
  why: string;
  /** 快捷键提示，如 "1" */
  keyHint?: string;
  /** 建议动作自己的 data-demo-id（沿用 demo-op-*，演示脚本不用改） */
  demoId?: string;
  disabled?: boolean;
  /** result = 刚出结果；next = 继续引导已滑出，按钮再亮一下 */
  phase: "result" | "next";
  /** L3 提示：在主按钮上直接描边 + 箭头（只亮一个目标） */
  highlight?: boolean;
  onChoose: () => void;
}

export function NextActionCard({
  name,
  why,
  keyHint,
  demoId,
  disabled,
  phase,
  highlight = false,
  onChoose,
}: NextActionCardProps) {
  return (
    <section
      className={styles.card}
      data-demo-id="demo-guide-card"
      data-phase={phase}
      data-hint={highlight ? "true" : "false"}
      aria-label="建议动作"
    >
      <button
        type="button"
        className={`${styles.next} ix`}
        data-demo-id={demoId}
        data-guide="next"
        disabled={disabled}
        onClick={onChoose}
      >
        <span className={styles.nextName}>{clip(name, 18)}</span>
        <span className={styles.nextWhy}>{clip(why, 18)}</span>
        {keyHint ? (
          <span className={styles.key} aria-hidden="true">
            按 {keyHint}
          </span>
        ) : null}
      </button>
    </section>
  );
}
