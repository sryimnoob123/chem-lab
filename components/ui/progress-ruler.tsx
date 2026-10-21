import styles from "./progress-ruler.module.css";

export type ProgressRulerProps = {
  /** 0 ~ 1 */
  value: number;
  label: string;
  valueLabel: string;
  tone?: "light" | "dark";
  className?: string;
};

/**
 * 细进度条：用刻度语言（等距短刻度 + 基线），不用圆角胶囊。
 * 纯展示，value 由调用方算好。
 */
export function ProgressRuler({
  value,
  label,
  valueLabel,
  tone = "light",
  className,
}: ProgressRulerProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  const classes = [styles.root, styles[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className={styles.meta}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{valueLabel}</span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
        <span className={styles.head} style={{ left: `${percent}%` }} />
      </div>
    </div>
  );
}
