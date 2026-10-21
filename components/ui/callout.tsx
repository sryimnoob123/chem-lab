import type { CSSProperties } from "react";
import styles from "./callout.module.css";

export type CalloutProps = {
  label: string;
  side?: "left" | "right";
  tone?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
};

/**
 * 教材式标注：1px 引线 + 3px 实心端点 + 标签。
 * 位置由调用方通过 className / style 控制，组件本身不做器材定位。
 */
export function Callout({
  label,
  side = "right",
  tone = "light",
  className,
  style,
}: CalloutProps) {
  const classes = [styles.callout, className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      data-side={side}
      data-tone={tone}
      style={style}
      aria-hidden="true"
    >
      <span className={styles.dot} />
      <span className={styles.line} />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
