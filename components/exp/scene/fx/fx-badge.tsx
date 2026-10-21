import { FX_SEMANTIC_VAR, type FxSemantic } from "@/lib/scene/fx";
import styles from "./fx.module.css";

/** 事故角标：语义色底 + ⚠ 图标 + 事故名，学生一眼知道"发生了哪类事故"。 */
export function FxBadge({
  text,
  semantic,
  position = "top",
}: {
  text: string;
  semantic: FxSemantic;
  position?: "top" | "bottom";
}) {
  return (
    <span
      className={`${styles.badge} ${position === "top" ? styles.badgeTop : styles.badgeBottom}`}
      style={{ background: FX_SEMANTIC_VAR[semantic] }}
    >
      <span className={styles.badgeIcon} aria-hidden="true">
        ⚠
      </span>
      {text}
    </span>
  );
}
