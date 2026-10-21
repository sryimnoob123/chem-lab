import Link from "next/link";
import { SearchBox } from "./search-box";
import type { StudentStatus } from "./types";

export type StatusFilter = StudentStatus | "all";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "done", label: "已完成" },
  { key: "doing", label: "进行中" },
  { key: "not_started", label: "未开始" },
];

export function filterHref(base: string, q: string, status: StatusFilter): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** 工具条：搜索（防抖 300ms 写 URL）+ 分段筛选（链接，服务端筛）+ CSV 导出 */
export function TeacherToolbar({
  q,
  status,
  base = "/teacher",
}: {
  q: string;
  status: StatusFilter;
  base?: string;
}) {
  return (
    <div className="tch-toolbar">
      <SearchBox initialQ={q} status={status} action={base} />

      <nav className="tch-seg" aria-label="按状态筛选">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            className="tch-seg__item"
            href={filterHref(base, q, filter.key)}
            aria-current={status === filter.key ? "true" : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <a className="btn btn--secondary tch-toolbar__export" href="/api/teacher/export">
        导出 CSV
      </a>
    </div>
  );
}
