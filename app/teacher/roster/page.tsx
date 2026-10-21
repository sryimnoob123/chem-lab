import { listStudents } from "@/components/teacher/queries";
import { PageHead } from "@/components/teacher/page-head";
import { RosterImport } from "@/components/teacher/roster-import";
import { RosterDelete } from "@/components/teacher/roster-delete";
import type { StudentRow } from "@/components/teacher/types";

export const dynamic = "force-dynamic";

async function load(): Promise<{ rows: StudentRow[]; total: number; error: string | null }> {
  try {
    const { rows, total } = await listStudents({ limit: 500 });
    return { rows, total, error: null };
  } catch (err) {
    return { rows: [], total: 0, error: err instanceof Error ? err.message : "未知错误" };
  }
}

export default async function RosterPage() {
  const { rows, total, error } = await load();
  const loggedIn = rows.filter((row) => row.status !== "not_started").length;

  return (
    <>
      <PageHead title="名单管理" sub="名单即白名单，学号即账号，无需密码" />

      <p className="tch-callout">
        <span className="tch-callout__mark" aria-hidden="true">
          ※
        </span>
        只有在名单内的学生能用学号登录；导入后立即生效。删除只收回登录权，已有实验记录与分数不受影响。
      </p>

      <section aria-labelledby="tch-import-title">
        <div className="tch-subhead tch-subhead--ledger">
          <h2 id="tch-import-title">批量导入</h2>
          <span className="tch-subhead__meta">CSV 列顺序：学号, 姓名, 班级</span>
        </div>
        <RosterImport />
      </section>

      <section className="tch-ledger-section" aria-labelledby="tch-roster-title">
        <div className="tch-subhead tch-subhead--ledger">
          <h2 id="tch-roster-title">名单</h2>
        </div>

        {error ? (
          <div className="tch-state" role="alert">
            <p className="tch-state__title">名单读取失败</p>
            <p className="tch-state__body">
              请确认数据库已初始化后重试。原始信息：
              <span className="mono tch-state__code">{error}</span>
            </p>
          </div>
        ) : (
          <table className="ledger tch-roster">
            <caption className="visually-hidden">课程白名单</caption>
            <thead>
              <tr>
                <th scope="col">学号</th>
                <th scope="col">姓名</th>
                <th scope="col" className="tch-hide-md">
                  班级
                </th>
                <th scope="col">登录状态</th>
                <th scope="col" className="is-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tch-ledger__empty">
                    名单为空。用上面的上传或粘贴导入第一批学生。
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const signedIn = row.status !== "not_started";
                  return (
                    <tr key={row.studentNo}>
                      <td className="is-mono tch-nowrap">{row.studentNo}</td>
                      <td>{row.name}</td>
                      <td className="tch-hide-md">
                        <span className="ledger__meta">{row.className || "—"}</span>
                      </td>
                      <td>
                        <span className={`tch-login${signedIn ? " is-on" : ""}`}>
                          <span className="tch-login__dot" aria-hidden="true" />
                          {signedIn ? "已登录" : "未登录"}
                        </span>
                      </td>
                      <td className="is-right">
                        <RosterDelete studentNo={row.studentNo} name={row.name} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        <p className="tch-table-foot">
          共 <span className="mono">{total}</span> 人 · 已登录 <span className="mono">{loggedIn}</span> 人
          {rows.length < total ? ` · 表格展示前 ${rows.length} 条` : ""}
        </p>
      </section>
    </>
  );
}
