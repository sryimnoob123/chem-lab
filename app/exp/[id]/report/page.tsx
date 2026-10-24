import Link from "next/link";
import { notFound } from "next/navigation";
import { getDefinition } from "@/lib/engine";
import { latestRunId } from "@/lib/persist/latest-run";
import { loadRunBundle, type RunBundle } from "@/lib/persist/report";
import { buildRunSummary, minutesBetween } from "@/lib/report/summary";
import { getSceneReagent } from "@/lib/scene/reagents";
import { BopbpsPostLab } from "@/components/exp/bopbps-postlab";
import { Reveal } from "@/components/motion/reveal";
import styles from "./report.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ runId?: string | string[]; demo?: string | string[]; auto?: string | string[]; post?: string | string[] }>;
};

const VESSEL_LABELS: Record<string, string> = {
  flask: "锥形瓶",
  beaker: "烧杯",
  tube: "试管",
  burette: "滴定管",
};

function parseDropPayload(payload: string | null): {
  reagentId: string;
  vesselId: string;
  reactionText: string;
} | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (record.kind !== "drop") return null;
    return {
      reagentId: typeof record.reagentId === "string" ? record.reagentId : "",
      vesselId: typeof record.vesselId === "string" ? record.vesselId : "",
      reactionText: typeof record.reactionText === "string" ? record.reactionText : "",
    };
  } catch {
    return null;
  }
}

function dropText(payload: string | null): string | null {
  const drop = parseDropPayload(payload);
  if (!drop) return null;
  const reagent = getSceneReagent(drop.reagentId)?.name ?? drop.reagentId;
  const vessel = VESSEL_LABELS[drop.vesselId] ?? drop.vesselId;
  const reaction = drop.reactionText ? ` · ${drop.reactionText}` : "";
  return `投放 ${reagent} → ${vessel}${reaction}`;
}

const COMPETENCY_LABELS: Record<string, string> = {
  K1: "知识 · 实验原理",
  K2: "知识 · 计量与误差",
  K3: "知识 · 安全规范",
  S1: "技能 · 仪器操作",
  S2: "技能 · 滴定控制",
  S3: "技能 · 数据处理",
  A1: "素养 · 规范意识",
  A2: "素养 · 安全习惯",
  A3: "素养 · 反思改进",
};

function formatTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const definition = getDefinition(id);
  if (!definition) notFound();

  const query = await searchParams;
  const requestedRunId =
    typeof query.runId === "string" && query.runId.trim() ? query.runId.trim() : "";
  const demoNotice = query.demo === "1" || query.demo === "true";
  /** 后测页带过来的那次成绩：只在「后测回顾」里显示，不参与总分（总分仍按库里的三段分算） */
  const postRaw = typeof query.post === "string" ? Number.parseInt(query.post, 10) : Number.NaN;
  const postScore = Number.isFinite(postRaw) ? Math.min(100, Math.max(0, postRaw)) : null;
  const runId = requestedRunId || (await latestRunId(id));
  let bundle: RunBundle | null = null;
  if (runId) {
    try {
      bundle = await loadRunBundle(runId);
    } catch {
      bundle = null;
    }
    // 指定 runId 时必须匹配本实验；不存在/不属于本实验就显示空态，不回落 seed。
    if (bundle && bundle.run.experimentId !== id) bundle = null;
  }

  const scores = bundle?.scores ?? { preview: null, operation: null, report: null, total: null, detail: null };
  /**
   * 预习/操作/报告三段分一律读库（runs.score_pre / score_op / score_report）：预习分是
   * quiz_answers 里 phase="pre" 的真实正确率（前测提交后由 /api/runs/[id]/quiz 落库），
   * 展示层不再加分，保证教师端 / 报告页 / 导出三个口径一致。
   */
  const preview = scores.preview ?? 0;
  const operation = scores.operation ?? 0;
  const report = scores.report ?? 0;
  const total = scores.total ?? 0;
  /** 提示使用情况（用户 2026-10-22：报告要记次数）：按 1/3/5 扣分，见 lib/pedagogy/hints.ts */
  const hints = scores.detail?.hints ?? [];
  const hintCount = hints.length;
  const hintDeduct = hints.reduce((sum, item) => sum + item.deduct, 0);
  const competency = scores.detail?.competency ?? {};
  const codes = definition.competencies.length > 0 ? definition.competencies : Object.keys(competency);
  const timeline = (bundle?.timeline ?? []).slice(-10).reverse();
  /** 错题解析用完整时间线（最近 10 条可能截掉早期错误） */
  const wrongRows = (bundle?.timeline ?? []).filter((row) => row.correct === false);
  const incidents = bundle?.incidents ?? [];
  const studentNo = bundle?.student?.studentNo ?? bundle?.run.studentNo ?? "—";
  const studentName = bundle?.student?.name ?? "";
  const finishedAt = bundle?.run.finishedAt ? new Date(bundle.run.finishedAt) : null;

  // 本次总结：覆盖步数按「走到过的最深一步」算，重做不会把覆盖数刷虚。
  const coveredSteps = bundle?.timeline?.length
    ? Math.max(...bundle.timeline.map((row) => row.stepIndex)) + 1
    : 0;
  const summary = buildRunSummary({
    total,
    incidentCount: incidents.length,
    coveredSteps,
    totalSteps: definition.steps.length,
    minutes: bundle ? minutesBetween(bundle.run.startedAt, bundle.run.finishedAt) : 0,
  });

  return (
    <main className={`${styles.page} ix-page-enter`} data-demo-id="demo-report">
      <header className={styles.topbar}>
        <Link className={`${styles.back} ix`} href="/experiments">
          <span aria-hidden="true">←</span> 实验列表
        </Link>
        <span className={styles.kicker}>实验报告 · 操作评价</span>
        <span className={styles.topMeta}>{finishedAt ? "已交卷" : "暂无交卷记录"}</span>
      </header>

      <div className={styles.sheet}>
        {/* 交卷后第一眼：哪个实验、多少分、这次做得怎么样；后测放在后面 */}
        <Reveal as="section" className={styles.head} aria-labelledby="report-title" index={0}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>实验 {definition.id.replace(/^exp/, "")} · 报告</p>
            <h1 className={styles.title} id="report-title">
              {definition.title}
            </h1>
            <p className={styles.meta}>
              <span>学号 {studentNo}</span>
              {studentName ? <span>{studentName}</span> : null}
              <span>交卷时间 {formatTime(finishedAt)}</span>
            </p>
          </div>
          <div className={styles.totalBox}>
            <span className={styles.totalLabel}>总分</span>
            <span className={styles.totalValue}>{total}</span>
            <span className={styles.totalUnit}>/ 100</span>
          </div>
        </Reveal>

        <Reveal as="section" className={styles.summary} aria-labelledby="report-summary" index={1} data-tone={summary.tone} data-demo-id="demo-report-summary">
          <div className={styles.summaryLead}>
            <span className={styles.summaryKicker}>本次总结</span>
            <p className={styles.summaryLine} id="report-summary">
              {summary.headline}
            </p>
            {incidents.length === 0 || hintCount === 0 ? (
              <span className={styles.badgeRow} data-demo-id="demo-report-badges">
                {/* 两个徽章各自独立判断：有提示但没事故时不能再显示「零提示」 */}
                {incidents.length === 0 ? <span className={styles.badge}>零事故</span> : null}
                {hintCount === 0 ? <span className={styles.badge}>零提示</span> : null}
              </span>
            ) : null}
          </div>
          <ul className={styles.summaryFacts}>
            {summary.facts.map((fact) => (
              <li key={fact.label}>
                <span className={styles.summaryFactLabel}>{fact.label}</span>
                <strong className={styles.summaryFactValue} data-tone={fact.tone}>
                  {fact.value}
                </strong>
              </li>
            ))}
          </ul>
        </Reveal>
        {demoNotice ? (
          <div className={styles.demoNotice} data-demo-id="demo-report-notice" role="note">
            <strong>演示示例 · 非本次 run</strong>
            <span>这是历史记录，用于说明报告结构。</span>
          </div>
        ) : null}
        <Reveal as="div" index={2}>
          <BopbpsPostLab expId={definition.id} readOnly postScore={postScore} />
        </Reveal>

        <Reveal as="section" className={styles.parts} aria-label="三段分" index={3}>
          {[
            { label: "预习", value: preview, weight: "10%", note: "前测正确率" },
            {
              label: "操作",
              value: operation,
              weight: "40%",
              note:
                hintCount > 0
                  ? `扣违规 / 事故 / 提示 ${hintCount} 次（−${hintDeduct} 分）`
                  : "扣违规 / 事故 / 提示",
            },
            { label: "报告", value: report, weight: "50%", note: "数据与安全复盘" },
          ].map((part) => (
            <div className={styles.part} key={part.label}>
              <div className={styles.partHead}>
                <span className={styles.partLabel}>{part.label}</span>
                <span className={styles.partWeight}>{part.weight}</span>
              </div>
              <span className={styles.partValue}>{part.value}</span>
              <div className={styles.track} aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, part.value))}%` }} />
              </div>
              <p className={styles.partNote}>{part.note}</p>
            </div>
          ))}
        </Reveal>

        <div className={styles.columns}>
          <Reveal as="section" className={styles.panel} aria-labelledby="competency-title" index={3}>
            <div className={styles.panelHead}>
              <h2 id="competency-title">能力点掌握度</h2>
              <span>0–100</span>
            </div>
            {codes.length === 0 ? (
              <p className={styles.empty}>暂无能力点记录。</p>
            ) : (
              <ul className={styles.competencyList}>
                {codes.map((code) => {
                  const raw = competency[code];
                  const value = typeof raw === "number" ? Math.round(raw * 100) : 0;
                  return (
                    <li key={code}>
                      <span className={styles.code}>{code}</span>
                      <span className={styles.competencyName}>
                        {COMPETENCY_LABELS[code] ?? "能力点"}
                      </span>
                      <div className={styles.track} aria-hidden="true">
                        <span style={{ width: `${value}%` }} />
                      </div>
                      <span className={styles.percent}>{value}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Reveal>

          <Reveal as="section" className={styles.panel} aria-labelledby="incident-title" index={4}>
            <div className={styles.panelHead}>
              <h2 id="incident-title">事故清单</h2>
              <span>{incidents.length} 条</span>
            </div>
            {incidents.length === 0 ? (
              <p className={styles.empty}>本次没有触发事故记录。</p>
            ) : (
              <ul className={styles.incidentList}>
                {incidents.map((incident) => (
                  <li key={`${incident.stepIndex}-${incident.incidentId}-${incident.at}`}>
                    <span className={styles.level} data-level={incident.level}>
                      {incident.level}
                    </span>
                    <span className={styles.incidentName}>{incident.label}</span>
                    <span className={styles.incidentStep}>第 {pad2(incident.stepIndex + 1)} 步</span>
                    <span className={styles.incidentDeduct}>−{incident.deduct}</span>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>

        {/* 错题解析：红队要求报告四要素之一（总分/总结/能力点/错题解析） */}
        <Reveal as="section" className={styles.panel} aria-labelledby="wrong-title" index={5}>
          <div className={styles.panelHead}>
            <h2 id="wrong-title">错题解析</h2>
            <span>{wrongRows.length} 条 · 含正确做法</span>
          </div>
          {wrongRows.length === 0 ? (
            <p className={styles.empty}>本次没有错误操作，每一步都通过了。</p>
          ) : (
            <ul className={styles.wrongList}>
              {wrongRows.map((row, i) => {
                const step = definition.steps[row.stepIndex];
                const chosen = step?.choices.find((item) => item.choiceId === row.choiceId);
                const right = step?.choices.find((item) => item.role === "correct");
                return (
                  <li key={`${row.stepIndex}-${row.seq ?? i}-${row.choiceId}`}>
                    <span className={styles.wrongStep}>
                      第 {pad2(row.stepIndex + 1)} 步 · {step?.title ?? "—"}
                    </span>
                    <p className={styles.wrongYou}>你的选择：{chosen?.label ?? row.choiceId}</p>
                    <p className={styles.wrongRight}>正确做法：{right?.label ?? "—"}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Reveal>

        <Reveal as="section" className={styles.panel} aria-labelledby="timeline-title" index={6}>
          <div className={styles.panelHead}>
            <h2 id="timeline-title">关键步骤时间线</h2>
            <span>最近 {timeline.length} 条 · 倒序</span>
          </div>
          {timeline.length === 0 ? (
            <p className={styles.empty}>暂无时间线记录；完成一次操作后这里会按步骤倒序显示。</p>
          ) : (
            <ol className={styles.timeline}>
              {timeline.map((row) => {
                const step = definition.steps[row.stepIndex];
                const choice = step?.choices.find((item) => item.choiceId === row.choiceId);
                const dropLabel = row.actionType === "drop" ? dropText(row.payload) : null;
                return (
                  <li key={`${row.stepIndex}-${row.seq}-${row.at}`} data-kind={row.actionType}>
                    <span className={styles.timelineStep}>第 {pad2(row.stepIndex + 1)} 步</span>
                    <span className={styles.timelineAction} title={dropLabel ?? undefined}>
                      {dropLabel ?? choice?.label ?? step?.title ?? row.choiceId}
                    </span>
                    <span className={styles.timelineState} data-correct={row.correct ? "true" : "false"}>
                      {dropLabel ? "已投放" : row.correct ? "通过" : "未通过"}
                    </span>
                    <span className={styles.timelineTime}>
                      {formatTime(row.at ? new Date(row.at) : null)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Reveal>

        <footer className={styles.footer}>
          <Link className={`${styles.action} ix`} href="/experiments">
            返回实验列表
          </Link>
          {runId ? (
            <a className={`${styles.action} ix`} href={`/api/runs/${runId}/export`}>
              下载记录（CSV）
            </a>
          ) : null}
          <span className={styles.footerNote}>
            {runId ? `run ${runId.slice(0, 8)} · ${bundle?.run.status ?? "unknown"}` : "空态骨架 · 未读取到已完成记录"}
          </span>
        </footer>
      </div>
    </main>
  );
}
