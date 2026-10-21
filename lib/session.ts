/**
 * lib/session.ts —— 学生 / 教师会话（白名单登录，无密码）
 *
 * 学生：学号 + 姓名 → 校验 `students` 表（教务名单）→ 种签名 cookie `chem_sid`。
 * 教师：口令 → 种签名 cookie `chem_teacher`。
 *
 * 签名与 cookie 常量在 lib/persist/session-token.ts（纯函数，可单测）。
 * 本文件只做「读 cookie / 写 cookie / 查库」三件事，不夹业务规则。
 */

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { students } from "@/db/schema";
import {
  SESSION_COOKIE,
  TEACHER_COOKIE,
  cookieOptions,
  signSessionValue,
  signTeacherValue,
  verifySessionValue,
  verifyTeacherValue,
} from "@/lib/persist/session-token";
import { AuthError } from "@/lib/persist/errors";

export interface Student {
  studentNo: string;
  name: string;
  className: string;
}

/** 鉴权失败。定义在 lib/persist/errors.ts，这里 re-export 保持对外入口不变。 */
export { AuthError };

const DEFAULT_TEACHER_PASSCODE = "2026";

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

/** 按学号查白名单，并校验姓名一致（教务名单即身份凭据）。 */
async function findRosterStudent(studentNo: string, name: string): Promise<Student | null> {
  const rows = await db
    .select({ studentNo: students.studentNo, name: students.name, className: students.className })
    .from(students)
    .where(eq(students.studentNo, studentNo))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (normalize(row.name) !== normalize(name)) return null;
  return { studentNo: row.studentNo, name: row.name, className: row.className };
}

/** 学生登录：校验白名单通过则种 cookie，返回学生信息；否则 null（路由回 403 NOT_IN_ROSTER）。 */
export async function signIn(studentNo: string, name: string): Promise<Student | null> {
  const no = normalize(studentNo);
  const studentName = name.trim();
  if (!no || !studentName) return null;

  const student = await findRosterStudent(no, studentName);
  if (!student) return null;

  const store = await cookies();
  store.set(SESSION_COOKIE, signSessionValue(student.studentNo), cookieOptions());
  return student;
}

/** 当前登录学生；未登录 / cookie 被篡改 / 已从名单移除都返回 null。 */
export async function getStudent(): Promise<Student | null> {
  const store = await cookies();
  const studentNo = verifySessionValue(store.get(SESSION_COOKIE)?.value);
  if (!studentNo) return null;

  const rows = await db
    .select({ studentNo: students.studentNo, name: students.name, className: students.className })
    .from(students)
    .where(eq(students.studentNo, studentNo))
    .limit(1);
  const row = rows[0];
  return row ? { studentNo: row.studentNo, name: row.name, className: row.className } : null;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** 必须登录；未登录抛 AuthError(401)。 */
export async function requireStudent(): Promise<Student> {
  const student = await getStudent();
  if (!student) throw new AuthError(401, "UNAUTHORIZED");
  return student;
}

/** 教师口令解锁；成功种教师 cookie。口令用环境变量覆盖，默认 2026。 */
export async function unlockTeacher(passcode: string): Promise<boolean> {
  const expected = process.env.TEACHER_PASSCODE?.trim() || DEFAULT_TEACHER_PASSCODE;
  if (typeof passcode !== "string" || passcode.trim() !== expected) return false;

  const store = await cookies();
  store.set(TEACHER_COOKIE, signTeacherValue(), cookieOptions());
  return true;
}

export async function isTeacher(): Promise<boolean> {
  const store = await cookies();
  return verifyTeacherValue(store.get(TEACHER_COOKIE)?.value);
}

/** 必须教师；未解锁抛 AuthError(403)。 */
export async function requireTeacher(): Promise<void> {
  if (!(await isTeacher())) throw new AuthError(403, "FORBIDDEN");
}

/** 教师退出（页面「锁定」按钮用；不是登录态也能安全调用）。 */
export async function lockTeacher(): Promise<void> {
  const store = await cookies();
  store.delete(TEACHER_COOKIE);
}
