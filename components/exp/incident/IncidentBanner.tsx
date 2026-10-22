"use client";

/**
 * IncidentBanner —— E2「事故后」事件条，L1~L4 视觉分级（2026-10-22 用户口径）。
 *
 * 分级（强度递增，均不遮挡右侧动作区与左上任务看板，默认贴舞台下沿）：
 * - L1 提醒：细边条 + 琥珀左侧 3px 竖条，窄条不铺满，1.6s 自动收；
 * - L2 扣分：加图标 + 扣分数值跳动（rAF 数字变化，不引库），2.4s 自动收；
 * - L3 严重：本条转 `--bench-ink-dark` 暗场（只这一块），280ms 轻震；
 * - L4 终止：全屏压暗由 fx 层做（不挡按钮），本条给红框收束 + 「本次实验终止」
 *   主文案 + 「重做本步 / 查看原因」两个动作（≥44px），不自动收。
 *
 * 文案仍必须来自 experiments/<id>/definition.ts 的 feedback；组件不编化学解释。
 * 只动 transform/opacity；reduced-motion 下全部静止但信息不丢。
 */

import { useEffect } from "react";
import styles from "./incident-banner.module.css";
import terminate from "./incident-terminate.module.css";
import { sanitizeForStudents } from "./messages";
import { useCountUp } from "./use-count-up";

const ROW_KEYS = ["错在哪", "为什么", "怎么办"] as const;

export type IncidentLevel = "L1" | "L2" | "L3" | "L4";

const LEVEL_TAG: Record<IncidentLevel, string> = {
  L1: "L1 · 提醒",
  L2: "L2 · 扣分",
  L3: "L3 · 严重",
  L4: "L4 · 终止",
};

/** 默认自动收起时长（L3/L4 需要学生看清，常驻到手动关闭）。 */
const AUTO_HIDE_MS: Record<IncidentLevel, number> = { L1: 1600, L2: 2400, L3: 0, L4: 0 };

export interface IncidentBannerProps {
  open: boolean;
  /** 事故等级：决定边框、图标、暗场、震动与动作；缺省按 L2 处理 */
  level?: IncidentLevel;
  /** 事故名（来自 definition.feedback，如「器皿破裂」） */
  title: string;
  /** 固定三行：错在哪 / 为什么 / 怎么办 */
  lines: readonly [string, string, string];
  /** L2 扣分数值（用于数字跳动）；缺省不显示数字 */
  deduction?: number;
  /** 贴舞台上沿还是下沿；默认下沿（避开左上任务看板与右侧动作区） */
  placement?: "top" | "bottom";
  /** 覆盖默认自动收起时长；0 表示不自动收 */
  autoHideMs?: number;
  onDismiss?: () => void;
  /** L4「重做本步」；缺省退回 onDismiss，保证按钮不空 */
  onRetry?: () => void;
  /** L4「查看原因」；缺省退回 onDismiss，保证按钮不空 */
  onExplain?: () => void;
  demoId?: string;
  className?: string;
}

export function IncidentBanner({
  open,
  level = "L2",
  title,
  lines,
  deduction,
  placement = "bottom",
  autoHideMs,
  onDismiss,
  onRetry,
  onExplain,
  demoId,
  className,
}: IncidentBannerProps) {
  const counted = useCountUp(deduction ?? 0);
  const dismiss = onDismiss ?? (() => undefined);
  // 「查看原因」默认行为：展开现有 demo-feedback-detail 并滚过去；找不到就 no-op。
  const explain =
    onExplain ??
    (() => {
      const detail = document.querySelector<HTMLElement>('[data-demo-id="demo-feedback-detail"]');
      if (!detail) return;
      if (detail instanceof HTMLDetailsElement) detail.open = true;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detail.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });

  // 自动收：L1 1.6s / L2 2.4s；L3/L4 常驻到手动关闭。
  useEffect(() => {
    if (!open || !onDismiss) return;
    const ms = autoHideMs ?? AUTO_HIDE_MS[level];
    if (ms <= 0) return;
    const timer = window.setTimeout(onDismiss, ms);
    return () => window.clearTimeout(timer);
  }, [open, onDismiss, autoHideMs, level, title]);

  if (!open) return null;

  const assertive = level === "L3" || level === "L4";
  const safeTitle = sanitizeForStudents(title, "事故");
  const showDeduction = level === "L2" && typeof deduction === "number";

  return (
    <>
      {level === "L4" ? (
        <>
          {/* 全屏压暗 + 红框：不放 section 内（section 有 translate，会改变 fixed 包含块） */}
          <div className={terminate.terminateDim} aria-hidden="true" />
          <div className={terminate.terminateFrame} aria-hidden="true" />
        </>
      ) : null}
      <section
        className={[styles.incidentBanner, className].filter(Boolean).join(" ")}
        data-level={level}
        data-placement={placement}
        data-demo-id={demoId}
        role={assertive ? "alert" : "status"}
        aria-live={assertive ? "assertive" : "polite"}
        aria-atomic="true"
        aria-label={`${LEVEL_TAG[level]}：${safeTitle}`}
      >
        <header className={styles.incidentHead}>
          <span className={styles.incidentLevel}>{LEVEL_TAG[level]}</span>
          {level === "L1" ? null : (
            // 图标逐级递进（用户 2026-10-22：四级要一眼分清）：
            // L2 感叹号（提醒你扣分了）→ L3 三角警告（危险动作）→ L4 叉（本次实验终止）
            <span className={styles.incidentIcon} data-icon={level} aria-hidden="true">
              {level === "L2" ? "!" : level === "L3" ? "⚠" : "✕"}
            </span>
          )}
          <span className={styles.incidentTitle}>{safeTitle}</span>
          {showDeduction ? (
            <span className={styles.incidentDeduct} aria-label={`扣 ${deduction} 分`}>
              −{counted} 分
            </span>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className={`ix ${styles.incidentClose}`}
              onClick={onDismiss}
              aria-label="收起事故提示"
            >
              ×
            </button>
          ) : null}
        </header>

        {level === "L4" ? (
          <p className={terminate.incidentTerminate}>本次实验终止</p>
        ) : null}

        {/* L1/L2 是"提醒/扣分"级：只留一行怎么改，避免和结果条、右栏重复；L3/L4 才展开三行 */}
        {level === "L1" || level === "L2" ? (
          <p className={styles.incidentBrief}>
            <span className={styles.incidentKey}>怎么改</span>
            <span className={styles.incidentBriefText}>{sanitizeForStudents(lines[2])}</span>
          </p>
        ) : (
          <ol className={styles.incidentLines}>
            {lines.map((text, index) => (
              <li key={ROW_KEYS[index]} className={styles.incidentLine}>
                <span className={styles.incidentKey}>{ROW_KEYS[index]}</span>
                <span className={styles.incidentText}>{sanitizeForStudents(text)}</span>
              </li>
            ))}
          </ol>
        )}

        {level === "L4" ? (
          <div className={terminate.incidentActions}>
            <button
              type="button"
              className={`ix ${terminate.incidentAction}`}
              onClick={onRetry ?? dismiss}
              data-demo-id={demoId ? `${demoId}-retry` : undefined}
            >
              重做本步
            </button>
            <button
              type="button"
              className={`ix ${terminate.incidentAction} ${terminate.incidentActionGhost}`}
              onClick={explain}
              data-demo-id={demoId ? `${demoId}-explain` : undefined}
            >
              查看原因
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
