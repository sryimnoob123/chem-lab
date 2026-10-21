-- 0001_init.sql —— chem-lab 初始 schema（幂等，可重复执行）
-- 扣子编程部署时「只同步 schema」，所以这里必须是可重跑的增量 DDL，不写 DROP。

-- ============ experiments ============
CREATE TABLE IF NOT EXISTS experiments (
  id text PRIMARY KEY,
  title text NOT NULL,
  summary text,
  steps integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS hours integer NOT NULL DEFAULT 3;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT '验证';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS playable boolean NOT NULL DEFAULT false;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- ============ students（学号白名单，登录即学号） ============
CREATE TABLE IF NOT EXISTS students (
  student_no text PRIMARY KEY,
  name text NOT NULL,
  class_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ runs ============
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  student_no text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS score_pre integer;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS score_op integer;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS score_report integer;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS total_score integer;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS score_detail jsonb;
CREATE INDEX IF NOT EXISTS runs_exp_student_idx ON runs (experiment_id, student_no);
CREATE INDEX IF NOT EXISTS runs_student_idx ON runs (student_no);

-- ============ timeline（操作分由它聚合，不另存分数） ============
CREATE TABLE IF NOT EXISTS timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_index integer NOT NULL,
  action text NOT NULL DEFAULT '',
  payload text,
  violation text,
  at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE timeline ADD COLUMN IF NOT EXISTS seq integer NOT NULL DEFAULT 0;
-- 老库的 action 列是 NOT NULL 且无默认值，补默认值，否则新代码不写它会报错
ALTER TABLE timeline ALTER COLUMN action SET DEFAULT '';
ALTER TABLE timeline ALTER COLUMN action DROP NOT NULL;
ALTER TABLE timeline ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT '';
ALTER TABLE timeline ADD COLUMN IF NOT EXISTS choice_id text NOT NULL DEFAULT '';
ALTER TABLE timeline ADD COLUMN IF NOT EXISTS competency text NOT NULL DEFAULT 'K1';
ALTER TABLE timeline ADD COLUMN IF NOT EXISTS correct boolean NOT NULL DEFAULT false;
ALTER TABLE timeline ADD COLUMN IF NOT EXISTS deduct integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS timeline_run_idx ON timeline (run_id, step_index);
CREATE UNIQUE INDEX IF NOT EXISTS timeline_run_step_seq_idx ON timeline (run_id, step_index, seq);

-- ============ incidents（安全复盘与教师端事故分布） ============
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_index integer NOT NULL,
  incident_id text NOT NULL,
  level text NOT NULL,
  fx text NOT NULL DEFAULT '',
  deduct integer NOT NULL DEFAULT 0,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_run_idx ON incidents (run_id);
CREATE INDEX IF NOT EXISTS incidents_level_idx ON incidents (level);

-- ============ quiz_answers（预习 10% 与后测对照） ============
CREATE TABLE IF NOT EXISTS quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  phase text NOT NULL,
  question_id text NOT NULL,
  answer text NOT NULL,
  correct boolean NOT NULL DEFAULT false,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_run_idx ON quiz_answers (run_id, phase);

-- ============ plans（拼接式方案设计） ============
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_no text NOT NULL,
  experiment_id text,
  run_id uuid,
  params jsonb NOT NULL,
  feasible boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  issues jsonb NOT NULL,
  assessment text,
  assessment_offline boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_student_idx ON plans (student_no);
