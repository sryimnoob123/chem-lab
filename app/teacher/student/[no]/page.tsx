import Link from "next/link";
import { getStudentDetail } from "@/components/teacher/queries";
import { MissingStudent } from "@/components/teacher/missing-student";
import { ScoreRulers, CompetencyBars } from "@/components/teacher/detail-scores";
import { IncidentLog, TimelineLog } from "@/components/teacher/detail-records";
import { formatDateTime, formatScore } from "@/components/teacher/format";
import type { DetailRun } from "@/components/teacher/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ no: string }> };

function latestRun(runs: DetailRun[]): DetailRun | null {
  if (runs.length === 0) return null;
  return [...runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
}

function runStatusText(run: DetailRun | null): string {
  if (!run) return "未开始";
  if (run.totalScore !== null) return "已完成";
  if (run.status === "in_progress") return "进行中";
  return "已结束";
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { no } = await params;
  const detail = await getStudentDetail(no).catch(() => null);
  if (!detail) return <MissingStudent studentNo={no} />;

  const run = latestRun(detail.runs);
  const lastActive = detail.timeline.length > 0
    ? detail.timeline.reduce((latest, entry) => (entry.at > latest ? entry.at : latest), detail.timeline[0].at)
    : null;

  return (
    <>
      <header className="tch-detail-head">
        <div className="tch-detail-head__main">
          <Link className="tch-back" href="/teacher">
            ← 学情总览
          </Link>
          <h1 className="tch-detail-name">{detail.student.name}</h1>
          <p className="tch-detail-meta">
            <span className="mono">{detail.student.studentNo}</span>
            <span>{detail.student.className || "未分班"}</span>
            <span>{run ? `实验 ${run.experimentId}` : "尚无实验记录"}</span>
            <span className="tch-detail-meta__state">{runStatusText(run)}</span>
          </p>
        </div>

        <div className="tch-detail-score">
          <span className="tch-detail-score__label">总分</span>
          <span className="mono tch-detail-score__value">{formatScore(run?.totalScore ?? null)}</span>
          <span className="tch-detail-score__note">
            {lastActive ? `最近活跃 ${formatDateTime(lastActive)}` : "最近活跃 —"}
          </span>
        </div>
      </header>

      {!run ? (
        <p className="tch-empty">
          该学生还没有进入实验。等其用学号登录后，这里会出现三段落分、能力点与事故记录。
        </p>
      ) : null}

      <div className="tch-detail-grid">
        <div className="tch-detail-col">
          <section className="tch-block" aria-labelledby="tch-score-title">
            <div className="tch-subhead tch-subhead--ledger">
              <h2 id="tch-score-title">环节得分</h2>
              <span className="tch-subhead__meta">
                {run ? `实验 ${run.experimentId}` : "—"}
              </span>
            </div>
            <ScoreRulers run={run} />
          </section>

          <section className="tch-block" aria-labelledby="tch-comp-title">
            <div className="tch-subhead tch-subhead--ledger">
              <h2 id="tch-comp-title">能力点掌握度</h2>
              <span className="tch-subhead__meta">{Object.keys(detail.competency).length} 项</span>
            </div>
            <CompetencyBars competency={detail.competency} />
          </section>
        </div>

        <div className="tch-detail-col">
          <section className="tch-block" aria-labelledby="tch-incident-title">
            <div className="tch-subhead tch-subhead--ledger">
              <h2 id="tch-incident-title">事故清单</h2>
              <span className="tch-subhead__meta">{detail.incidents.length} 条</span>
            </div>
            <IncidentLog incidents={detail.incidents} />
          </section>

          <section className="tch-block" aria-labelledby="tch-timeline-title">
            <div className="tch-subhead tch-subhead--ledger">
              <h2 id="tch-timeline-title">最近操作</h2>
              <span className="tch-subhead__meta">最近 30 条</span>
            </div>
            <TimelineLog timeline={detail.timeline} />
          </section>
        </div>
      </div>
    </>
  );
}
