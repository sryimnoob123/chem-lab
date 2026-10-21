/**
 * lib/persist/runs.ts —— run 的创建（复用未完成）与访问控制
 *
 * 规则（Lead 契约）：
 * - 同一学生同一实验存在 `in_progress` run 时直接复用，不新建；
 * - 实验没有可玩定义 → 404 `EXPERIMENT_NOT_PLAYABLE`；
 * - 学生只能读自己的 run；教师（chem_teacher cookie）可读全部。
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs } from "@/db/schema";
import { getDefinition } from "@/lib/engine";
import { notFound, PersistError, forbidden } from "./errors";

export interface RunHeader {
  runId: string;
  experimentId: string;
  studentNo: string;
  status: string;
  isDemo: boolean;
  startedAt: Date;
  finishedAt: Date | null;
}

function toHeader(row: typeof runs.$inferSelect): RunHeader {
  return {
    runId: row.id,
    experimentId: row.experimentId,
    studentNo: row.studentNo,
    status: row.status,
    isDemo: row.isDemo,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

/** 读 run 头信息；不存在返回 null。 */
export async function loadRunHeader(runId: string): Promise<RunHeader | null> {
  const rows = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  const row = rows[0];
  return row ? toHeader(row) : null;
}

/** 建 run 或复用该生该实验未完成的那条。 */
export async function createOrReuseRun(input: {
  experimentId: string;
  studentNo: string;
  isDemo?: boolean;
}): Promise<string> {
  const experimentId = input.experimentId.trim();
  if (!experimentId) throw new PersistError(400, "EXPERIMENT_ID_REQUIRED");
  if (!getDefinition(experimentId)) throw new PersistError(404, "EXPERIMENT_NOT_PLAYABLE");

  const isDemo = input.isDemo === true;
  const existing = await db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(
        eq(runs.experimentId, experimentId),
        eq(runs.studentNo, input.studentNo),
        eq(runs.status, "in_progress"),
        eq(runs.isDemo, isDemo),
      ),
    )
    .orderBy(asc(runs.startedAt))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(runs)
    .values({ experimentId, studentNo: input.studentNo, status: "in_progress", isDemo })
    .returning({ id: runs.id });
  const runId = inserted[0]?.id;
  if (!runId) throw new PersistError(500, "RUN_CREATE_FAILED");
  return runId;
}

/** 访问控制：学生本人或教师。 */
export async function assertRunAccess(
  runId: string,
  access: { studentNo?: string; teacher?: boolean },
): Promise<RunHeader> {
  const header = await loadRunHeader(runId);
  if (!header) throw notFound("RUN_NOT_FOUND");
  if (access.teacher) return header;
  if (!access.studentNo || header.studentNo !== access.studentNo) {
    throw forbidden();
  }
  return header;
}
