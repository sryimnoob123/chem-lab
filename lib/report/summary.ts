/**
 * 实验总结（一眼能读懂的那一句话 + 三个关键指标）。
 *
 * 用户 2026-10-21：「做完实验之后可以有一个总结，整个实验的一个总结表现」。
 * 报告页已经有三段分和雷达图，但那是"细账"；这里给的是**先看结论**的那一层，
 * 保证学生交卷后第一眼就知道"我这次做得怎么样"。
 *
 * 纯函数，便于单测；文案集中在这里，不散进 JSX。
 */

export type SummaryTone = "great" | "ok" | "needs-work";

export interface RunSummaryInput {
  /** 总分 0~100 */
  total: number;
  /** 事故次数（L1 以上） */
  incidentCount: number;
  /** 已走到的步数（含重做） */
  coveredSteps: number;
  /** 本实验总步数 */
  totalSteps: number;
  /** 用时（分钟） */
  minutes: number;
}

export interface RunSummary {
  headline: string;
  tone: SummaryTone;
  /** 三个关键指标，按"最该看的"排序 */
  facts: Array<{ label: string; value: string; tone?: "warn" }>;
}

export function buildRunSummary(input: RunSummaryInput): RunSummary {
  const { total, incidentCount, coveredSteps, totalSteps, minutes } = input;
  const coverage = totalSteps > 0 ? coveredSteps / totalSteps : 0;

  const tone: SummaryTone =
    total >= 85 && incidentCount === 0
      ? "great"
      : total < 60 || coverage < 0.6
        ? "needs-work"
        : "ok";

  const headline =
    tone === "great"
      ? "流程完整、读数规范，几乎没有多余动作。"
      : tone === "needs-work"
        ? "步骤有遗漏，建议对照实验步骤再走一遍。"
        : "基本完成，个别步骤还可以更稳。";

  const facts: RunSummary["facts"] = [
    {
      label: "完成步骤",
      value: `${Math.min(coveredSteps, totalSteps)}/${totalSteps}`,
    },
    {
      label: "事故",
      value: incidentCount > 0 ? `${incidentCount} 次` : "无",
      tone: incidentCount > 0 ? "warn" : undefined,
    },
    {
      label: "用时",
      value: minutes > 0 ? `${minutes} 分钟` : "—",
    },
  ];

  return { headline, tone, facts };
}

/** 用时（分钟）：结束时间缺失时返回 0，避免报告页出现负数或 NaN。 */
export function minutesBetween(start: Date | null | undefined, end: Date | null | undefined): number {
  if (!start || !end) return 0;
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.max(1, Math.round(diff / 60000));
}
