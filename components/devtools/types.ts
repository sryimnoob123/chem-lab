/**
 * components/devtools/types.ts —— 开发者调试面板的数据形状（服务端 → 客户端）
 *
 * 只放调试面板用的类型；不引业务逻辑，正式页面不 import 本目录。
 */

import type { Action, CompetencyCode, IncidentLevel } from "@/lib/engine";

export interface DevSessionInfo {
  student: { studentNo: string; name: string; className: string } | null;
  teacher: boolean;
}

export interface DevEnvInfo {
  nodeEnv: string;
  /** process.env.DEVTOOLS 原值（未设置为 undefined） */
  flag: string | undefined;
}

export interface DevRunRef {
  runId: string;
  status: string;
}

export interface DevHazard {
  incidentId: string;
  level: IncidentLevel;
  title: string;
  /** 事故发生在第几步（0-based） */
  stepIndex: number;
  /** 触发该事故的陷阱动作 */
  trigger: Action;
  /** 从第 1 步自动推进到该步之前所需的动作（方便一键复现） */
  prelude: Action[];
}

export interface DevExperiment {
  id: string;
  title: string;
  steps: number;
  playable: boolean;
  /** 当前学生该实验进行中的 run（没有为 null） */
  currentRun: DevRunRef | null;
  hazards: DevHazard[];
}

export interface DevTimelineRow {
  stepIndex: number;
  seq: number;
  actionType: string;
  choiceId: string;
  competency: CompetencyCode | string;
  correct: boolean;
  deduct: number;
  at: string;
}
