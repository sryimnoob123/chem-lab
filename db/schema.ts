import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";

/** 实验元数据：由 experiments/<id>/definition.ts 播种，页面只读 */
export const experiments = pgTable("experiments", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  steps: integer("steps").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 学生每次实验的会话 */
export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: text("experiment_id").notNull(),
  studentNo: text("student_no").notNull(),
  status: text("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/** 每一步操作的时间线（含违规标记），导出与学情都靠它 */
export const timeline = pgTable("timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  stepIndex: integer("step_index").notNull(),
  action: text("action").notNull(),
  payload: text("payload"),
  violation: text("violation"),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});
