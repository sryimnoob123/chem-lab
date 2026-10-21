/**
 * BOPPPS 教学六段的课程数据契约。
 * 数据一律取自 docs/实验库/expNN.md（导入用 §3 原理原文，目标用 §2，测验用 §9），
 * 不在代码里新编化学解释。
 *
 * 六段映射：
 *   B 导入 bridgeIn      ← §3 原理（≤80 字摘录）
 *   O 目标 objectives    ← §2 实验目的（三维，带编码）
 *   P 前测 pre           ← §9 [前测N]
 *   P 参与式 participatory ← 现有操作台（experiments/expNN/definition.ts），不在本文件
 *   P 后测 post          ← §9 [后测N]
 *   S 总结 summary       ← §10 判分口径 + §11 评估要点（≤80 字摘录）
 */

export type CompetencyCode = "K1" | "K2" | "A1" | "S1" | "S2";

export type CurriculumOption = {
  /** A / B / C / D */
  key: string;
  text: string;
};

export type CurriculumQuestion = {
  /** exp01-pre-1 / exp01-post-2 */
  id: string;
  stage: "pre" | "post" | "transfer";
  competency: CompetencyCode;
  stem: string;
  options: CurriculumOption[];
  /** 正确选项的 key */
  answer: string;
  /** 解析原文（可多行，用 \n 连接） */
  explanation: string;
};

export type CurriculumObjective = {
  competency: CompetencyCode;
  text: string;
};

export type Curriculum = {
  id: string;
  /** B 导入：一段情境/现象，1~3 句 */
  bridgeIn: string;
  /** O 目标 */
  objectives: CurriculumObjective[];
  /** P 前测（3 题，全对才解锁操作台） */
  pre: CurriculumQuestion[];
  /** P 后测（3 题） */
  post: CurriculumQuestion[];
  /** 迁移题（可选，exp01 / exp09 有） */
  transfer: CurriculumQuestion[];
  /** S 总结：一句话收束 + 自评提示 */
  summary: string;
};

/** 前测通过线：3 题全对 */
export const PRE_PASS_RATIO = 1;

/** 后测按答对题数折算，满分 100 */
export function scoreStage(questions: readonly CurriculumQuestion[], picked: Record<string, string>): number {
  if (!questions.length) return 0;
  const hit = questions.filter((q) => picked[q.id] === q.answer).length;
  return Math.round((hit / questions.length) * 100);
}
