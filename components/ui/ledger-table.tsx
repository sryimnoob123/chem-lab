import type { ReactNode } from "react";
import styles from "./ledger-table.module.css";

export type LedgerColumn<T> = {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right";
  mono?: boolean;
  hideOnMobile?: boolean;
  cell: (row: T) => ReactNode;
};

export type LedgerTableProps<T> = {
  rows: readonly T[];
  columns: readonly LedgerColumn<T>[];
  rowKey: (row: T) => string;
  activeKey?: string;
  caption?: string;
  emptyText?: string;
  className?: string;
};

/**
 * 台账表。实验列表、报告数据表、教师端学情表共用这一套表格样式。
 * 只负责列定义与渲染，不含任何判定或状态规则。
 */
export function LedgerTable<T>({
  rows,
  columns,
  rowKey,
  activeKey,
  caption = "数据表",
  emptyText = "暂无记录",
  className,
}: LedgerTableProps<T>) {
  const classes = [styles.table, className].filter(Boolean).join(" ");

  return (
    <table className={classes}>
      <caption className={styles.srOnly}>{caption}</caption>
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={[
                column.align === "right" ? styles.right : "",
                column.hideOnMobile ? styles.mobileHide : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className={styles.empty} colSpan={columns.length}>
              {emptyText}
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const key = rowKey(row);
            const active = key === activeKey;

            return (
              <tr key={key} data-active={active ? "true" : undefined}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      column.align === "right" ? styles.right : "",
                      column.mono ? styles.mono : "",
                      column.hideOnMobile ? styles.mobileHide : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
