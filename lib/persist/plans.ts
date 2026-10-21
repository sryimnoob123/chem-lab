/**
 * lib/persist/plans.ts —— 拼接式方案设计的落库（`plans` 表）
 *
 * 入参形状（Lead 契约）：
 *   { experimentId?, params: { pieces: string[] }, feasible, score,
 *     issues: [{ ruleId, level: "block"|"warn", text }], assessment?, assessmentOffline?, runId? }
 * 本文件只做校验 + 存取，不含评分规则（规则在方案设计轨道）。
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans } from "@/db/schema";
import { badRequest } from "./errors";

export interface PlanIssue {
  ruleId: string;
  level: string;
  text: string;
}

export interface PlanRecord {
  planId: string;
  studentNo: string;
  experimentId: string | null;
  runId: string | null;
  params: { pieces: string[] };
  feasible: boolean;
  score: number;
  issues: PlanIssue[];
  assessment: string | null;
  assessmentOffline: boolean;
  isDemo: boolean;
  createdAt: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) throw badRequest("INVALID_BODY");
  return input as Record<string, unknown>;
}

function readPieces(params: unknown): string[] {
  if (typeof params !== "object" || params === null) throw badRequest("PLAN_PARAMS_REQUIRED");
  const pieces = (params as Record<string, unknown>).pieces;
  if (!Array.isArray(pieces)) throw badRequest("PLAN_PIECES_REQUIRED");
  return pieces
    .filter((piece): piece is string => typeof piece === "string")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
}

function readIssues(input: unknown): PlanIssue[] {
  if (!Array.isArray(input)) return [];
  const issues: PlanIssue[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.ruleId !== "string" || typeof record.text !== "string") continue;
    const level = record.level === "block" || record.level === "warn" ? record.level : "warn";
    issues.push({ ruleId: record.ruleId, level, text: record.text });
  }
  return issues;
}

/** 新建一条方案记录，返回 planId。 */
export async function createPlan(studentNo: string, input: unknown): Promise<string> {
  const body = asRecord(input);
  const pieces = readPieces(body.params);
  const feasible = body.feasible === true;
  const scoreRaw = typeof body.score === "number" && Number.isFinite(body.score) ? body.score : 0;
  const score = Math.max(0, Math.min(100, Math.round(scoreRaw)));

  const experimentId =
    typeof body.experimentId === "string" && body.experimentId.trim()
      ? body.experimentId.trim()
      : null;
  const runId =
    typeof body.runId === "string" && body.runId.trim() ? body.runId.trim() : null;
  if (runId && !UUID_PATTERN.test(runId)) throw badRequest("INVALID_RUN_ID");

  const inserted = await db
    .insert(plans)
    .values({
      studentNo,
      experimentId,
      runId,
      params: { pieces },
      feasible,
      score,
      issues: readIssues(body.issues),
      assessment: typeof body.assessment === "string" ? body.assessment : null,
      assessmentOffline: body.assessmentOffline !== false,
      isDemo: false,
    })
    .returning({ id: plans.id });

  const planId = inserted[0]?.id;
  if (!planId) throw badRequest("PLAN_CREATE_FAILED");
  return planId;
}

/** 读回方案；不存在返回 null。 */
export async function loadPlan(planId: string): Promise<PlanRecord | null> {
  const rows = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const params =
    typeof row.params === "object" && row.params !== null
      ? (row.params as { pieces?: unknown })
      : {};
  const pieces = Array.isArray(params.pieces)
    ? params.pieces.filter((piece): piece is string => typeof piece === "string")
    : [];

  return {
    planId: row.id,
    studentNo: row.studentNo,
    experimentId: row.experimentId,
    runId: row.runId,
    params: { pieces },
    feasible: row.feasible,
    score: row.score,
    issues: readIssues(row.issues),
    assessment: row.assessment,
    assessmentOffline: row.assessmentOffline,
    isDemo: row.isDemo,
    createdAt: row.createdAt,
  };
}
