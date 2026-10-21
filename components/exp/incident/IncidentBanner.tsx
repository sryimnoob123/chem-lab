"use client";

/**
 * IncidentBanner —— E2「事故后」三行事件条（STYLE-20261021 §4.1 / §4.2）。
 *
 * 事故名 + 三行：①错在哪 ②为什么 ③怎么办。文案必须来自
 * experiments/<id>/definition.ts 的 feedback，组件不编化学解释。
 * 布局：绝对定位的窄条（默认贴舞台上沿），不铺满、不遮实验台中央。
 *
 * 动效：入场 220ms（--enter）+ opacity/translate；reduced-motion 下静止显示。
 */

import styles from "./incident-followup.module.css";
import { sanitizeForStudents } from "./messages";

const ROW_KEYS = ["错在哪", "为什么", "怎么办"] as const;

export interface IncidentBannerProps {
  open: boolean;
  /** 事故名（来自 definition.feedback，如「器皿破裂」） */
  title: string;
  /** 固定三行：错在哪 / 为什么 / 怎么办 */
  lines: readonly [string, string, string];
  /** 贴舞台上沿（默认）还是下沿；两端都不挡台面中央 */
  placement?: "top" | "bottom";
  onDismiss?: () => void;
  demoId?: string;
  className?: string;
}

export function IncidentBanner({
  open,
  title,
  lines,
  placement = "top",
  onDismiss,
  demoId,
  className,
}: IncidentBannerProps) {
  if (!open) return null;

  return (
    <section
      className={[styles.incidentBanner, className].filter(Boolean).join(" ")}
      data-placement={placement}
      data-demo-id={demoId}
      role="status"
      aria-live="polite"
      aria-label={`事故：${sanitizeForStudents(title, "事故")}`}
    >
      <header className={styles.incidentHead}>
        <span className={styles.incidentMark} aria-hidden="true" />
        <span className={styles.incidentTitle}>{sanitizeForStudents(title, "事故")}</span>
        <span className={styles.incidentKicker}>事故后处置</span>
        {onDismiss ? (
          <button
            type="button"
            className={`ix ${styles.incidentClose}`}
            onClick={onDismiss}
            aria-label="收起事故处置提示"
          >
            ×
          </button>
        ) : null}
      </header>
      <ol className={styles.incidentLines}>
        {lines.map((text, index) => (
          <li key={ROW_KEYS[index]} className={styles.incidentLine}>
            <span className={styles.incidentKey}>{ROW_KEYS[index]}</span>
            <span className={styles.incidentText}>{sanitizeForStudents(text)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
