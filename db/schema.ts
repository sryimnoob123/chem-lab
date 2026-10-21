import { pgTable, text, integer, boolean, timestamp, uuid, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";

/** 实验元数据：由 experiments/<id>/definition.ts 播种，页面只读 */
export const experiments = pgTable("experiments", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  steps: integer("steps").notNull().default(0),
  /** 学时（大纲：10 个实验合计 36） */
  hours: integer("hours").notNull().default(3),
  /** 验证 / 综合 / 设计 */
  kind: text("kind").notNull().default("验证"),
  /** 是否已实现可玩流程 */
  playable: boolean("playable").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 学生白名单：学号即账号，无需密码（与学院教务名单一致） */
export const students = pgTable("students", {
  studentNo: text("student_no").primaryKey(),
  name: text("name").notNull(),
  className: text("class_name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 学生每次实验的会话 */
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: text("experiment_id").notNull(),
    studentNo: text("student_no").notNull(),
    status: text("status").notNull().default("in_progress"),
    /** 演示导演台产生的数据，教师端默认过滤 */
    isDemo: boolean("is_demo").notNull().default(false),
    /** 交卷时落库的三段分与总分（0~100），避免教师端每次重算 */
    scorePre: integer("score_pre"),
    scoreOp: integer("score_op"),
    scoreReport: integer("score_report"),
    totalScore: integer("total_score"),
    /** 能力点掌握度、目标达成度等结构化结果，交卷时写入 */
    scoreDetail: jsonb("score_detail"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("runs_exp_student_idx").on(t.experimentId, t.studentNo),
    index("runs_student_idx").on(t.studentNo),
  ],
);

/** 每一步操作的时间线（含违规标记），导出与学情都靠它；操作分由它聚合，不另存 */
export const timeline = pgTable(
  "timeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    /** 同一步内的序号，用于幂等 */
    seq: integer("seq").notNull().default(0),
    actionType: text("action_type").notNull(),
    choiceId: text("choice_id").notNull().default(""),
    competency: text("competency").notNull().default("K1"),
    correct: boolean("correct").notNull().default(false),
    deduct: integer("deduct").notNull().default(0),
    payload: text("payload"),
    /** 旧字段保留：规则 id */
    violation: text("violation"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("timeline_run_step_seq_idx").on(t.runId, t.stepIndex, t.seq)],
);

/** 事故记录：安全复盘与教师端事故分布靠它 */
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    incidentId: text("incident_id").notNull(),
    level: text("level").notNull(),
    fx: text("fx").notNull().default(""),
    deduct: integer("deduct").notNull().default(0),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("incidents_run_idx").on(t.runId), index("incidents_level_idx").on(t.level)],
);

/** 前后测作答：预习 10% 与后测对照 */
export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    phase: text("phase").notNull(), // pre | post | transfer
    questionId: text("question_id").notNull(),
    answer: text("answer").notNull(),
    correct: boolean("correct").notNull().default(false),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("quiz_run_idx").on(t.runId, t.phase)],
);

/** 拼接式方案设计：学生拼出的方案 + 规则验证结果 + 可选 AI 点评 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentNo: text("student_no").notNull(),
    experimentId: text("experiment_id"),
    runId: uuid("run_id"),
    /** 步骤块顺序 + 参数块选择 */
    params: jsonb("params").notNull(),
    feasible: boolean("feasible").notNull().default(false),
    score: integer("score").notNull().default(0),
    /** 逐条问题：{ruleId, level, text} */
    issues: jsonb("issues").notNull(),
    /** AI 评估点评（离线模板也会写） */
    assessment: text("assessment"),
    assessmentOffline: boolean("assessment_offline").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("plans_student_idx").on(t.studentNo)],
);
