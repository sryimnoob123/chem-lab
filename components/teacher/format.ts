/**
 * 教师端取数说需要的展示层小工具：时间、分数、百分比、状态文案。
 * 全是纯函数，Server Component 直接调用。
 */

const TZ = "Asia/Shanghai";

/** 固定时区，避免 server / 浏览器时区不一致导致水合差异 */
function parts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/** 顶栏/表头用的「HH:mm」 */
export function formatClock(date: Date): string {
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

/** 表格里的「10/20 14:24」 */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  const p = parts(date);
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

/** 「32 分钟前 / 3 小时前 / 2 天前」；超过 7 天直接给日期 */
export function formatRelative(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "—";
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return "刚刚";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days} 天前`;
  return formatDateTime(date);
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  return String(score);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function statusText(status: "done" | "doing" | "not_started"): string {
  if (status === "done") return "已完成";
  if (status === "doing") return "进行中";
  return "未开始";
}

/** 0~100 → 进度条 / 状态色语义（不含任何 UI 语义色越界） */
export function statusTone(status: "done" | "doing" | "not_started"): "done" | "doing" | "idle" {
  if (status === "done") return "done";
  if (status === "doing") return "doing";
  return "idle";
}
