/**
 * lib/persist/events.ts —— 批量动作提交（timeline + incidents 落库，服务端重算 state）
 *
 * 流程：读 run → 重放已有时间线 → 逐条 apply() → detectFirstIncident() 补事故
 *      → 写 timeline（唯一键 (runId,stepIndex,seq)，onConflictDoNothing 幂等）
 *      → 写 incidents（内存 + 查询双重判重，DDL 无唯一索引）
 *
 * 幂等：同一批 events 提交两次，第二次每条都被 apply 判为 invalid，不前移 state、
 * 不写新行，因此 timeline/incidents 条数不变。
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { incidents as incidentsTable, runs, timeline as timelineTable } from "@/db/schema";
import {
  apply,
  applyIncident,
  getDefinition,
  type Action,
  type Event,
  type ExperimentState,
  type IncidentLevel,
} from "@/lib/engine";
import { detectFirstIncident, getIncident } from "@/lib/safety/registry";
import { badRequest, conflict, notFound, PersistError } from "./errors";
import { replayState, type StoredIncidentRow, type StoredTimelineRow } from "./replay";

export interface AppendedIncident {
  stepIndex: number;
  incidentId: string;
  level: IncidentLevel;
  deduct: number;
}

export interface AppendRunEventsResult {
  state: ExperimentState;
  events: Event[];
  incidents: AppendedIncident[];
}

const MAX_ACTIONS_PER_BATCH = 200;

function assertActions(input: unknown): Action[] {
  if (!Array.isArray(input)) throw badRequest("EVENTS_REQUIRED");
  if (input.length > MAX_ACTIONS_PER_BATCH) throw badRequest("EVENTS_TOO_MANY");
  const actions: Action[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null) throw badRequest("INVALID_ACTION");
    const record = item as Record<string, unknown>;
    if (typeof record.type !== "string" || typeof record.choiceId !== "string") {
      throw badRequest("INVALID_ACTION");
    }
    if (typeof record.competency !== "string") throw badRequest("INVALID_ACTION");
    actions.push({
      type: record.type as Action["type"],
      choiceId: record.choiceId,
      competency: record.competency as Action["competency"],
      ...(typeof record.params === "object" && record.params !== null
        ? { params: record.params as Action["params"] }
        : {}),
    });
  }
  return actions;
}

async function loadTimelineRows(runId: string): Promise<StoredTimelineRow[]> {
  return db
    .select({
      stepIndex: timelineTable.stepIndex,
      seq: timelineTable.seq,
      actionType: timelineTable.actionType,
      choiceId: timelineTable.choiceId,
      competency: timelineTable.competency,
      correct: timelineTable.correct,
      deduct: timelineTable.deduct,
      payload: timelineTable.payload,
      at: timelineTable.at,
    })
    .from(timelineTable)
    .where(eq(timelineTable.runId, runId))
    .orderBy(asc(timelineTable.stepIndex), asc(timelineTable.seq));
}

async function loadIncidentRows(runId: string): Promise<StoredIncidentRow[]> {
  return db
    .select({
      stepIndex: incidentsTable.stepIndex,
      incidentId: incidentsTable.incidentId,
      level: incidentsTable.level,
      deduct: incidentsTable.deduct,
      fx: incidentsTable.fx,
      at: incidentsTable.at,
    })
    .from(incidentsTable)
    .where(eq(incidentsTable.runId, runId))
    .orderBy(asc(incidentsTable.at));
}

interface PlacedIncident {
  events: Event[];
  state: ExperimentState;
}

/** 检测并补录一次事故；返回 null 表示本动作没有新事故。 */
function placeIncident(
  expId: string,
  preState: ExperimentState,
  action: Action,
  state: ExperimentState,
  stepIndex: number,
  known: Set<string>,
): PlacedIncident | null {
  const hit = detectFirstIncident(expId, preState, action);
  if (!hit) return null;

  const already = state.incidents.some(
    (record) => record.stepIndex === stepIndex && record.incidentId === hit.id,
  );
  if (already || known.has(`${stepIndex}:${hit.id}`)) return null;

  const result = applyIncident(state, {
    kind: "incident",
    incidentId: hit.id,
    level: hit.level,
    deduct: hit.deduct,
    competency: hit.competency,
    fx: hit.fx,
    terminate: hit.terminate,
    atStep: stepIndex,
    feedback: {
      severity: "danger",
      title: hit.title,
      why: hit.why,
      correct: hit.correct,
      refs: hit.refs,
    },
  });
  if (result.state === state) return null;

  return { events: result.events, state: result.state };
}

/** 提交一批动作：服务端重算并落库，返回重算后的完整 state。 */
export async function appendRunEvents(
  runId: string,
  rawActions: unknown,
): Promise<AppendRunEventsResult> {
  const actions = assertActions(rawActions);

  const runRows = await db
    .select({ id: runs.id, experimentId: runs.experimentId, status: runs.status })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  const run = runRows[0];
  if (!run) throw notFound("RUN_NOT_FOUND");
  if (run.status === "finished") throw conflict("RUN_FINISHED");

  const definition = getDefinition(run.experimentId);
  if (!definition) throw new PersistError(404, "EXPERIMENT_NOT_PLAYABLE");

  const storedTimeline = await loadTimelineRows(runId);
  const storedIncidents = await loadIncidentRows(runId);
  const replayed = replayState(run.experimentId, storedTimeline, storedIncidents);
  let state = replayed.state;

  const seqOfStep = new Map<number, number>();
  for (const row of storedTimeline) {
    seqOfStep.set(row.stepIndex, Math.max(seqOfStep.get(row.stepIndex) ?? 0, row.seq));
  }

  const knownIncidents = new Set(
    storedIncidents.map((row) => `${row.stepIndex}:${row.incidentId}`),
  );
  const allEvents: Event[] = [];
  const newTimeline: Array<typeof timelineTable.$inferInsert> = [];
  const newIncidents: AppendedIncident[] = [];

  for (const action of actions) {
    const preState = state;
    const stepIndex = preState.stepIndex;
    const applied = apply(preState, action);
    const wasInvalid = applied.state === preState && applied.events.some((event) => event.kind === "invalid");
    if (wasInvalid) {
      allEvents.push(...applied.events);
      continue;
    }

    state = applied.state;
    const actionEvents: Event[] = [...applied.events];

    const placed = placeIncident(run.experimentId, preState, action, state, stepIndex, knownIncidents);
    if (placed) {
      state = placed.state;
      actionEvents.push(...placed.events);
    }

    let deduct = 0;
    let incidentId: string | undefined;
    let correct = true;
    for (const event of actionEvents) {
      if (event.kind === "violation") {
        deduct += event.deduct;
        correct = false;
      } else if (event.kind === "incident") {
        // 陷阱动作在 apply() 里入账的事故也要落库（否则教师端事故统计会漏）。
        const deductValue = getIncident(event.incidentId)?.deduct ?? 0;
        deduct += deductValue;
        incidentId = incidentId ?? event.incidentId;
        correct = false;

        const key = `${stepIndex}:${event.incidentId}`;
        if (!knownIncidents.has(key)) {
          knownIncidents.add(key);
          newIncidents.push({
            stepIndex,
            incidentId: event.incidentId,
            level: event.level,
            deduct: deductValue,
          });
        }
      }
    }

    const seq = (seqOfStep.get(stepIndex) ?? 0) + 1;
    seqOfStep.set(stepIndex, seq);
    newTimeline.push({
      runId,
      stepIndex,
      seq,
      actionType: action.type,
      choiceId: action.choiceId,
      competency: action.competency,
      correct,
      deduct,
      payload: action.params ? JSON.stringify(action.params) : null,
    });
    allEvents.push(...actionEvents);
  }

  if (newTimeline.length > 0) {
    await db.insert(timelineTable).values(newTimeline).onConflictDoNothing();
  }
  if (newIncidents.length > 0) {
    await db.insert(incidentsTable).values(
      newIncidents.map((incident) => ({
        runId,
        stepIndex: incident.stepIndex,
        incidentId: incident.incidentId,
        level: incident.level,
        fx: getIncident(incident.incidentId)?.fx ?? "",
        deduct: incident.deduct,
      })),
    );
  }

  return { state, events: allEvents, incidents: newIncidents };
}
