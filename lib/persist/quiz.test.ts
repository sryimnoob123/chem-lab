/**
 * lib/persist/quiz.test.ts —— 前后测作答写路径（quiz_answers）与预习分结算
 *
 * 锁定的口径（2026-10-24 前测分数落库）：
 * - 判分在服务端：客户端传什么 correct 都不采信，只按课程数据的 answer 比对；
 * - 预习分 = phase="pre" 的正确率 ×100，**不取整**（3 题错 1 → 66.67），落库取整（67）；
 * - 总分 = 0.1×预习 + 0.4×操作 + 0.5×报告，取整；
 * - 幂等：同一 run 同一 phase 重复写只保留最后一版；
 * - 没有前测答案 → 预习分 0（历史 run 不受影响）。
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// 必须在 import lib/db 之前指向临时目录（PGlite 独占该目录），绝不碰 ./.pgdata
process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "chemlab-quiz-"));
(globalThis as Record<string, unknown>).__pg = undefined;

const { setupTestDb } = await import("./test-support");
const { db } = await import("@/lib/db");
const schema = await import("@/db/schema");
const { appendRunEvents } = await import("./events");
const { finishRun } = await import("./report");
const { gradeQuiz, recordQuizAnswers } = await import("./quiz");
const { eq } = await import("drizzle-orm");
const { getCurriculum } = await import("@/lib/pedagogy/curriculum");

let handle: Awaited<ReturnType<typeof setupTestDb>> | null = null;

beforeAll(async () => {
  handle = await setupTestDb();
}, 120_000);

afterAll(async () => {
  await handle?.cleanup();
});

const EXP = "exp09";
const WEIGH = { type: "weigh", choiceId: "step1-weigh", competency: "A1" };

const curriculum = getCurriculum(EXP);
if (!curriculum) throw new Error("exp09 课程数据缺失");
const PRE = curriculum.pre;

function answerSet(
  questions: ReadonlyArray<typeof PRE[number]>,
  correct: boolean,
  wrongCount = 0,
): Record<string, string> {
  const out: Record<string, string> = {};
  questions.forEach((question, index) => {
    const wrongKey = question.options.find((option) => option.key !== question.answer)?.key;
    out[question.id] = correct || index >= wrongCount ? question.answer : (wrongKey ?? "Z");
  });
  return out;
}

function answersOf(correct: boolean, wrongCount = 0): Record<string, string> {
  return answerSet(PRE, correct, wrongCount);
}

let studentSeq = 0;

async function seedRun(): Promise<string> {
  studentSeq += 1;
  const studentNo = `2024${String(studentSeq).padStart(4, "0")}`;
  await db.insert(schema.students).values({ studentNo, name: `学生${studentSeq}`, className: "化学2401" });
  const rows = await db
    .insert(schema.runs)
    .values({ experimentId: EXP, studentNo })
    .returning({ id: schema.runs.id });
  const runId = rows[0]?.id;
  if (!runId) throw new Error("failed to create run");
  return runId;
}

async function quizRowsOf(runId: string) {
  return db.select().from(schema.quizAnswers).where(eq(schema.quizAnswers.runId, runId));
}

describe("gradeQuiz：服务端判分", () => {
  it("3 题全对 → 100", () => {
    const graded = gradeQuiz(EXP, "pre", answersOf(true));
    expect(graded.total).toBe(PRE.length);
    expect(graded.correct).toBe(PRE.length);
    expect(graded.score).toBe(100);
  });

  it("错 1 题（3 题）→ 66.67，不取整", () => {
    const graded = gradeQuiz(EXP, "pre", answersOf(false, 1));
    expect(graded.correct).toBe(PRE.length - 1);
    expect(graded.score).toBeCloseTo(66.666, 2);
    expect(Math.round(graded.score)).toBe(67);
  });

  it("忽略不属于本实验本阶段的题号", () => {
    const graded = gradeQuiz(EXP, "pre", { ...answersOf(true), "exp01-pre-1": "A", 乱码: "B" });
    expect(graded.total).toBe(PRE.length);
    expect(graded.score).toBe(100);
  });

  it("非法 answers 抛 400", () => {
    expect(() => gradeQuiz(EXP, "pre", null)).toThrowError(/QUIZ_ANSWERS_REQUIRED/);
    expect(() => gradeQuiz("exp99", "pre", answersOf(true))).toThrowError(/QUIZ_NOT_AVAILABLE/);
  });
});

describe("recordQuizAnswers：落库与幂等", () => {
  it("写 3 行，correct 由服务端算", async () => {
    const runId = await seedRun();
    const result = await recordQuizAnswers(runId, "pre", answersOf(true));
    expect(result.recorded).toBe(PRE.length);
    const rows = await quizRowsOf(runId);
    expect(rows).toHaveLength(PRE.length);
    expect(rows.every((row) => row.phase === "pre" && row.correct)).toBe(true);
  });

  it("重复写同一 phase 只保留最后一版（重做前测）", async () => {
    const runId = await seedRun();
    await recordQuizAnswers(runId, "pre", answersOf(true));
    const second = await recordQuizAnswers(runId, "pre", answersOf(false, 1));
    const rows = await quizRowsOf(runId);
    expect(rows).toHaveLength(PRE.length);
    expect(rows.filter((row) => row.correct)).toHaveLength(PRE.length - 1);
    expect(Math.round(second.score)).toBe(67);
  });

  it("pre 与 post 互不覆盖", async () => {
    const runId = await seedRun();
    await recordQuizAnswers(runId, "pre", answersOf(true));
    await recordQuizAnswers(runId, "post", answerSet(curriculum.post, true));
    const rows = await quizRowsOf(runId);
    expect(rows.filter((row) => row.phase === "pre")).toHaveLength(PRE.length);
    expect(rows.filter((row) => row.phase === "post")).toHaveLength(curriculum.post.length);
  });

  it("run 不存在 → 404", async () => {
    await expect(recordQuizAnswers("00000000-0000-0000-0000-000000000000", "pre", answersOf(true))).rejects.toThrowError(
      /RUN_NOT_FOUND/,
    );
  });
});

describe("finishRun：预习分进总分", () => {
  it("前测 3 题全对 → 预习 100，总分 = 0.1×100 + 0.4×操作 + 0.5×报告", async () => {
    const runId = await seedRun();
    await appendRunEvents(runId, [WEIGH]);
    await recordQuizAnswers(runId, "pre", answersOf(true));

    const bundle = await finishRun(runId);
    const { preview, operation, report, total } = bundle.scores;
    expect(preview).toBe(100);
    expect(total).toBe(
      Math.round(0.1 * 100 + 0.4 * (operation ?? 0) + 0.5 * (report ?? 0)),
    );
  });

  it("前测错 1 题 → 预习 67，总分同步降 3.3 分左右", async () => {
    const runId = await seedRun();
    await appendRunEvents(runId, [WEIGH]);
    await recordQuizAnswers(runId, "pre", answersOf(false, 1));

    const bundle = await finishRun(runId);
    const { preview, operation, report, total } = bundle.scores;
    expect(preview).toBe(67);
    expect(total).toBe(
      Math.round(0.1 * 67 + 0.4 * (operation ?? 0) + 0.5 * (report ?? 0)),
    );
  });

  it("没有任何前测答案 → 预习 0（历史 run 不受影响）", async () => {
    const runId = await seedRun();
    await appendRunEvents(runId, [WEIGH]);
    const bundle = await finishRun(runId);
    expect(bundle.scores.preview).toBe(0);
  });
});
