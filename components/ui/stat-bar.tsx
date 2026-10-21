import styles from "./stat-bar.module.css";

export type StatItem = {
  label: string;
  value: string;
  unit?: string;
};

export type StatBarProps = {
  items: readonly StatItem[];
  tone?: "light" | "dark";
  ariaLabel?: string;
  className?: string;
};

/**
 * 一行状态数，只负责排版。数字统一等宽，不承载阈值/判定。
 */
export function StatBar({
  items,
  tone = "light",
  ariaLabel,
  className,
}: StatBarProps) {
  const classes = [styles.bar, styles[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <dl className={classes} aria-label={ariaLabel}>
      {items.map((item) => (
        <div className={styles.item} key={item.label}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>
            {item.value}
            {item.unit ? <span className={styles.unit}>{item.unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
