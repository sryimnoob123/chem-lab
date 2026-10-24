/**
 * POST /api/runs/[id]/quiz —— 写一次前后测作答（前测在 run 创建后补写，后测在交卷后写）
 *
 * 请求：`{ phase: "pre" | "post", answers: { "<题号>": "A" } }`
 * 响应：`{ ok:true, phase, recorded, correct, total, score }`
 *        `score` = 正确率 ×100 **不取整**；交卷时 lib/persist/score.ts 会按同一口径算预习分。
 *
 * 鉴权：学生本人或教师（accessRun）。判分在服务端（lib/persist/quiz.ts）。
 */

import { recordQuizAnswers, type QuizPhase } from "@/lib/persist/quiz";
import { accessRun } from "../../../_lib/access";
import { handleError, json, readJsonBody } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    await accessRun(id);
    const body = await readJsonBody(request);
    const phase = body.phase === "post" ? "post" : body.phase === "pre" ? "pre" : "";
    if (!phase) return json({ ok: false, error: "QUIZ_PHASE_INVALID" }, 400);
    const result = await recordQuizAnswers(id, phase as QuizPhase, body.answers);
    return json({ ok: true, ...result });
  } catch (error) {
    return handleError(error);
  }
}
