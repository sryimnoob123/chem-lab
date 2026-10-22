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
/** 完整三行（真事故）；compact 只出后两行（错误演示：画面已经交代了「错在哪」） */
const FULL_ROWS: readonly (0 | 1 | 2)[] = [0, 1, 2];
const COMPACT_ROWS: readonly (0 | 1 | 2)[] = [1, 2];

export type IncidentLevel = "L1" | "L2" | "L3" | "L4";

const LEVEL_TAG: Record<IncidentLevel, string> = {
  L1: "L1 · 提醒",
  L2: "L2 · 扣分",
  L3: "L3 · 严重",
  L4: "L4 · 终止",
};

/** 演示（compact）用的等级标签：只说严重程度，不说「扣分 / 终止」——
 *  演示不动实验状态，写「扣分」等于骗人。 */
const DEMO_LEVEL_TAG: Record<IncidentLevel, string> = {
  L1: "L1 · 提醒",
  L2: "L2 · 数据作废",
  L3: "L3 · 严重事故",
  L4: "L4 · 危险事故",
};

/** 默认自动收起时长（L3/L4 需要学生看清，常驻到手动关闭）。
 *  2026-10-22 用户反馈「每次错误之后没有一个明确的后果」：L1 原来 1.6s、L2 2.4s 就收，
 *  字还没读完条就没了，等于没有后果。现在按「一眼看到 → 能读完」给足停留。 */
const AUTO_HIDE_MS: Record<IncidentLevel, number> = { L1: 3600, L2: 4600, L3: 0, L4: 0 };

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
  /**
   * 紧凑说明：只出「为什么 + 怎么办」两行，且不触发 L4 的终止压暗/重做按钮。
   * 错误演示用它 —— 事故画面播完之后才挂出来（用户 2026-10-23）。
   */
  compact?: boolean;
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
  compact = false,
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
  const showDeduction = level === "L2" && !compact && typeof deduction === "number";
  const levelTag = compact ? DEMO_LEVEL_TAG[level] : LEVEL_TAG[level];

  return (
    <>
      {level === "L4" && !compact ? (
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
        aria-label={`${levelTag}：${safeTitle}`}
      >
        <header className={styles.incidentHead}>
          <span className={styles.incidentLevel}>{levelTag}</span>
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

        {level === "L4" && !compact ? (
          <p className={terminate.incidentTerminate}>本次实验终止</p>
        ) : null}

        {/* L1/L2 是"提醒/扣分"级：只留一行怎么改，避免和结果条、右栏重复；L3/L4 才展开三行。
            错误演示（compact）只出「为什么 + 怎么办」两行 —— 画面已经说明白发生了什么。 */}
        {level === "L1" || level === "L2" ? (
          compact ? (
            <ol className={styles.incidentLines}>
              {COMPACT_ROWS.map((index) => (
                <li key={ROW_KEYS[index]} className={styles.incidentLine}>
                  <span className={styles.incidentKey}>{ROW_KEYS[index]}</span>
                  <span className={styles.incidentText}>{sanitizeForStudents(lines[index])}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.incidentBrief}>
              <span className={styles.incidentKey}>怎么改</span>
              <span className={styles.incidentBriefText}>{sanitizeForStudents(lines[2])}</span>
            </p>
          )
        ) : (
          <ol className={styles.incidentLines}>
            {(compact ? COMPACT_ROWS : FULL_ROWS).map((index) => (
              <li key={ROW_KEYS[index]} className={styles.incidentLine}>
                <span className={styles.incidentKey}>{ROW_KEYS[index]}</span>
                <span className={styles.incidentText}>{sanitizeForStudents(lines[index])}</span>
              </li>
            ))}
          </ol>
        )}

        {level === "L4" && !compact ? (
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
