import Link from "next/link";

/** 学生不存在 / 查询失败时的错误态：留在教师端外壳内，给出返回路径 */
export function MissingStudent({ studentNo }: { studentNo: string }) {
  return (
    <div className="tch-state" role="alert">
      <p className="tch-state__title">找不到这名学生</p>
      <p className="tch-state__body">
        学号 <span className="mono">{studentNo}</span> 不在名单里，或该记录已被移出白名单。
        可以回到学情总览重新选择一名学生。
      </p>
      <p className="tch-state__action">
        <Link className="btn btn--secondary" href="/teacher">
          返回学情总览
        </Link>
      </p>
    </div>
  );
}
