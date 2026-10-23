/**
 * 评分卡 —— 页面第一眼：总分 + 一句话结论，然后才是「哪里对 / 哪里不对」。
 *
 * 现在的顺序是产品口径（2026-10-22）：先评分、后校验。
 * - 顶部：得分 + 可行/不可行 + 通过/硬约束/待改 三个数；
 * - 中间：哪里对（已满足规则的短名）+ 哪里不对（最多 3 条，硬约束优先，带改法）；
 * - 底部：「展开校验明细」（原生 <details>，默认收起）逐条列出全部问题。
 *
 * 组件只渲染：结论文案在 lib/plan/verdict.ts，短名在 lib/plan/rule-labels.ts。
 */

import type { PlanIssue, PlanReport } from "@/lib/plan/rules";
import { shortLabel } from "@/lib/plan/rule-labels";
import { ThinkingBottle } from "@/components/ui/thinking-bottle";
import { verdictOf } from "@/lib/plan/verdict";
import s from "./plan.module.css";

function IssueItem({ issue }: { issue: PlanIssue }) {
  const block = issue.level === "block";
  return (
    <li className={s.issue} data-level={issue.level}>
      <p className={s.issueText}>
        <span className={block ? s.mark : s.markWarn} aria-hidden="true">
          {block ? "✕" : "!"}
        </span>
        {issue.text}
      </p>
      <p className={s.issueHint}>{issue.hint}</p>
    </li>
  );
}

export function ScorePanel({
  report,
  pieceCount,
  scoreSource = "rule",
  dimensions = [],
  summary = "",
  scoring = false,
}: {
  report: PlanReport;
  pieceCount: number;
  /** 分数来自 AI 评测还是规则校验（用户 2026-10-23：拼接方案由 AI 评分） */
  scoreSource?: "llm" | "rule";
  /** AI 给的分项得分 */
  dimensions?: { name: string; score: number; note?: string }[];
  /** AI 正在评测：分数先按规则显示，标"评测中" */
  scoring?: boolean;
  /** AI 对方案的复述（学生先确认系统看懂了） */
  summary?: string;
}) {
  const verdict = verdictOf(report, pieceCount);

  return (
    <section className={`${s.panel} ${s.score}`} aria-label="方案评分">
      <div className={s.scoreTop}>
        <strong className={s.scoreNum} data-tone={verdict.tone} data-demo-id="demo-design-score">
          {report.score}
          <span className={s.scoreMax}> / 100</span>
        </strong>
        <div className={s.verdictBox}>
          <p className={s.verdict}>{verdict.headline}</p>
          <p className={s.counts}>
            <span className={s.countPass} data-demo-id="demo-design-score-source" aria-live="polite">
              {scoring ? (
                <span className={s.scoring}>
                  <ThinkingBottle size={18} />
                  评测中
                </span>
              ) : scoreSource === "llm" ? (
                "AI 评测"
              ) : (
                "规则校验"
              )}
            </span>
            <span className={s.countPass}>✓ 通过 {report.passed.length}</span>
            {report.blockCount > 0 ? (
              <span className={s.countBlock}>✕ 硬约束 {report.blockCount}</span>
            ) : null}
            {report.warnCount > 0 ? (
              <span className={s.countWarn}>! 待改 {report.warnCount}</span>
            ) : null}
          </p>
        </div>
      </div>

      {summary ? (
        <p className={s.summary} data-demo-id="demo-design-summary">
          <span className={s.summaryTag}>方案</span>
          {summary}
        </p>
      ) : null}

      {dimensions.length > 0 ? (
        <ul className={s.dims} data-demo-id="demo-design-dims">
          {dimensions.map((dim) => (
            <li key={dim.name} className={s.dim}>
              <span className={s.dimName}>{dim.name}</span>
              <span className={s.dimScore} data-tone={dim.score >= 85 ? "ok" : dim.score >= 60 ? "warn" : "bad"}>
                {dim.score}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={s.split}>
        <div>
          <h2 className={s.sideTitle}>哪里对</h2>
          {report.passed.length > 0 ? (
            <ul className={s.passList} data-demo-id="demo-design-passed">
              {report.passed.map((code) => (
                <li key={code} className={s.passChip}>
                  {shortLabel(code)}
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.empty}>还没有一条规则被满足。</p>
          )}
        </div>
        <div>
          <h2 className={s.sideTitle}>哪里不对</h2>
          {verdict.top.length > 0 ? (
            <ul className={s.issueList} data-demo-id="demo-design-top-issues">
              {verdict.top.map((issue) => (
                <IssueItem key={issue.ruleId} issue={issue} />
              ))}
            </ul>
          ) : (
            <p className={s.okLine}>{verdict.ruleCount} 条规则全部通过，按这个方案开做。</p>
          )}
        </div>
      </div>

      {report.issues.length > 0 ? (
        <details className={s.details} data-demo-id="demo-design-issues">
          <summary className={s.summary}>
            <span className={s.chevron} aria-hidden="true">
              ›
            </span>
            <span className={s.labelOpen}>展开校验明细</span>
            <span className={s.labelShut}>收起校验明细</span>
            <span className={s.mono}>共 {report.issues.length} 条</span>
          </summary>
          <div className={s.detailsBody}>
            <ul className={s.issueList}>
              {report.issues.map((issue) => (
                <IssueItem key={issue.ruleId} issue={issue} />
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </section>
  );
}
