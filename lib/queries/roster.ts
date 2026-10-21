/**
 * lib/queries/roster.ts —— 名单管理（教师端）
 *
 * - 列表：分页 + `?q=` 模糊搜索 + 「已登录过」计数；
 * - 导入：CSV 文本解析（见 roster-csv.ts）后 upsert，重复学号覆盖姓名/班级；
 * - 删除：只删 `students` 白名单行，历史 runs/timeline 保留（学情不丢）。
 */

import { eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs, students } from "@/db/schema";
import { parseRosterCsv } from "./roster-csv";
import { demoFilter } from "./teacher-shared";

export interface RosterRow {
  studentNo: string;
  name: string;
  className: string;
  createdAt: Date;
  /** 是否进过实验（有非演示 run） */
  hasRun: boolean;
}

export interface RosterListResult {
  rows: RosterRow[];
  total: number;
  /** 登录过（有非演示 run）的学生数 */
  loggedIn: number;
}

export interface RosterListOptions {
  q?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 100;

function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, " ").trim();
}

function searchFilter(q: string) {
  if (!q) return undefined;
  return or(
    ilike(students.studentNo, `%${q}%`),
    ilike(students.name, `%${q}%`),
    ilike(students.className, `%${q}%`),
  );
}

/** 名单分页列表。 */
export async function listRoster(opts: RosterListOptions = {}): Promise<RosterListResult> {
  const q = escapeLike(opts.q ?? "");
  const where = searchFilter(q);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(students)
    .where(where);

  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 500) : DEFAULT_LIMIT;
  const offset = opts.offset && opts.offset > 0 ? Math.trunc(opts.offset) : 0;

  const rows = await db
    .select({
      studentNo: students.studentNo,
      name: students.name,
      className: students.className,
      createdAt: students.createdAt,
    })
    .from(students)
    .where(where)
    .orderBy(students.studentNo)
    .limit(limit)
    .offset(offset);

  const runOwners = await db
    .selectDistinct({ studentNo: runs.studentNo })
    .from(runs)
    .where(demoFilter(false));
  const active = new Set(runOwners.map((row) => row.studentNo));

  return {
    rows: rows.map((row) => ({
      studentNo: row.studentNo,
      name: row.name,
      className: row.className,
      createdAt: row.createdAt,
      hasRun: active.has(row.studentNo),
    })),
    total: Number(totalRow?.count ?? 0),
    loggedIn: active.size,
  };
}

export interface RosterImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const IMPORT_CHUNK = 200;

/** 名单导入：解析 → 分块 upsert。 */
export async function importRoster(text: string): Promise<RosterImportResult> {
  const parsed = parseRosterCsv(text);
  let imported = 0;

  for (let start = 0; start < parsed.rows.length; start += IMPORT_CHUNK) {
    const chunk = parsed.rows.slice(start, start + IMPORT_CHUNK);
    await db
      .insert(students)
      .values(chunk)
      .onConflictDoUpdate({
        target: students.studentNo,
        set: {
          name: sql`excluded.name`,
          className: sql`excluded.class_name`,
        },
      });
    imported += chunk.length;
  }

  return { imported, skipped: parsed.skipped, errors: parsed.errors };
}

/** 删除白名单条目；返回是否真的删掉了。 */
export async function deleteRosterStudent(studentNo: string): Promise<boolean> {
  const no = studentNo.trim();
  if (!no) return false;
  const deleted = await db
    .delete(students)
    .where(eq(students.studentNo, no))
    .returning({ studentNo: students.studentNo });
  return deleted.length > 0;
}

/** 批量查若干学号是否在名单里（导入后校验用）。 */
export async function findMissingStudents(studentNos: string[]): Promise<string[]> {
  if (studentNos.length === 0) return [];
  const rows = await db
    .select({ studentNo: students.studentNo })
    .from(students)
    .where(inArray(students.studentNo, studentNos));
  const found = new Set(rows.map((row) => row.studentNo));
  return studentNos.filter((no) => !found.has(no));
}
