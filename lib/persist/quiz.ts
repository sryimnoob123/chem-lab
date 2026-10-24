/**
 * lib/persist/quiz.ts —— 前后测作答的**唯一写路径**（quiz_answers 表）
 *
 * 背景（2026-10-24）：`quiz_answers` 之前只有读路径（lib/persist/report.ts 的
 * loadRunBundle + lib/persist/score.ts 的正确率），前测答案只写进 localStorage、
 * 从不落库，于是预习分恒 0（真实学生上限 90），而 ?auto=1 演示靠 override 反而更高。
 *
 * 归属方案：前测提交发生在 run 创建之前，而 `quiz_answers.run_id` 是 notNull
 * （db/schema.ts），不加迁移、不写空 run_id —— 改为「run 创建后补写」：
 *   门禁提交 → localStorage 存答案（lib/pedagogy/quiz-store.ts）
 *   → 操作台拿到 runId 后 POST /api/runs/[id]/quiz 补写（交卷前再补一次，覆盖重做后的答案）。
 *
 * 判分在服务端做（curriculum 里的 answer 只用于比对，不采信客户端传来的 correct）。
 * 幂等：同一 run 同一 phase 先删后插，重复提交/重做前测都是「覆盖成本次答案」。
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quizAnswers, runs } from "@/db/schema";
import { getCurriculum } from "@/lib/pedagogy/curriculum";
import { badRequest, notFound } from "./errors";

export type QuizPhase = "pre" | "post";

export interface GradedQuizRow {
  questionId: string;
  answer: string;
  correct: boolean;
}

export interface GradedQuiz {
  phase: QuizPhase;
  rows: GradedQuizRow[];
  total: number;
  correct: number;
  /** 正确率 ×100，**不取整**（与 lib/persist/score.ts 的 quizScore 同口径，66.666… 就在这里） */
  score: number;
}

export interface RecordQuizResult extends GradedQuiz {
  runId: string;
  /** 实际写进库的行数（= rows.length） */
  recorded: number;
}

/** 把原始 answers 收敛成 `{ 题号: 选项 }`；非法输入抛 400。 */
function parseAnswers(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw badRequest("QUIZ_ANSWERS_REQUIRED");
  }
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string" || !value.trim()) continue;
    clean[key] = value.trim();
  }
  return clean;
}

/** 按课程数据判分；未知实验/该阶段没有题 → 400。 */
export function gradeQuiz(
  experimentId: string,
  phase: QuizPhase,
  rawAnswers: unknown,
): GradedQuiz {
  const curriculum = getCurriculum(experimentId);
  if (!curriculum) throw badRequest("QUIZ_NOT_AVAILABLE");
  const questions = phase === "pre" ? curriculum.pre : curriculum.post;
  if (!questions.length) throw badRequest("QUIZ_NOT_AVAILABLE");

  const answers = parseAnswers(rawAnswers);
  const rows: GradedQuizRow[] = questions
    // 只认本实验本阶段的题号；多余键忽略（前端可能带着上一次的草稿）
    .filter((question) => answers[question.id] !== undefined)
    .map((question) => ({
      questionId: question.id,
      answer: answers[question.id],
      correct: answers[question.id] === question.answer,
    }));

  const correct = rows.filter((row) => row.correct).length;
  return {
    phase,
    rows,
    total: rows.length,
    correct,
    score: rows.length === 0 ? 0 : (correct / rows.length) * 100,
  };
}

/**
 * 写一次作答。已交卷的 run 也允许写 post（后测页在交卷之后才出现）——
 * 但已冻结的 runs.score_* 不会被这次写入改写，交卷口径仍是「交卷时结算」。
 */
export async function recordQuizAnswers(
  runId: string,
  phase: QuizPhase,
  rawAnswers: unknown,
): Promise<RecordQuizResult> {
  if (phase !== "pre" && phase !== "post") throw badRequest("QUIZ_PHASE_INVALID");

  const runRows = await db
    .select({ id: runs.id, experimentId: runs.experimentId })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  const run = runRows[0];
  if (!run) throw notFound("RUN_NOT_FOUND");

  const graded = gradeQuiz(run.experimentId, phase, rawAnswers);

  // 幂等覆盖：重做前测 / 重复提交都只保留最后一版答案
  await db
    .delete(quizAnswers)
    .where(and(eq(quizAnswers.runId, runId), eq(quizAnswers.phase, phase)));

  if (graded.rows.length > 0) {
    await db.insert(quizAnswers).values(
      graded.rows.map((row) => ({
        runId,
        phase,
        questionId: row.questionId,
        answer: row.answer,
        correct: row.correct,
      })),
    );
  }

  return { ...graded, runId, recorded: graded.rows.length };
}
