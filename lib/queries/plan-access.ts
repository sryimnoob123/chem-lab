/**
 * lib/queries/plan-access.ts —— 「进阶学习 · 拼接实验」的解锁判定（只读）
 *
 * 口径（用户 2026-10-22 演示口径）：**交卷完成过至少一个实验**即可进 /plan。
 * 不看分数——演示现场不能因为 58 分把入口又锁回去。
 *
 * 查库失败一律当作未解锁：入口变成锁定文案，页面照样 200，不冒 500。
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs } from "@/db/schema";

/** 该学号是否存在 status='finished' 的 run（存在即解锁进阶学习）。 */
export async function hasFinishedRun(studentNo: string): Promise<boolean> {
  if (!studentNo) return false;
  try {
    const rows = await db
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.studentNo, studentNo), eq(runs.status, "finished")))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}
