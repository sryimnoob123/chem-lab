/**
 * lib/queries/experiments.ts —— 实验清单（首页 / API `/api/experiments` 共用）
 *
 * `playable` 以引擎里是否注册了定义为准（exp09 已实现，其余先 False），
 * DB 里的 `experiments.playable` 只作展示兜底。
 */

import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { experiments } from "@/db/schema";
import { getDefinition } from "@/lib/engine";

export interface ExperimentRow {
  id: string;
  title: string;
  summary: string | null;
  steps: number;
  hours: number;
  kind: string;
  playable: boolean;
  sortOrder: number;
}

export async function listExperiments(): Promise<ExperimentRow[]> {
  const rows = await db
    .select({
      id: experiments.id,
      title: experiments.title,
      summary: experiments.summary,
      steps: experiments.steps,
      hours: experiments.hours,
      kind: experiments.kind,
      playable: experiments.playable,
      sortOrder: experiments.sortOrder,
    })
    .from(experiments)
    .orderBy(asc(experiments.sortOrder), asc(experiments.id));

  return rows.map((row) => ({
    ...row,
    playable: row.playable || getDefinition(row.id) !== undefined,
  }));
}

/** 路由用：该实验是否有可玩定义（没有就 404 EXPERIMENT_NOT_PLAYABLE）。 */
export function isPlayableExperiment(experimentId: string): boolean {
  return getDefinition(experimentId) !== undefined;
}
