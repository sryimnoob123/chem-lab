"use client";

/**
 * TrapPanel —— 右上角「错误演示」面板（2026-10-22 用户要求）。
 *
 * 为什么要它：动作列表删掉后，学生端已经没有任何入口能主动触发错误动作，
 * 负反馈（事故条 / 碎裂特效 / 扣分）成了只能靠误操作撞见的东西，
 * 演示时根本点不出来。这里把**当前步骤定义里的 trap** 直接列出来，
 * 点一条 = 走引擎的真实判定链路（不是假动画），事故等级、扣分、特效都照常出。
 *
 * 只渲染当前步的 trap：换步就换一批，不堆整本实验的错误清单。
 */

import styles from "./trap-panel.module.css";

export type TrapItem = {
  choiceId: string;
  label: string;
  /** 事故等级：L1 偏差 / L2 数据作废 / L3 事故 / L4 危险（演示时按这个挑严重程度） */
  level?: string;
};

export type TrapPanelProps = {
  traps: readonly TrapItem[];
  onPick: (choiceId: string) => void;
  /** 实验已结束 / 演示只读时置灰，避免交卷后还能造事故 */
  disabled?: boolean;
};

export function TrapPanel({ traps, onPick, disabled = false }: TrapPanelProps) {
  if (traps.length === 0) return null;

  return (
    <section className={styles.panel} data-demo-id="demo-trap-panel" aria-label="错误演示">
      <div className={styles.head}>
        <span className={styles.kicker}>错误演示</span>
        <span className={styles.count}>{traps.length}</span>
      </div>
      <ul className={styles.list}>
        {traps.map((trap) => (
          <li key={trap.choiceId}>
            <button
              type="button"
              className={styles.item}
              data-demo-id={`demo-trap-${trap.choiceId}`}
              data-level={trap.level}
              disabled={disabled}
              onClick={() => onPick(trap.choiceId)}
            >
              <span className={styles.label}>{trap.label}</span>
              {trap.level ? (
                <span className={styles.level} aria-label={`事故等级 ${trap.level}`}>
                  {trap.level}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
