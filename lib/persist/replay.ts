/**
 * lib/persist/replay.ts —— 从落库时间线重放 ExperimentState
 *
 * 为什么重放而不是存 state：契约 §8 规定 timeline 是唯一事实来源（操作分由它聚合），
 * 且扣子只同步 schema，多存一份 state 容易与定义文件漂移。
 *
 * 重放顺序：按 (stepIndex, seq) 升序；
 * - 每个动作交给 `apply()`（与线上同一状态机）；
 * - 陷阱动作自带的事故已在 apply 里入账，DB 里的事故行只在「尚未记录」时用
 *   `applyIncident()` 补录（覆盖规则层动态判定），因此不会重复扣分；
 * - 同时收集 hint 事件，供交卷时算「独立完成度」扣分。
 */

import {
  apply,
  applyIncident,
  initState,
  type Action,
  type ActionType,
  type CompetencyCode,
  type Event,
  type ExperimentState,
  type IncidentLevel,
} from "@/lib/engine";
import type { HintLevel, HintUsage } from "@/lib/pedagogy/hints";
import { getIncident } from "@/lib/safety/registry";

export interface StoredTimelineRow {
  stepIndex: number;
  seq: number;
  actionType: string;
  choiceId: string;
  competency: string;
  correct: boolean;
  deduct: number;
  payload: string | null;
  at: Date;
}

export interface StoredIncidentRow {
  stepIndex: number;
  incidentId: string;
  level: string;
  deduct: number;
  fx: string;
  at: Date;
}

export interface ReplayResult {
  state: ExperimentState;
  hints: HintUsage[];
}

/** payload 里存的是动作参数 JSON；坏数据按「无参数」处理，不让重放崩掉。 */
function parseParams(payload: string | null): Action["params"] | undefined {
  if (!payload) return undefined;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const params: Record<string, number | string | boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
        params[key] = value;
      }
    }
    return params;
  } catch {
    return undefined;
  }
}

function isFixedAction(row: StoredTimelineRow): Action {
  return {
    type: row.actionType as ActionType,
    choiceId: row.choiceId,
    competency: row.competency as CompetencyCode,
    ...(parseParams(row.payload) ? { params: parseParams(row.payload) } : {}),
  };
}

function collectHints(events: readonly Event[], stepIndex: number, competency: CompetencyCode, into: HintUsage[]): void {
  for (const event of events) {
    if (event.kind !== "hint") continue;
    into.push({ competency, stepIndex, level: event.level as HintLevel });
  }
}

/** 重放一次 run；expId 必须已有可玩定义（调用方负责先校验）。 */
export function replayState(
  expId: string,
  timelineRows: readonly StoredTimelineRow[],
  incidentRows: readonly StoredIncidentRow[] = [],
): ReplayResult {
  const hints: HintUsage[] = [];
  let state = initState(expId);

  const ordered = [...timelineRows].sort((a, b) => a.stepIndex - b.stepIndex || a.seq - b.seq);
  for (const row of ordered) {
    // 投放审计行只用于报告呈现，不参与状态机重放。
    if (row.actionType === "drop") continue;
    const action = isFixedAction(row);
    const atStep = state.stepIndex;
    const result = apply(state, action);
    state = result.state;
    collectHints(result.events, atStep, action.competency, hints);
  }

  const orderedIncidents = [...incidentRows].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const incident of orderedIncidents) {
    const registered = getIncident(incident.incidentId);
    const level = (registered?.level ?? incident.level) as IncidentLevel;
    const already = state.incidents.some(
      (record) => record.stepIndex === incident.stepIndex && record.incidentId === incident.incidentId,
    );
    if (already) continue;

    const result = applyIncident(state, {
      kind: "incident",
      incidentId: incident.incidentId,
      level,
      deduct: registered?.deduct ?? incident.deduct,
      competency: registered?.competency ?? "A3",
      fx: registered?.fx,
      terminate: level === "L4" || (registered?.terminate ?? false),
      atStep: incident.stepIndex,
    });
    state = result.state;
    collectHints(result.events, incident.stepIndex, registered?.competency ?? "A3", hints);
  }

  return { state, hints };
}
