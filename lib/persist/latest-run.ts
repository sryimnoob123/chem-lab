/**
 * 「最近一次交卷的 run」查询 —— 报告页和后测页共用。
 *
 * 口径（原来写在 app/exp/[id]/report/page.tsx 里，抽出来是因为后测页也要落到同一个 run）：
 *   1. 本学生、本实验、status=finished 的最近一条；
 *   2. 没有本人的 → 退到本实验任何人的最近一条（演示 / 教师看别人的记录）；
 *   3. 还没有 → 本实验开始得最晚的一条（哪怕没交卷）。
 * 任何一步出错都返回 null，调用方显示空态，不抛到页面上。
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs } from "@/db/schema";
import { getStudent } from "@/lib/session";

export async function latestRunId(expId: string): Promise<string | null> {
  try {
    const student = await getStudent().catch(() => null);
    const finished = [eq(runs.experimentId, expId), eq(runs.status, "finished")];
    const scoped = student ? [...finished, eq(runs.studentNo, student.studentNo)] : finished;
    let rows = await db
      .select({ id: runs.id })
      .from(runs)
      .where(and(...scoped))
      .orderBy(desc(runs.finishedAt), desc(runs.startedAt))
      .limit(1);
    if (!rows[0] && student) {
      rows = await db
        .select({ id: runs.id })
        .from(runs)
        .where(and(...finished))
        .orderBy(desc(runs.finishedAt), desc(runs.startedAt))
        .limit(1);
    }
    if (!rows[0]) {
      const anyRun = await db
        .select({ id: runs.id })
        .from(runs)
        .where(eq(runs.experimentId, expId))
        .orderBy(desc(runs.startedAt))
        .limit(1);
      return anyRun[0]?.id ?? null;
    }
    return rows[0].id;
  } catch {
    return null;
  }
}
