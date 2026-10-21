/**
 * app/dev/page.tsx —— 开发者调试面板（仅本地调试，正式部署不暴露）
 *
 * 开关（服务端判断，见 devtoolsEnabled）：
 * - DEVTOOLS=1 / true  → 强制开启（生产也可显式打开）
 * - DEVTOOLS=0 / false → 强制关闭
 * - 未设置 → 仅非 production 开启
 * 关闭时整页 notFound()（404），且全站没有任何入口链接指向 /dev。
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { experiments as experimentsTable, runs } from "@/db/schema";
import { getDefinition } from "@/lib/engine";
import { getStudent, isTeacher } from "@/lib/session";
import { DevPanel } from "@/components/devtools/dev-panel";
import type { DevExperiment, DevEnvInfo, DevSessionInfo } from "@/components/devtools/types";
import { buildHazards } from "./debug-data";

export const metadata: Metadata = {
  title: "开发者调试面板",
  robots: { index: false, follow: false },
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 生产默认关闭；DEVTOOLS=1 显式开启，DEVTOOLS=0 显式关闭。 */
function devtoolsEnabled(): boolean {
  const flag = process.env.DEVTOOLS?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "on") return true;
  if (flag === "0" || flag === "false" || flag === "off") return false;
  return process.env.NODE_ENV !== "production";
}

export default async function DevPage() {
  if (!devtoolsEnabled()) notFound();

  const [student, teacher] = await Promise.all([getStudent(), isTeacher()]);
  const session: DevSessionInfo = { student, teacher };

  const experimentRows = await db
    .select({
      id: experimentsTable.id,
      title: experimentsTable.title,
      steps: experimentsTable.steps,
      playable: experimentsTable.playable,
      sortOrder: experimentsTable.sortOrder,
    })
    .from(experimentsTable)
    .orderBy(asc(experimentsTable.sortOrder), asc(experimentsTable.id));

  const inProgress = new Map<string, { runId: string; status: string }>();
  if (student) {
    const runRows = await db
      .select({
        id: runs.id,
        experimentId: runs.experimentId,
        status: runs.status,
        startedAt: runs.startedAt,
      })
      .from(runs)
      .where(eq(runs.studentNo, student.studentNo))
      .orderBy(desc(runs.startedAt));
    for (const run of runRows) {
      if (run.status !== "in_progress" || inProgress.has(run.experimentId)) continue;
      inProgress.set(run.experimentId, { runId: run.id, status: run.status });
    }
  }

  const experiments: DevExperiment[] = experimentRows.map((row) => {
    const definition = getDefinition(row.id);
    return {
      id: row.id,
      title: row.title,
      steps: definition?.steps.length ?? row.steps,
      playable: Boolean(definition) || row.playable,
      currentRun: inProgress.get(row.id) ?? null,
      hazards: buildHazards(definition),
    };
  });

  const env: DevEnvInfo = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    flag: process.env.DEVTOOLS,
  };

  return <DevPanel env={env} session={session} experiments={experiments} />;
}
