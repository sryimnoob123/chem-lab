/**
 * 教师端查询结果的本地类型。
 *
 * 契约来源：Lead 下发的接口签名（2026-10-20）。`lib/queries/teacher` 落地前，
 * 页面只依赖这里的形状；落地后若字段有出入，改这一个文件即可（见 queries.ts）。
 */

export type StudentStatus = "done" | "doing" | "not_started";

export type OverviewStat = {
  total: number;
  done: number;
  doing: number;
  notStarted: number;
  avgTotal: number | null;
  incidents: number;
};

export type StudentRow = {
  studentNo: string;
  name: string;
  className: string;
  status: StudentStatus;
  /** 0~100 */
  progress: number;
  lastActiveAt: Date | null;
  totalScore: number | null;
  incidentCount: number;
  runId: string | null;
  experimentId: string | null;
};

export type StudentListQuery = {
  q?: string;
  status?: StudentStatus;
  limit?: number;
};

export type StudentListResult = {
  rows: StudentRow[];
  total: number;
};

export type IncidentLevel = "L1" | "L2" | "L3" | "L4";

export type IncidentTop = {
  incidentId: string;
  label: string;
  count: number;
};

export type IncidentStat = {
  level: IncidentLevel;
  count: number;
  top: IncidentTop[];
};

export type DetailStudent = {
  studentNo: string;
  name: string;
  className: string;
};

export type DetailRun = {
  runId: string;
  experimentId: string;
  status: string;
  totalScore: number | null;
  /** data-api 保证非 null */
  startedAt: Date;
  finishedAt: Date | null;
  /** 0~100 */
  progress: number;
  /** data-api 额外提供（交卷时落库的三段分），未交卷为 null */
  scorePre?: number | null;
  scoreOp?: number | null;
  scoreReport?: number | null;
};

export type DetailIncident = {
  incidentId: string;
  /** data-api 已兜好中文名（registry title，缺省回落 incidentId） */
  label: string;
  level: IncidentLevel;
  stepIndex: number;
  at: Date;
};

export type DetailTimelineEntry = {
  stepIndex: number;
  /** 英文动作 id，如 titrate */
  actionType: string;
  choiceId: string;
  /** 中文动作名，明细页优先显示它 */
  label: string;
  correct: boolean;
  deduct: number;
  at: Date;
};

export type StudentDetail = {
  student: DetailStudent;
  runs: DetailRun[];
  /** 能力点编码（K1…A3）→ 掌握度 0~100 */
  competency: Record<string, number>;
  incidents: DetailIncident[];
  timeline: DetailTimelineEntry[];
};
