/**
 * lib/queries/roster-csv.ts —— 教务名单 CSV 解析（纯函数，不查库）
 *
 * 支持：
 * - 表头可有可无（识别「学号/姓名/班级」「studentNo/name/className」）；
 * - 中英文逗号（`,` `，`）、制表符、全角空格；
 * - Windows / Linux 换行；UTF-8 BOM；
 * - 行内多余空白、空行、末尾缺列。
 *
 * 错误用机器可读的 `LINE_<n>:<CODE>` 字符串返回，前端自行映射文案（API 不返回用户文案）。
 */

import { UTF8_BOM } from "./csv";

export interface RosterParseRow {
  studentNo: string;
  name: string;
  className: string;
}

export interface RosterParseResult {
  rows: RosterParseRow[];
  /** 文件内重复学号等被跳过的行数 */
  skipped: number;
  errors: string[];
}

const HEADER_TOKENS = new Set([
  "学号",
  "姓名",
  "班级",
  "学生学号",
  "studentno",
  "student_no",
  "name",
  "classname",
  "class_name",
  "class",
]);

function normalizeCell(value: string): string {
  return value.replace(/\u3000/g, " ").trim();
}

function splitCells(line: string): string[] {
  return line
    .replace(/\uFF0C/g, ",")
    .split(/[,\t]/)
    .map(normalizeCell);
}

function isHeaderRow(cells: string[]): boolean {
  const first = cells[0]?.toLowerCase().replace(/\s+/g, "") ?? "";
  const second = cells[1]?.toLowerCase().replace(/\s+/g, "") ?? "";
  return HEADER_TOKENS.has(first) && (second === "" || HEADER_TOKENS.has(second));
}

/**
 * 解析名单文本。即使个别行非法也不抛错：非法行进 errors，其余照常返回。
 */
export function parseRosterCsv(text: string): RosterParseResult {
  const normalized = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  const lines = normalized.split(/\r?\n/);

  const rows: RosterParseRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let headerConsumed = false;

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    if (rawLine.trim() === "") return;

    const cells = splitCells(rawLine);
    if (!headerConsumed && isHeaderRow(cells)) {
      headerConsumed = true;
      return;
    }
    headerConsumed = true;

    const studentNo = cells[0] ?? "";
    const name = cells[1] ?? "";
    const className = cells[2] ?? "";

    if (!studentNo || !name) {
      errors.push(`LINE_${lineNo}:${!studentNo ? "MISSING_STUDENT_NO" : "MISSING_NAME"}`);
      return;
    }
    if (studentNo.length > 40 || name.length > 40) {
      errors.push(`LINE_${lineNo}:TOO_LONG`);
      return;
    }
    if (seen.has(studentNo)) {
      skipped += 1;
      errors.push(`LINE_${lineNo}:DUPLICATE_STUDENT_NO`);
      return;
    }

    seen.add(studentNo);
    rows.push({ studentNo, name, className });
  });

  return { rows, skipped, errors };
}
