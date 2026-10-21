/**
 * 教师端查询适配层（Server only）。
 *
 * 页面只从这里取数，不直接 import `@/lib/queries/teacher`：
 * 1) 字段口径（如 competency 0~100）集中在这里和 types.ts，页面不散落；
 * 2) data-api 侧签名变化只需改这一处。
 *
 * 签名与 Lead 钉死的契约一致，见 `components/teacher/types.ts`。
 */
import type {
  IncidentStat,
  OverviewStat,
  StudentDetail,
  StudentListQuery,
  StudentListResult,
} from "./types";

import * as teacherQueries from "@/lib/queries/teacher";

type TeacherQueries = {
  getOverview: () => Promise<OverviewStat>;
  listStudents: (opts?: StudentListQuery) => Promise<StudentListResult>;
  getIncidentSummary: () => Promise<IncidentStat[]>;
  getStudentDetail: (studentNo: string) => Promise<StudentDetail | null>;
};

const queries = teacherQueries as unknown as TeacherQueries;

export const getOverview: TeacherQueries["getOverview"] = () => queries.getOverview();

export const listStudents: TeacherQueries["listStudents"] = (opts) => queries.listStudents(opts);

export const getIncidentSummary: TeacherQueries["getIncidentSummary"] = () =>
  queries.getIncidentSummary();

export const getStudentDetail: TeacherQueries["getStudentDetail"] = (studentNo) =>
  queries.getStudentDetail(studentNo);
