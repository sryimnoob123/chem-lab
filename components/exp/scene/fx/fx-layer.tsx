import type { ReactNode } from "react";
import styles from "./fx.module.css";
import type { FxScale } from "./types";

/** 特效容器：绝对定位、不吃指针事件；scale=full 时铺满整个舞台。 */
export function FxLayer({
  scale = "inline",
  label,
  children,
}: {
  scale?: FxScale;
  label: string;
  children: ReactNode;
}) {
  const cls = `${styles.layer} ${scale === "full" ? styles.full : styles.inline}`;
  return (
    <div className={cls} role="img" aria-label={label} data-fx-layer={scale}>
      <span className={styles.benchStrip} aria-hidden="true" />
      {children}
    </div>
  );
}
