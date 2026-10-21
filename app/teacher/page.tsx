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
    return { data: { overview, incidents, students, radar }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "未知错误" };
  }
}

export default async function TeacherOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = parseStatus(params.status);
  const { data, error } = await load(q, status);
  const filtered = q !== "" || status !== "all";

  return (
    <>
      <PageHead title="学情总览" sub="03600004 · 能源科学与技术学院 · 2 个班">
        <span className="tch-updated">
          数据更新于 <span className="mono">{formatClock(new Date())}</span>
        </span>
        <TeacherExportButton />
        <a className="btn btn--secondary" href="/teacher">
          刷新
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
