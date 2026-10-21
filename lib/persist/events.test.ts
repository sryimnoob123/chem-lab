import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// 必须在 import lib/db 之前指向临时目录（PGlite 独占该目录），绝不碰 ./.pgdata
process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "chemlab-data-api-"));
(globalThis as Record<string, unknown>).__pg = undefined;

const { setupTestDb } = await import("./test-support");
const { db } = await import("@/lib/db");
const schema = await import("@/db/schema");
const { appendRunEvents } = await import("./events");
const { finishRun } = await import("./report");
const { eq } = await import("drizzle-orm");
const { computeOperationScore, computeWeightedTotal } = await import("@/lib/pedagogy/scoring");

let handle: Awaited<ReturnType<typeof setupTestDb>> | null = null;

beforeAll(async () => {
  handle = await setupTestDb();
}, 120_000);

afterAll(async () => {
  await handle?.cleanup();
});

const WEIGH = { type: "weigh", choiceId: "step1-weigh", competency: "A1" };
const BARE_HANDS = { type: "weigh", choiceId: "step1-bare-hands-naoh", competency: "A1" };

let studentSeq = 0;

async function seedRun(): Promise<string> {
  studentSeq += 1;
  const studentNo = `2023${String(studentSeq).padStart(4, "0")}`;
  await db.insert(schema.students).values({ studentNo, name: `学生${studentSeq}`, className: "化学2301" });
  const rows = await db
    .insert(schema.runs)
    .values({ experimentId: "exp09", studentNo })
    .returning({ id: schema.runs.id });
  const runId = rows[0]?.id;
  if (!runId) throw new Error("failed to create run");
  return runId;
}

async function timelineOf(runId: string) {
  return db.select().from(schema.timeline).where(eq(schema.timeline.runId, runId));
}

async function incidentsOf(runId: string) {
  return db.select().from(schema.incidents).where(eq(schema.incidents.runId, runId));
}

describe("events：批量提交与幂等", () => {
  it("正常动作落一行 timeline；同批重复提交不再新增", async () => {
    const runId = await seedRun();

    const first = await appendRunEvents(runId, [WEIGH]);
    expect(first.events.some((event) => event.kind === "stateChanged")).toBe(true);
    expect(first.incidents).toEqual([]);
    expect(await timelineOf(runId)).toHaveLength(1);

    const second = await appendRunEvents(runId, [WEIGH]);
    expect(second.events.some((event) => event.kind === "invalid")).toBe(true);
    expect(second.incidents).toEqual([]);
    expect(await timelineOf(runId)).toHaveLength(1);
  });

  it("陷阱动作只落一条事故；重复提交不再扣分/不再落事故", async () => {
    const runId = await seedRun();

    const first = await appendRunEvents(runId, [BARE_HANDS]);
    expect(first.incidents).toHaveLength(1);
    expect(first.incidents[0]?.incidentId).toBe("exp09-H2");
    expect(first.incidents[0]?.level).toBe("L3");

    const timelineRows = await timelineOf(runId);
    expect(timelineRows).toHaveLength(1);
    expect(timelineRows[0]?.correct).toBe(false);
    expect(timelineRows[0]?.deduct).toBe(10);

    const incidentRows = await incidentsOf(runId);
    expect(incidentRows).toHaveLength(1);
    expect(incidentRows[0]?.incidentId).toBe("exp09-H2");
    expect(incidentRows[0]?.deduct).toBe(10);
    expect(incidentRows[0]?.fx).toBe("burn");

    const second = await appendRunEvents(runId, [BARE_HANDS]);
    expect(second.incidents).toEqual([]);
    expect(await timelineOf(runId)).toHaveLength(1);
    expect(await incidentsOf(runId)).toHaveLength(1);
  });
});

describe("finish：交卷计分", () => {
  it("total_score 与 scoring.ts 直接算的一致，且二次交卷幂等", async () => {
    const runId = await seedRun();
    await appendRunEvents(runId, [BARE_HANDS]);

    const bundle = await finishRun(runId);
    expect(bundle.run.status).toBe("finished");

    const { preview, operation, report, total } = bundle.scores;
    if (preview === null || operation === null || report === null || total === null) {
      throw new Error("finish 后三段分不应为空");
    }

    const directOperation = computeOperationScore({
      violations: [],
      incidents: [{ incidentId: "exp09-H2", level: "L3", deduct: 10, terminate: false }],
    });
    expect(operation).toBe(directOperation.score);
    expect(operation).toBe(90);

    const weighted = computeWeightedTotal({ preview, operation, report });
    expect(total).toBe(Math.round(weighted.total));

    const rows = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
    const persisted = rows[0];
    expect(persisted?.totalScore).toBe(total);
    expect(persisted?.scorePre).toBe(preview);
    expect(persisted?.scoreOp).toBe(operation);
    expect(persisted?.scoreReport).toBe(report);
    expect(persisted?.finishedAt).toBeInstanceOf(Date);
    expect(typeof bundle.scores.detail?.competency.A1).toBe("number");
    expect(bundle.scores.detail?.objectives.objective1).toBeGreaterThanOrEqual(0);

    const again = await finishRun(runId);
    expect(again.scores.total).toBe(total);
    expect(await timelineOf(runId)).toHaveLength(1);
  });
});
