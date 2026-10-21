import styles from "./step-rail.module.css";

export type StepRailState = "done" | "current" | "todo";

export type StepRailItem = {
  id: string;
  label: string;
  ariaLabel?: string;
  href?: string;
  state?: StepRailState;
};

export type StepRailProps = {
  items: readonly StepRailItem[];
  activeId?: string;
  ariaLabel?: string;
  fixed?: boolean;
  className?: string;
};

/**
 * 页边刻度尺。固定的竖向刻度，贯穿整屏；每个 item 是一个真实步骤。
 * 纯展示：状态由调用方给，组件不推导进度。
 */
export function StepRail({
  items,
  activeId,
  ariaLabel = "步骤刻度",
  fixed = true,
  className,
}: StepRailProps) {
  const classes = [styles.rail, fixed ? styles.fixed : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={classes} aria-label={ariaLabel}>
      <ol className={styles.list}>
        {items.map((item) => {
          const active = item.id === activeId;
          const state = item.state ?? (active ? "current" : "todo");
          const label = (
            <>
              <span className={styles.tick} aria-hidden="true" />
              <span className={styles.number}>{item.label}</span>
            </>
          );

          return (
            <li
              key={item.id}
              className={styles.item}
              data-state={state}
              aria-current={active ? "step" : undefined}
            >
              {item.href ? (
                <a
                  className={styles.link}
                  href={item.href}
                  aria-label={item.ariaLabel ?? item.label}
                >
                  {label}
                </a>
              ) : (
                <span className={styles.link} aria-label={item.ariaLabel ?? item.label}>
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
