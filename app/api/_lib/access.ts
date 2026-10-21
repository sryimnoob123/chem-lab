/**
 * app/api/_lib/access.ts —— run 访问上下文（学生本人或教师）
 */

import { isTeacher, requireStudent } from "@/lib/session";
import { assertRunAccess, type RunHeader } from "@/lib/persist/runs";

export interface RunAccess {
  teacher: boolean;
  studentNo?: string;
}

/** 教师 cookie 优先；否则必须学生登录。返回的 header 已做归属校验。 */
export async function accessRun(runId: string): Promise<RunHeader> {
  const teacher = await isTeacher();
  if (teacher) return assertRunAccess(runId, { teacher: true });
  const student = await requireStudent();
  return assertRunAccess(runId, { studentNo: student.studentNo });
}
