/**
 * 数据库初始化：建表 + 播种实验元数据（幂等，可反复跑）。
 *
 * 两种宿主都能跑：
 * - 本地：PGlite（PGLITE_DIR，数据目录独占，跑之前先停掉 dev server）
 * - 扣子 / 任意真 PostgreSQL：设 DATABASE_URL（或 COZE_* 连接串）即走 postgres.js
 *
 * DDL 唯一来源：db/migrations/0001_init.sql（扣子部署同步的就是它）
 */
import fs from "node:fs";
import path from "node:path";

const DDL_PATH = path.resolve("db/migrations/0001_init.sql");
const DDL = fs.readFileSync(DDL_PATH, "utf8");

/** 大纲口径：10 个实验，学时合计 36；playable 表示已有可玩流程 */
const SEED = [
  { id: "exp01", no: 1, title: "仪器的认领、天平使用及溶液配制", summary: "洗涤、称量、定容、浓硫酸稀释", hours: 5, kind: "验证", steps: 7, playable: true },
  { id: "exp02", no: 2, title: "试剂级氯化钠制备", summary: "除杂、过滤、蒸发结晶、产率", hours: 5, kind: "验证", steps: 8, playable: false },
  { id: "exp03", no: 3, title: "醋酸电离度和电离常数测定", summary: "系列稀释、pH 计、Ka 计算", hours: 3, kind: "验证", steps: 7, playable: false },
  { id: "exp04", no: 4, title: "沉淀的生成与溶解平衡", summary: "沉淀制备、离心、分步沉淀、转化", hours: 4, kind: "综合", steps: 8, playable: false },
  { id: "exp05", no: 5, title: "氧化还原反应和电化学", summary: "原电池、盐桥、电动势", hours: 3, kind: "验证", steps: 8, playable: false },
  { id: "exp06", no: 6, title: "配合物的生成和性质", summary: "配位平衡、螯合物、稳定性比较", hours: 3, kind: "综合", steps: 8, playable: false },
  { id: "exp07", no: 7, title: "常见阳离子的分离与鉴定（一）", summary: "特征反应、分组分离、干扰排除", hours: 4, kind: "验证", steps: 8, playable: false },
  { id: "exp08", no: 8, title: "清点仪器，分析天平称量练习", summary: "固定质量称量、递减法、记录规范", hours: 3, kind: "验证", steps: 7, playable: false },
  { id: "exp09", no: 9, title: "酸碱标准溶液的配制与浓度比较", summary: "滴定管洗涤润洗、半滴与终点判定", hours: 3, kind: "验证", steps: 7, playable: true },
  { id: "exp10", no: 10, title: "盐酸标准溶液的标定与工业纯碱总碱度的测定", summary: "基准物质标定、双指示剂法测总碱度", hours: 3, kind: "设计", steps: 8, playable: false },
];

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.COZE_DATABASE_URL ||
  process.env.COZE_PG_URL ||
  process.env.COZE_POSTGRES_URL ||
  "";
const usePg = /^postgres(ql)?:\/\//i.test(DATABASE_URL.trim());

let exec;
let query;
let close;

if (usePg) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(DATABASE_URL, { max: 4, prepare: false, connect_timeout: 10 });
  exec = async (text) => {
    await sql.unsafe(text);
  };
  query = async (text, params) => {
    const rows = await sql.unsafe(text, params);
    return { rows };
  };
  close = () => sql.end({ timeout: 5 });
  console.log(`[db:init] 目标 PostgreSQL（${DATABASE_URL.replace(/:\/\/[^@]*@/, "://***@")}）`);
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.resolve(process.env.PGLITE_DIR ?? "./.pgdata");
  const client = new PGlite(dir);
  exec = (text) => client.exec(text);
  query = (text, params) => client.query(text, params);
  close = () => client.close();
  console.log(`[db:init] 目标 PGlite（${dir}）`);
}

await exec(DDL);

for (const s of SEED) {
  await query(
    `INSERT INTO experiments (id, title, summary, steps, hours, kind, playable, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       steps = EXCLUDED.steps,
       hours = EXCLUDED.hours,
       kind = EXCLUDED.kind,
       playable = EXCLUDED.playable,
       sort_order = EXCLUDED.sort_order`,
    [s.id, s.title, s.summary, s.steps, s.hours, s.kind, s.playable, s.no],
  );
}

const { rows } = await query(
  `SELECT id, title, hours, kind, playable, steps FROM experiments ORDER BY sort_order`,
);
console.log(`已建表并播种 ${rows.length} 条实验（DDL 来自 ${path.relative(process.cwd(), DDL_PATH)}）：`);
for (const r of rows) {
  console.log(` - ${r.id} ${r.title} · ${r.hours} 学时 · ${r.kind} · ${r.steps} 步${r.playable ? " · 可玩" : ""}`);
}
await close();
