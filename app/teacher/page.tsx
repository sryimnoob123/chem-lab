import Link from "next/link";
import { getIncidentSummary, getOverview, listStudents } from "@/components/teacher/queries";
import { PageHead } from "@/components/teacher/page-head";
import { TeacherExportButton } from "@/components/teacher/export-button";
import { StatCards } from "@/components/teacher/stat-cards";
import { IncidentBar } from "@/components/teacher/incident-bar";
import { CompetencyRadar } from "@/components/teacher/radar-chart";
import { loadClassRadarSeries } from "@/components/teacher/radar-query";
import { TeacherToolbar, type StatusFilter } from "@/components/teacher/toolbar";
import { StudentTable } from "@/components/teacher/student-table";
import { formatClock } from "@/components/teacher/format";
import { demoIncidents, demoOverview, demoRadar, demoStudents } from "@/components/teacher/demo-data";
import type { RadarSeries } from "@/components/teacher/radar-data";
import type {
  IncidentStat,
  OverviewStat,
  StudentListResult,
  StudentStatus,
} from "@/components/teacher/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string }>;

const STATUS_VALUES: readonly string[] = ["done", "doing", "not_started"];

function parseStatus(raw: string | undefined): StatusFilter {
  return raw && STATUS_VALUES.includes(raw) ? (raw as StudentStatus) : "all";
}

type OverviewData = {
  overview: OverviewStat;
  incidents: IncidentStat[];
  students: StudentListResult;
  radar: RadarSeries;
};

async function load(
  q: string,
  status: StatusFilter,
): Promise<{ data: OverviewData | null; error: string | null }> {
  try {
    const [overview, incidents, students, radar] = await Promise.all([
      getOverview(),
      getIncidentSummary(),
      listStudents({ q: q || undefined, status: status === "all" ? undefined : status, limit: 200 }),
      loadClassRadarSeries(),
    ]);
    // 演示口径（用户 2026-10-22）：教师后台不做登录、不依赖数据库，空库也要能看到完整界面。
    // 有真实数据就走真实数据；空库（或库没起）落演示数据，永远不出现"全是 0"的页面。
    if (overview.total === 0) return { data: demoData(q, status), error: null };
    return { data: { overview, incidents, students, radar }, error: null };
  } catch {
    // 演示兜底（用户 2026-10-22：教师后台不做登录、不依赖数据库，直接放一组数据看界面）。
    // 库正常时走真实数据，库没起也永远有完整页面可演示。
    return { data: demoData(q, status), error: null };
  }
}

/** 演示数据 + 与真实查询一致的筛选口径（搜索/状态过滤照常生效）。 */
function demoData(q: string, status: StatusFilter): OverviewData {
  const all = demoStudents();
  const rows = all.rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (q === "" || r.studentNo.includes(q) || r.name.includes(q)),
  );
  return {
    overview: demoOverview(),
    incidents: [...demoIncidents()],
    students: { rows, total: rows.length },
    radar: demoRadar(),
  };
}

export default async function TeacherOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = parseStatus(params.status);
  const { data, error } = await load(q, status);
  const filtered = q !== "" || status !== "all";

  return (
    <>
      <PageHead title="学情总览" sub="03600004 · 新能源与智能制造学院 · 2 个班">
        <span className="tch-updated">
          数据更新于 <span className="mono">{formatClock(new Date())}</span>
        </span>
        <TeacherExportButton />
        <Link className="btn btn--primary" href="/exp/exp01?teach=1" data-demo-id="teacher-demo-open">
          课堂演示
        </Link>
        <a className="tch-refresh" href="/teacher">
          刷新数据
        </a>
      </PageHead>

      {error ? (
        <div className="tch-state" role="alert">
          <p className="tch-state__title">学情数据读取失败</p>
          <p className="tch-state__body">
            查询没有返回结果，请确认数据库已初始化后重试。原始信息：
            <span className="mono tch-state__code">{error}</span>
          </p>
        </div>
      ) : data ? (
        <>
          <StatCards stat={data.overview} />
          <IncidentBar stats={data.incidents} />

          <section className="tch-ledger-section" aria-labelledby="tch-radar-title">
            <div className="tch-subhead tch-subhead--ledger">
              <h2 id="tch-radar-title">能力点雷达</h2>
              <span className="tch-subhead__meta">五维均分 0~100</span>
            </div>
            <CompetencyRadar
              series={data.radar}
              scope="class"
              title="班级能力点雷达"
            />
          </section>

          <section className="tch-ledger-section" aria-labelledby="tch-students-title">
            <div className="tch-subhead tch-subhead--ledger">
              <h2 id="tch-students-title">学生台账</h2>
              <span className="tch-subhead__meta">
                共 <span className="mono">{data.students.total}</span> 人
                {filtered ? " · 已筛选" : ""}
              </span>
            </div>

            <TeacherToolbar q={q} status={status} />

            {data.students.rows.length > 0 ? (
              <StudentTable rows={data.students.rows} />
            ) : filtered ? (
              <p className="tch-empty">
                没有匹配的学生，试试清空搜索或切回「全部」。
                <Link href="/teacher">清空筛选</Link>
              </p>
            ) : (
              <p className="tch-empty">
                名单里还没有学生。先 <Link href="/teacher/roster">去名单管理导入名单</Link>
                ，学生用学号即可登录。
              </p>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
