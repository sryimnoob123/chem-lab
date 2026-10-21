/**
 * lib/queries/csv.ts —— CSV 序列化（导出用，纯函数）
 *
 * 约定：
 * - 行尾 CRLF（Excel 友好），首部 UTF-8 BOM（Excel 双击直开不乱码）；
 * - 含逗号 / 双引号 / 换行 / 制表符 的单元格用双引号包裹，内部双引号翻倍；
 * - null / undefined 输出空串。
 */

export const UTF8_BOM = "\uFEFF";

export type CsvValue = string | number | boolean | null | undefined;

const NEEDS_QUOTE = /[",\r\n\t]/;

/** 单个单元格转义。 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  if (!NEEDS_QUOTE.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/** 二维数组 → 带 BOM 的 CSV 文本。 */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvValue>>): string {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return `${UTF8_BOM}${body}${body ? "\r\n" : ""}`;
}

/** 本地时间格式（服务端时区），导出用：`2026-10-20 18:30`。 */
export function formatDateTime(value: Date | null | undefined): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
    `${pad(value.getHours())}:${pad(value.getMinutes())}`
  );
}

/** 文件名里的日期戳：`20261020`。 */
export function fileDateStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}
