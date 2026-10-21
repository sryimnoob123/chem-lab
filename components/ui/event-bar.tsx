import styles from "./event-bar.module.css";

export type EventBarState = "info" | "warn" | "danger";

export type EventBarProps = {
  state?: EventBarState;
  text: string;
  hint?: string;
  countdown?: string;
  countdownUnit?: string;
  className?: string;
};

function StateIcon({ state }: { state: EventBarState }) {
  if (state === "info") {
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="4.9" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M8 2.2 14.1 13H1.9L8 2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 6.1v3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

/**
 * 底部事件条：44px 高，左侧 3px 状态竖条 + 图标 + 文案 + 倒计时。
 * 状态只通过竖条、图标和文字颜色表达，不铺大面积底色。
 */
export function EventBar({
  state = "info",
  text,
  hint,
  countdown,
  countdownUnit = "SEC",
  className,
}: EventBarProps) {
  const classes = [styles.bar, className].filter(Boolean).join(" ");

  return (
    <div className={classes} data-state={state} role="status" aria-live="polite">
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.icon}>
        <StateIcon state={state} />
      </span>
      <p className={styles.text}>{text}</p>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      {countdown ? (
        <span className={styles.countdown}>
          <span className={styles.countdownValue}>{countdown}</span>
          <span className={styles.countdownUnit}>{countdownUnit}</span>
        </span>
      ) : null}
    </div>
  );
}
