/**
 * 演示班级数据：给教师端学情总览/名单管理/学生明细提供可看的真实结构。
 *
 * - 幂等：按 student_no 主键 upsert；runs 先删该批学生的再插，可反复跑
 * - 只影响本地/演示库；生产导入真实名单后，用 `--purge` 清掉演示学生
 * - 跑之前先停 dev server（PGlite 独占）
 *
 * 用法：
 *   node db/seed-demo.mjs            # 播种 40 人演示班级
 *   node db/seed-demo.mjs --purge    # 清掉演示学生及其 runs
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

const DIR = path.resolve(process.env.PGLITE_DIR ?? "./.pgdata");
const PURGE = process.argv.includes("--purge");
const DEMO_PREFIX = "2025"; // 学号前缀：2025 级

/** 确定性随机（同一份数据每次跑出来一样，便于对比截图） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261020);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const SURNAMES = "王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭";
const GIVEN = [
  "梓涵", "思远", "雨桐", "浩然", "嘉怡", "子墨", "一诺", "欣怡", "宇航", "若曦",
  "明轩", "诗涵", "俊杰", "梦琪", "泽宇", "佳宁", "天佑", "思琪", "博文", "语彤",
  "子豪", "雅雯", "锦程", "书瑶", "皓轩", "静怡", "文轩", "婉清", "晨阳", "可欣",
  "亦凡", "梦瑶", "少阳", "清扬", "书航", "思彤", "云帆", "欣然", "立诚", "思含",
];

const CLASSES = ["化工 25-1 班", "化工 25-2 班"];
const INCIDENTS = [
  { id: "exp09-L1-001", level: "L1", label: "俯视读数" },
  { id: "exp09-L1-002", level: "L1", label: "滴定管未润洗" },
  { id: "exp09-L2-001", level: "L2", label: "气泡未排尽" },
  { id: "exp09-L2-002", level: "L2", label: "半滴未靠壁" },
  { id: "exp09-L3-001", level: "L3", label: "滴定过量" },
  { id: "exp09-L4-001", level: "L4", label: "水入酸（热液喷溅）" },
];

/**
 * 两种宿主：本地 PGlite（默认）或真 PostgreSQL（DATABASE_URL）。
 * 扣子线上就是真库，所以播种脚本必须两条路都能跑；
 * postgres.js 不支持 `$1` 之外的 API，用 unsafe + 包一层 { rows } 兼容 PGlite 调用形态。
 */
const client = process.env.DATABASE_URL
  ? (() => {
      const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 4, onnotice: () => {} });
      return {
        query: async (text, params) => ({ rows: await sql.unsafe(text, params ?? []) }),
        close: () => sql.end({ timeout: 5 }),
      };
    })()
  : new PGlite(DIR);

if (PURGE) {
  const gone = await client.query(
    `DELETE FROM runs WHERE student_no LIKE $1 RETURNING id`,
    [`${DEMO_PREFIX}%`],
  );
  await client.query(`DELETE FROM students WHERE student_no LIKE $1`, [`${DEMO_PREFIX}%`]);
  console.log(`已清除演示学生：runs ${gone.rows.length} 条`);
  await client.close();
  process.exit(0);
}

const now = Date.now();
let done = 0;
let doing = 0;

for (let i = 1; i <= 40; i++) {
  const studentNo = `${DEMO_PREFIX}${String(101 + i - 1).padStart(4, "0")}`;
  const name = i === 1 ? "周若曦" : pick(SURNAMES.split("")) + pick(GIVEN);
  const className = i <= 20 ? CLASSES[0] : CLASSES[1];

  await client.query(
    `INSERT INTO students (student_no, name, class_name) VALUES ($1,$2,$3)
     ON CONFLICT (student_no) DO UPDATE SET name = $2, class_name = $3`,
    [studentNo, name, className],
  );

  await client.query(`DELETE FROM runs WHERE student_no = $1`, [studentNo]);

  // 26 已完成 / 9 进行中 / 5 未开始
  const roll = i % 40;
  const bucket = roll < 26 ? "done" : roll < 35 ? "doing" : "not_started";
  if (bucket === "not_started") continue;

  const startedAt = new Date(now - int(30, 500) * 60_000);
  const isDone = bucket === "done";
  const finishedAt = isDone ? new Date(startedAt.getTime() + int(25, 70) * 60_000) : null;

  const steps = 7;
  const progress = isDone ? steps : int(1, 6);
  const correct = isDone ? int(6, 9) : int(1, 4);
  const wrong = isDone ? int(0, 3) : int(0, 2);
  const opBase = Math.max(40, Math.min(97, 100 - wrong * 6 - int(0, 8)));
  const pre = int(60, 100);
  const report = int(70, 96);
  const total = Math.round(pre * 0.1 + opBase * 0.4 + report * 0.5);

  const run = await client.query(
    `INSERT INTO runs (experiment_id, student_no, status, is_demo, score_pre, score_op, score_report, total_score, score_detail, started_at, finished_at)
     VALUES ('exp09',$1,$2,false,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      studentNo,
      isDone ? "finished" : "in_progress",
      isDone ? pre : null,
      isDone ? opBase : null,
      isDone ? report : null,
      isDone ? total : null,
      isDone
        ? JSON.stringify({
            competency: {
              K1: 0.5 + rnd() * 0.5, K2: 0.4 + rnd() * 0.6, K3: 0.45 + rnd() * 0.5,
              S1: 0.35 + rnd() * 0.6, S2: 0.4 + rnd() * 0.55, S3: 0.3 + rnd() * 0.65,
              A1: 0.3 + rnd() * 0.6, A2: 0.35 + rnd() * 0.6,
            },
            objectives: { knowledge: true, skill: rnd() > 0.25, attitude: rnd() > 0.35 },
          })
        : null,
      startedAt,
      finishedAt,
    ],
  );
  const runId = run.rows[0].id;

  const rows = ["wash", "weigh", "dissolve", "transfer", "titrate", "readInstrument", "compute"];
  for (let s = 0; s < progress; s++) {
    const ok = s < correct;
    await client.query(
      `INSERT INTO timeline (run_id, step_index, seq, action, action_type, choice_id, competency, correct, deduct, at)
       VALUES ($1,$2,1,$3,$3,$4,$5,$6,$7,$8)`,
      [
        runId, s, rows[s % rows.length], `demo-${rows[s % rows.length]}-${s + 1}`,
        pick(["K1", "K2", "S1", "S2", "A1"]), ok, ok ? 0 : int(2, 6),
        new Date(startedAt.getTime() + s * int(40, 120) * 1000),
      ],
    );
  }

  const incidentCount = isDone ? int(0, 3) : int(0, 2);
  for (let k = 0; k < incidentCount; k++) {
    const inc = pick(INCIDENTS);
    await client.query(
      `INSERT INTO incidents (run_id, step_index, incident_id, level, fx, deduct, at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        runId, int(0, progress - 1), inc.id, inc.level,
        inc.level === "L4" ? "boil-over" : "none",
        inc.level === "L1" ? 2 : inc.level === "L2" ? 5 : inc.level === "L3" ? 8 : 20,
        new Date(startedAt.getTime() + int(1, 40) * 60_000),
      ],
    );
  }

  if (isDone) done++;
  else doing++;
}

const summary = await client.query(
  `SELECT count(*)::int AS students FROM students WHERE student_no LIKE $1`,
  [`${DEMO_PREFIX}%`],
);
console.log(
  `演示班级已播种：学生 ${summary.rows[0].students} 人 · 已完成 ${done} · 进行中 ${doing} · 未开始 ${40 - done - doing}`,
);
await client.close();
