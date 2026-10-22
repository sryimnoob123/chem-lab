import Link from "next/link";
import type { StudentRow } from "./types";
import {
  clampPercent,
  formatPercent,
  formatRelative,
  formatScore,
  statusText,
  statusTone,
} from "./format";

/** 学生台账表：细线 + 等宽数字 + 行为状态（不做彩色胶囊） */
export function StudentTable({ rows }: { rows: StudentRow[] }) {
  return (
    <table className="ledger tch-ledger">
      <caption className="visually-hidden">学生学情台账</caption>
      <thead>
        <tr>
          <th scope="col">学号</th>
          <th scope="col">姓名</th>
          <th scope="col" className="tch-hide-md">
            班级
          </th>
          <th scope="col">当前环节</th>
          <th scope="col" className="is-right">
            完成度
          </th>
          <th scope="col" className="tch-hide-md">
            最近活跃
          </th>
          <th scope="col" className="is-right">
            总分
          </th>
          <th scope="col" className="is-right">
            事故
          </th>
          <th scope="col" className="is-right">
            详情
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const percent = clampPercent(row.progress);
          const tone = statusTone(row.status);
          return (
            <tr key={row.studentNo}>
              <td className="is-mono tch-nowrap">{row.studentNo}</td>
              <td>
                <span className="tch-name">{row.name}</span>
              </td>
              <td className="tch-hide-md">
                <span className="ledger__meta">{row.className || "—"}</span>
              </td>
              <td>
                {/* 2026-10-23：原来状态下面还压一条进度条，和右侧「完成度」列是同一个数据，
                    两条并排读起来像两套口径。只留状态文字，比例交给完成度列。 */}
                <span className={`tch-status tch-status--${tone}`}>{statusText(row.status)}</span>
              </td>
              <td className="is-right is-mono">{formatPercent(percent, 0)}</td>
              <td className="tch-hide-md">
                <span className="ledger__meta">{formatRelative(row.lastActiveAt)}</span>
              </td>
              <td className="is-right is-mono">{formatScore(row.totalScore)}</td>
              <td className="is-right is-mono">{row.incidentCount > 0 ? row.incidentCount : "—"}</td>
              <td className="is-right">
                <Link className="tch-detail-link" href={`/teacher/student/${row.studentNo}`}>
                  详情
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
