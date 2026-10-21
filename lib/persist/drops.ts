/**
 * lib/persist/drops.ts —— 场景投放审计
 *
 * 投放不是引擎 action，不参与状态机；只往 timeline 写一条 actionType="drop"
 * 的审计行，供报告时间线展示。重放与计分会跳过该行（见 replay.ts / score.ts）。
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs, timeline as timelineTable } from "@/db/schema";
import { getDefinition } from "@/lib/engine";
import { badRequest, conflict, notFound, PersistError } from "./errors";
import { replayState, type StoredTimelineRow } from "./replay";

export interface RunDropInput {
  kind: "drop";
  reagentId: string;
  vesselId: string;
  inputMode: string;
  outcome?: string;
  reactionText?: string;
}

export interface AppendedDrop {
  stepIndex: number;
  seq: number;
  reagentId: string;
  vesselId: string;
  inputMode: string;
  outcome: string;
  reactionText: string;
}

const INPUT_MODES = new Set(["drag", "click", "key", "event", "auto"]);

function textField(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function assertDrop(input: unknown): RunDropInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw badRequest("INVALID_DROP");
  }
  const record = input as Record<string, unknown>;
  if (record.kind !== "drop") throw badRequest("INVALID_DROP");
  const reagentId = textField(record.reagentId, 40);
  const vesselId = textField(record.vesselId, 40);
  const inputMode = textField(record.inputMode, 16);
  if (!reagentId || !vesselId || !INPUT_MODES.has(inputMode)) {
    throw badRequest("INVALID_DROP");
  }
  return {
    kind: "drop",
    reagentId,
    vesselId,
    inputMode,
    outcome: textField(record.outcome, 24) || "info",
    reactionText: textField(record.reactionText, 500),
  };
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

/** 追加一条投放审计；异步调用方失败静默即可。 */
export async function appendRunDrop(runId: string, raw: unknown): Promise<AppendedDrop> {
  const drop = assertDrop(raw);

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

  const stored = await loadTimelineRows(runId);
  const state = replayState(run.experimentId, stored).state;
  const stepIndex = state.stepIndex;
  let seq = stored
    .filter((row) => row.stepIndex === stepIndex)
    .reduce((max, row) => Math.max(max, row.seq), 0) + 1;

  const payload = {
    kind: "drop" as const,
    reagentId: drop.reagentId,
    vesselId: drop.vesselId,
    inputMode: drop.inputMode,
    outcome: drop.outcome,
    reactionText: drop.reactionText,
  };

  // 投放与动作可能同时落库；撞到 (run,step,seq) 时顺延，避免审计行被静默吞掉。
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inserted = await db
      .insert(timelineTable)
      .values({
        runId,
        stepIndex,
        seq,
        actionType: "drop",
        choiceId: `drop:${drop.reagentId}:${drop.vesselId}`,
        competency: "A1",
        correct: drop.outcome !== "failure",
        deduct: 0,
        payload: JSON.stringify(payload),
      })
      .onConflictDoNothing()
      .returning({ seq: timelineTable.seq });
    if (inserted.length > 0) break;
    seq += 1;
  }

  return {
    stepIndex,
    seq,
    reagentId: drop.reagentId,
    vesselId: drop.vesselId,
    inputMode: drop.inputMode,
    outcome: drop.outcome ?? "info",
    reactionText: drop.reactionText ?? "",
  };
}
