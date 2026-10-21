"use client";

/**
 * RetryBar —— 失败/被拒后的「重做本步」条（STYLE-20261021 §4.2）。
 *
 * - 主按钮 ≥44px 触控区，focus-visible 有 2px 描边；
 * - 可选 secondary（如「看正确步骤」），同样 ≥44px；
 * - 只做展示与回调，重做逻辑由工作台注入（组件不含业务规则）。
 * 动效：入场 220ms opacity/translate；reduced-motion 下静止。
 */

import styles from "./incident-followup.module.css";

export interface RetryBarAction {
  label: string;
  onClick: () => void;
  demoId?: string;
}

export interface RetryBarProps {
  /** 主按钮：重做本步 */
  onRetry: () => void;
  /** 主按钮文案，默认「重做本步」 */
  label?: string;
  /** 左侧说明（如「本步不计分，重做后重新判定」） */
  hint?: string;
  /** 次要动作（可选） */
  secondary?: RetryBarAction;
  disabled?: boolean;
  demoId?: string;
  className?: string;
}

export function RetryBar({
  onRetry,
  label = "重做本步",
  hint,
  secondary,
  disabled = false,
  demoId,
  className,
}: RetryBarProps) {
  return (
    <div
      className={[styles.retryBar, className].filter(Boolean).join(" ")}
      data-demo-id={demoId}
      role="group"
      aria-label="失败后可以重做本步"
    >
      <span className={styles.retryMark} aria-hidden="true" />
      {hint ? <p className={styles.retryHint}>{hint}</p> : null}
      <div className={styles.retryActions}>
        {secondary ? (
          <button
            type="button"
            className={`ix ${styles.retryGhost}`}
            data-demo-id={secondary.demoId}
            onClick={secondary.onClick}
            disabled={disabled}
          >
            {secondary.label}
          </button>
        ) : null}
        <button
          type="button"
          className={`ix ${styles.retryPrimary}`}
          onClick={onRetry}
          disabled={disabled}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
