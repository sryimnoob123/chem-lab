/**
 * 评分卡文案 —— 把 PlanReport 压成「一句话结论 + 最该改的三条」。
 *
 * 产品口径（2026-10-22）：先出评分，再出校验。学生第一眼要知道「我行不行、几分」，
 * 而不是先读十几条红字。所以：
 * - 结论文案只有三种语气（可行 / 可改 / 不可行），每条都带得分；
 * - 「哪里不对」先给最多 3 条（硬约束优先），其余收进「校验明细」由学生自己展开。
 * 纯函数，不碰 DOM、不碰网络。
 */

import type { PlanIssue, PlanReport } from "./rules";

export type VerdictTone = "ok" | "warn" | "block";

export interface PlanVerdict {
  tone: VerdictTone;
  /** 一句话结论：可行/不可行 + 得分 + 一句原因 */
  headline: string;
  /** 「哪里不对」默认展示的条目：硬约束在前，最多 TOP_LIMIT 条 */
  top: PlanIssue[];
  /** 收进校验明细的条数（top 之外还有几条） */
  folded: number;
  /** 规则总条数（结论里说「N 条全过」用） */
  ruleCount: number;
}

const TOP_LIMIT = 3;

export function verdictOf(report: PlanReport, pieceCount: number): PlanVerdict {
  const blocks = report.issues.filter((i) => i.level === "block");
  const warns = report.issues.filter((i) => i.level === "warn");
  const top = [...blocks, ...warns].slice(0, TOP_LIMIT);
  const folded = Math.max(0, report.issues.length - top.length);
  const ruleCount = report.passed.length + report.issues.length;

  if (pieceCount === 0) {
    return {
      tone: "block",
      headline: `不可行 · ${report.score} 分，方案还是空的`,
      top,
      folded,
      ruleCount,
    };
  }

  if (blocks.length > 0) {
    return {
      tone: "block",
      headline: `不可行 · ${report.score} 分，${blocks.length} 条硬约束没过`,
      top,
      folded,
      ruleCount,
    };
  }

  if (warns.length > 0) {
    return {
      tone: "warn",
      headline: `可行 · ${report.score} 分，${warns.length} 处还能再稳一点`,
      top,
      folded,
      ruleCount,
    };
  }

  return {
    tone: "ok",
    headline: `可行 · ${report.score} 分，${ruleCount} 条规则全过`,
    top,
    folded,
    ruleCount,
  };
}
