/**
 * 本地开发库初始化：建表 + 播种实验元数据（幂等，可反复跑）。
 * 生产用扣子的 PostgreSQL，走 db/migrations 的 DDL，不跑这个脚本。
 *
 * 注意：PGlite 对数据目录是独占的 —— 跑这个之前先停掉 dev server。
 */
import { PGlite } from "@electric-sql/pglite";

const DIR = process.env.PGLITE_DIR ?? "./.pgdata";

const DDL = `
CREATE TABLE IF NOT EXISTS experiments (
  id text PRIMARY KEY,
  title text NOT NULL,
  summary text,
  steps integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  student_no text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_index integer NOT NULL,
  action text NOT NULL,
  payload text,
  violation text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS timeline_run_idx ON timeline (run_id, step_index);
`;

const SEED = [
  ["exp09", "酸碱标准溶液的配制与浓度比较", "滴定分析基本操作与半滴技术", 6],
  ["exp10", "盐酸标准溶液的标定与工业纯碱总碱度的测定", "基准物质标定 + 双指示剂法测总碱度", 8],
];

const client = new PGlite(DIR);
await client.exec(DDL);

for (const [id, title, summary, steps] of SEED) {
  await client.query(
    `INSERT INTO experiments (id, title, summary, steps)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET title = $2, summary = $3, steps = $4`,
    [id, title, summary, steps],
  );
}

const { rows } = await client.query(`SELECT id, title, steps FROM experiments ORDER BY id`);
console.log(`已建表并播种 ${rows.length} 条实验：`);
for (const r of rows) console.log(` - ${r.id} ${r.title} (${r.steps} 步)`);
await client.close();
