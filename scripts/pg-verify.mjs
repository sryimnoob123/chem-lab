#!/usr/bin/env node
/**
 * scripts/pg-verify.mjs —— 用真 PostgreSQL 17 验证 chem-lab 的 DDL 与查询
 *
 * 背景：开发期用的是 PGlite（嵌入式 WASM），本脚本另起一个一次性 PG 17 实例，
 * 跑 db/migrations/0001_init.sql、对照 db/schema.ts、做写入/读回与类型检查。
 *
 * 用法：node scripts/pg-verify.mjs
 * 可选环境变量：PG_BIN=PG17 的 bin 目录；PGPORT=端口（默认 5544）
 * 依赖：只用 node:child_process / node:fs / node:path，不装任何 npm 包。
 * 副作用：仅创建/复用 .pgdata-pg17/（已被 .gitignore 的 .pgdata-* 规则覆盖），结束优雅停止。
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PGPORT || 5544);
const DB = "chemlab_verify";
const DATA_DIR_NAME = ".pgdata-pg17";
const MIGRATION_REL = path.join("db", "migrations", "0001_init.sql");
const SCHEMA_REL = path.join("db", "schema.ts");
const T0 = Date.now();

/* ============================== 基础工具 ============================== */

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, SCHEMA_REL))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(`无法从 ${process.cwd()} 向上找到项目根（需含 package.json + db/schema.ts）`);
}

const ROOT = findProjectRoot();
const DATA_DIR = path.join(ROOT, DATA_DIR_NAME);
const LOG_FILE = path.join(DATA_DIR, "pg.log");
const MIGRATION = path.join(ROOT, MIGRATION_REL);
const SCHEMA_TS = path.join(ROOT, SCHEMA_REL);

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const tail = (s, max = 4000) => {
  const t = String(s ?? "").trim();
  return t.length > max ? `…\n${t.slice(-max)}` : t;
};
const indent = (s) => String(s).split(/\r?\n/).map((l) => `    ${l}`).join("\n");
const readText = (file) => { try { return fs.readFileSync(file, "utf8"); } catch { return ""; } };
const exe = (name) => path.join(PG_BIN_DIR, process.platform === "win32" ? `${name}.exe` : name);

function run(cmd, args, { input, timeout = 180000, stdio = "pipe" } = {}) {
  const startedAt = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "buffer",
    timeout,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    input: stdio === "pipe" ? input : undefined,
    stdio,
    env: { ...process.env, PGCLIENTENCODING: "UTF8" },
  });
  if (process.env.PGVERIFY_TRACE) {
    const label = [path.basename(cmd), ...args].join(" ").slice(0, 120);
    console.error(`[TRACE] ${label} → ${Date.now() - startedAt}ms exit=${r.status ?? "null"}`);
  }
  return {
    code: r.status,
    signal: r.signal,
    error: r.error,
    out: (r.stdout || Buffer.alloc(0)).toString("utf8"),
    err: (r.stderr || Buffer.alloc(0)).toString("utf8"),
  };
}

function showFail(label, r) {
  console.error(`[FAIL] ${label}（exit=${r.code ?? "null"}${r.signal ? `, signal=${r.signal}` : ""}）`);
  if (r.error) console.error(`    spawn: ${r.error.message}`);
  if (r.err.trim()) console.error(`    stderr:\n${indent(tail(r.err))}`);
  if (r.out.trim()) console.error(`    stdout:\n${indent(tail(r.out))}`);
}

function logTail(lines = 25) {
  const t = readText(LOG_FILE).replace(/\r/g, "").trim();
  return t ? t.split("\n").slice(-lines).join("\n") : "";
}

/* ============================== 找 PG17 ============================== */

function pgBinComplete(dir) {
  const names = process.platform === "win32" ? ["initdb.exe", "pg_ctl.exe", "psql.exe"] : ["initdb", "pg_ctl", "psql"];
  return names.every((n) => fs.existsSync(path.join(dir, n)));
}

function detectPgBin() {
  const candidates = [];
  for (const k of ["PG_BIN", "PG17_BIN", "POSTGRES_BIN"]) if (process.env[k]) candidates.push(process.env[k]);
  // 默认安装路径；本机实际是 E:\TOOLS\pgsql（EnterpriseDB 安装器注册项也指向这里）
  candidates.push("C:\\Program Files\\PostgreSQL\\17\\bin", "E:\\TOOLS\\pgsql\\bin", "D:\\PostgreSQL\\17\\bin");
  for (const base of ["C:\\Program Files\\PostgreSQL", "D:\\Program Files\\PostgreSQL", "E:\\TOOLS"]) {
    try {
      for (const d of fs.readdirSync(base)) candidates.push(path.join(base, d, "bin"), path.join(base, d));
    } catch { /* 目录不存在正常 */ }
  }
  const where = run(process.platform === "win32" ? "where.exe" : "which", ["initdb"], { timeout: 10000 });
  if (where.code === 0) {
    for (const line of where.out.replace(/\r/g, "").split("\n")) {
      if (line.trim()) candidates.push(path.dirname(line.trim()));
    }
  }
  const reg = run("reg.exe", ["query", "HKLM\\SOFTWARE\\PostgreSQL\\Installations", "/s", "/v", "Base Directory"], { timeout: 10000 });
  if (reg.code === 0) {
    for (const m of reg.out.matchAll(/Base Directory\s+REG_SZ\s+(.+)/g)) candidates.push(path.join(m[1].trim(), "bin"));
  }
  const seen = new Set();
  for (const c of candidates) {
    const abs = path.resolve(c);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (pgBinComplete(abs)) return abs;
  }
  return null;
}

const PG_BIN_DIR = detectPgBin();

/* ============================== 结果记录 ============================== */

const checks = [];
function check(pass, name, detail = "") {
  checks.push({ pass: Boolean(pass), name, detail });
  console.log(`[${pass ? "OK" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  return Boolean(pass);
}
const info = (msg) => console.log(`[INFO] ${msg}`);

/* ============================== schema.ts 解析 ============================== */

/** 返回 Map<table, [{db, tsType, pk, notNull, defaultRandom, defaultNow}]> */
function parseSchema(src) {
  const tables = new Map();
  const re = /pgTable\(\s*"([^"]+)"\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    let depth = 1;
    let i = re.lastIndex;
    let quote = null;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (quote) {
        if (c === "\\") i += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth += 1;
      else if (c === "}") { depth -= 1; if (depth === 0) break; }
    }
    const body = src.slice(re.lastIndex, i);
    const cols = [];
    for (const line of body.split(/\r?\n/)) {
      const cm = line.match(/^\s*\w+:\s*(\w+)\(\s*"([a-z0-9_]+)"(.*)$/);
      if (!cm) continue;
      const rest = cm[3];
      cols.push({
        db: cm[2],
        tsType: cm[1],
        pk: /\.primaryKey\(\)/.test(rest),
        notNull: /\.notNull\(\)/.test(rest),
        defaultRandom: /\.defaultRandom\(\)/.test(rest),
        defaultNow: /\.defaultNow\(\)/.test(rest),
      });
    }
    if (cols.length) tables.set(name, cols);
  }
  return tables;
}

/** 迁移文件缺失时的兜底：从 schema.ts 推导最小 DDL（不写新 migration 文件） */
function deriveMinimalDDL(schemaMap) {
  const types = { text: "text", integer: "integer", boolean: "boolean", uuid: "uuid", jsonb: "jsonb", timestamp: "timestamptz" };
  const chunks = [];
  for (const [table, cols] of schemaMap) {
    const defs = cols.map((c) => {
      let d = `  ${c.db} ${types[c.tsType] || "text"}`;
      if (c.pk) d += " PRIMARY KEY";
      else if (c.notNull) d += " NOT NULL";
      if (c.defaultRandom) d += " DEFAULT gen_random_uuid()";
      if (c.defaultNow) d += " DEFAULT now()";
      return d;
    });
    chunks.push(`CREATE TABLE IF NOT EXISTS ${table} (\n${defs.join(",\n")}\n);`);
  }
  return chunks.join("\n\n");
}

/* ============================== 临时实例 ============================== */

function startServer() {
  const args = ["-D", DATA_DIR, "-o", `-p ${PORT} -c listen_addresses=${HOST}`, "-l", LOG_FILE, "-w", "-t", "60", "start"];
  // stdio:ignore 很关键：后台 postgres 会继承 pg_ctl 的管道句柄，用 pipe 会让 spawnSync
  // 一直等到 postgres 退出（实测卡 90s）。启动失败的信息统一从 pg.log 读。
  return run(exe("pg_ctl"), args, { timeout: 75000, stdio: "ignore" });
}

function stopServer() {
  return run(exe("pg_ctl"), ["-D", DATA_DIR, "stop", "-m", "fast", "-w", "-t", "60"], { timeout: 90000 });
}

function psql(sql, { db = "postgres", tuples = false, file = null, timeout = 120000 } = {}) {
  const args = ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", HOST, "-p", String(PORT), "-U", "postgres"];
  if (db) args.push("-d", db);
  if (tuples) args.push("-tA", "-F", "\t");
  if (file) args.push("-f", file);
  // SQL 一律走 stdin（UTF-8 字节），避开 Windows 下 argv 代码页对中文/多语句的影响
  return run(exe("psql"), args, { input: file ? undefined : Buffer.from(sql, "utf8"), timeout });
}

function parseRows(r) {
  const text = r.out.replace(/\r/g, "").trim();
  return text ? text.split("\n").map((line) => line.split("\t")) : [];
}

function waitReady() {
  for (let i = 0; i < 30; i += 1) {
    if (psql("SELECT 1;", { tuples: true, timeout: 8000 }).code === 0) return true;
    sleep(300);
  }
  return false;
}

function removeDataDir() {
  for (let i = 0; i < 6; i += 1) {
    try {
      fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return true;
    } catch (e) {
      if (i === 5) {
        console.error(`[FAIL] 删除 ${DATA_DIR_NAME} 失败：${e.message}`);
        return false;
      }
      sleep(500);
    }
  }
  return false;
}

/** 幂等启动：先停旧实例 → 复用可启动的目录 → 不行就删掉重建 */
function ensureServer() {
  if (fs.existsSync(DATA_DIR)) {
    stopServer(); // 上次残留实例先优雅停掉；没在跑时退出码非 0，可忽略
    const dirVersion = readText(path.join(DATA_DIR, "PG_VERSION")).trim();
    if (dirVersion === "17") {
      const st = startServer();
      if (st.code === 0 && waitReady()) {
        return check(true, "临时 PG 17 实例启动", `复用 ${DATA_DIR_NAME}，${HOST}:${PORT}`);
      }
      showFail("复用已有数据目录启动失败（将重建）", st);
      const log = logTail();
      if (log) console.error(indent(`pg.log 末尾：\n${log}`));
    } else if (dirVersion) {
      info(`已有数据目录版本为 ${dirVersion}（非 17），删除重建`);
    } else {
      info(`已有数据目录不完整（缺 PG_VERSION），删除重建`);
    }
  }
  if (fs.existsSync(DATA_DIR) && !removeDataDir()) {
    return check(false, "临时 PG 17 实例启动", "无法清理旧数据目录");
  }
  const init = run(exe("initdb"), ["-D", DATA_DIR, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C", "--no-sync"], { timeout: 180000 });
  if (init.code !== 0) {
    showFail("initdb 初始化临时数据目录", init);
    return check(false, "临时 PG 17 实例启动", "initdb 失败");
  }
  const st = startServer();
  if (st.code !== 0 || !waitReady()) {
    showFail("pg_ctl start 启动临时实例", st);
    const log = logTail();
    if (log) console.error(indent(`pg.log 末尾：\n${log}`));
    if (/bind|Address already in use|could not create shared memory/i.test(log)) {
      console.error(`[FAIL] 端口 ${PORT} 可能被其他实例占用；请先停掉占用进程，或用 PGPORT=别的端口 重跑。`);
    }
    return check(false, "临时 PG 17 实例启动", `${HOST}:${PORT} 未就绪`);
  }
  return check(true, "临时 PG 17 实例启动", `新建 ${DATA_DIR_NAME}，${HOST}:${PORT}`);
}

/* ============================== 验证主体 ============================== */

function verifySchema(schemaMap) {
  const expectedTables = [...schemaMap.keys()].sort();

  // 1) 建库（每次全新建库，保证可重复运行；WITH (FORCE) 断开残留连接）
  const create = psql(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE);\nCREATE DATABASE ${DB};`);
  const dbOk = check(create.code === 0, `CREATE DATABASE ${DB}`, "UTF8 临时库");
  if (!dbOk) showFail("创建验证库", create);

  if (dbOk) {
    const enc = psql(`SELECT pg_encoding_to_char(encoding), datcollate FROM pg_database WHERE datname = '${DB}';`, { tuples: true });
    if (enc.code === 0) info(`验证库编码/排序规则：${parseRows(enc)[0]?.join(" / ") ?? "?"}`);
  }

  // 2) DDL：优先真 migration；缺失时按 schema.ts 推导最小 DDL（只读，不写文件）
  if (!fs.existsSync(MIGRATION)) {
    info(`${MIGRATION_REL} 不存在，改用 db/schema.ts 推导的最小 DDL`);
    const r = psql(deriveMinimalDDL(schemaMap), { db: DB });
    if (!check(r.code === 0, "按 schema.ts 推导最小 DDL 建表", "无 migration 文件")) showFail("推导 DDL 执行", r);
  } else {
    const m1 = psql(null, { db: DB, file: MIGRATION });
    const ok1 = check(m1.code === 0, "执行 db/migrations/0001_init.sql", `${fs.statSync(MIGRATION).size} bytes`);
    if (!ok1) showFail("迁移第 1 次执行", m1);
    const m2 = psql(null, { db: DB, file: MIGRATION });
    if (!check(m2.code === 0, "同一 migration 重复执行（幂等）", "第 2 次执行")) showFail("迁移第 2 次执行", m2);
  }

  // 3) 表清单逐一对照
  const tbl = psql("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1;", { db: DB, tuples: true });
  const actualTables = parseRows(tbl).map((r) => r[0]).filter(Boolean);
  const missingTables = expectedTables.filter((t) => !actualTables.includes(t));
  const extraTables = actualTables.filter((t) => !expectedTables.includes(t));
  const tablesOk = tbl.code === 0 && missingTables.length === 0 && extraTables.length === 0;
  const tableDetail = [
    `库内 ${actualTables.length} 张：${actualTables.join(", ") || "(空)"}`,
    missingTables.length ? `缺失：${missingTables.join(", ")}` : "",
    extraTables.length ? `多余：${extraTables.join(", ")}` : "",
  ].filter(Boolean).join("；");
  check(tablesOk, "表清单与 schema.ts 对照", tableDetail);
  if (tbl.code !== 0) showFail("读取表清单", tbl);

  // 4) 列逐一对照（多余列只告警不判失败：不影响可移植性）
  const col = psql("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;", { db: DB, tuples: true });
  const dbCols = new Map();
  for (const [t, c] of parseRows(col)) {
    if (!dbCols.has(t)) dbCols.set(t, []);
    dbCols.get(t).push(c);
  }
  const missingCols = [];
  const extraCols = [];
  for (const [t, cols] of schemaMap) {
    const actual = dbCols.get(t) || [];
    for (const c of cols) if (!actual.includes(c.db)) missingCols.push(`${t}.${c.db}`);
    for (const a of actual) if (!cols.some((c) => c.db === a)) extraCols.push(`${t}.${a}`);
  }
  check(col.code === 0 && missingCols.length === 0, "列与 schema.ts 对照",
    `缺失 ${missingCols.length} 列${extraCols.length ? `，DDL 多余 ${extraCols.length} 列` : ""}`);
  if (missingCols.length) info(`缺失列：${missingCols.join(", ")}`);
  if (extraCols.length) info(`DDL 多余列（schema.ts 未声明）：${extraCols.join(", ")}`);

  // 5) 每张表 count(*)
  for (const t of expectedTables) {
    const r = psql(`SELECT count(*) FROM "${t}";`, { db: DB, tuples: true });
    const n = r.code === 0 ? (parseRows(r)[0]?.[0] ?? "?") : "ERROR";
    check(r.code === 0, `SELECT count(*) FROM ${t}`, `${n} 行`);
    if (r.code !== 0) showFail(`count(${t})`, r);
  }

  // 6) 写入学生 + run，再用 JOIN 查回
  const ins = psql(`
INSERT INTO students (student_no, name, class_name)
VALUES ('20261021', '验证学生', '化学2301')
ON CONFLICT (student_no) DO UPDATE SET name = EXCLUDED.name, class_name = EXCLUDED.class_name
RETURNING student_no, name;

INSERT INTO runs (experiment_id, student_no)
VALUES ('exp01', '20261021')
RETURNING id, status, started_at;
`, { db: DB, tuples: true });
  const insRows = parseRows(ins);
  const runId = insRows[1]?.[0] || "";
  const insOk = ins.code === 0 && insRows[0]?.[1] === "验证学生" && /^[0-9a-f-]{36}$/.test(runId) && insRows[1]?.[1] === "in_progress";
  check(insOk, "写入学生 + run（真实列名/默认值）",
    insOk ? `student_no=20261021, name=验证学生, run_id=${runId}, status=in_progress` : "插入结果或默认值不符");
  if (!insOk) showFail("插入学生/run", ins);

  const rb = psql(`
SELECT r.experiment_id, r.student_no, r.status, s.name, (r.score_detail IS NULL)::text
FROM runs r JOIN students s ON s.student_no = r.student_no
WHERE r.student_no = '20261021'
ORDER BY r.started_at DESC
LIMIT 1;
`, { db: DB, tuples: true });
  const row = parseRows(rb)[0] || [];
  const rbOk = rb.code === 0 && row[0] === "exp01" && row[1] === "20261021" && row[2] === "in_progress" && row[3] === "验证学生" && row[4] === "true";
  check(rbOk, "JOIN 查回学生 + run", rbOk ? row.join(" | ") : "查询结果不符");
  if (!rbOk) showFail("查回学生/run", rb);

  // 7) jsonb 写入/读取
  const jb = psql(`
UPDATE runs SET score_detail = '{"pre": 88, "op": 90, "detail": {"K1": 1}}'::jsonb
WHERE student_no = '20261021'
RETURNING score_detail->>'op' AS op, jsonb_typeof(score_detail->'detail') AS detail_type;
`, { db: DB, tuples: true });
  const jrow = parseRows(jb)[0] || [];
  const jbOk = jb.code === 0 && jrow[0] === "90" && jrow[1] === "object";
  check(jbOk, "jsonb 读写（runs.score_detail）", jbOk ? `op=${jrow[0]}, detail_type=${jrow[1]}` : "jsonb 结果不符");
  if (!jbOk) showFail("jsonb 读写", jb);

  // 8) timeline 写入（唯一索引 + 新列 action_type/competency）
  const tl = psql(`
INSERT INTO timeline (run_id, step_index, seq, action_type, choice_id, competency, correct, deduct, payload)
VALUES ('${runId}', 0, 0, 'add_reagent', 'beaker-1', 'K2', true, 0, '{"reagent":"CuSO4"}')
ON CONFLICT (run_id, step_index, seq) DO UPDATE SET payload = EXCLUDED.payload
RETURNING seq, action_type, competency;
`, { db: DB, tuples: true });
  const trow = parseRows(tl)[0] || [];
  const tlOk = tl.code === 0 && trow[1] === "add_reagent" && trow[2] === "K2";
  check(tlOk, "timeline 写入（唯一索引 / action_type）", tlOk ? `seq=${trow[0]}, action_type=${trow[1]}` : "timeline 结果不符");
  if (!tlOk) showFail("timeline 写入", tl);

  // 9) 类型与常用函数
  const ty = psql(`
SELECT pg_typeof(now())::text, pg_typeof('{}'::jsonb)::text, pg_typeof(gen_random_uuid())::text,
       jsonb_typeof('{"a":1}'::jsonb),
       (SELECT count(*) FROM pg_proc WHERE proname IN ('now', 'gen_random_uuid', 'jsonb_typeof', 'to_jsonb'));
`, { db: DB, tuples: true });
  const tv = parseRows(ty)[0] || [];
  const tyOk = ty.code === 0 && tv[0] === "timestamp with time zone" && tv[1] === "jsonb" && tv[2] === "uuid" && tv[3] === "object" && Number(tv[4]) >= 4;
  check(tyOk, "常用类型/函数可用性（now/jsonb/uuid）",
    tyOk ? `now→${tv[0]}, jsonb→${tv[1]}, gen_random_uuid→${tv[2]}` : "类型或函数缺失");
  if (!tyOk) showFail("类型/函数检查", ty);
}

/* ============================== 主流程 ============================== */

let serverUp = false;
let pgVersion = "unknown";

try {
  if (!PG_BIN_DIR) {
    check(false, "找到 PostgreSQL 17 二进制", "未找到 initdb/pg_ctl/psql；可用 PG_BIN 指定 bin 目录");
  } else {
    const v = run(exe("initdb"), ["--version"], { timeout: 20000 });
    const m = `${v.out}${v.err}`.match(/(\d+\.\d+(?:\.\d+)?)/);
    pgVersion = m ? m[1] : "unknown";
    check(v.code === 0, "找到 PostgreSQL 17 二进制", `${PG_BIN_DIR}（initdb ${pgVersion}）`);

    const schemaMap = parseSchema(readText(SCHEMA_TS));
    check(schemaMap.size > 0, "解析 db/schema.ts 得到表定义", `${schemaMap.size} 张表：${[...schemaMap.keys()].join(", ")}`);

    serverUp = ensureServer();

    if (serverUp) {
      const ver = psql("SHOW server_version;", { db: "postgres", tuples: true });
      if (ver.code === 0) pgVersion = parseRows(ver)[0]?.[0] || pgVersion;
      verifySchema(schemaMap);
    }
  }
} catch (e) {
  console.error(`[FAIL] 未捕获异常：${e?.stack || e}`);
  checks.push({ pass: false, name: "未捕获异常" });
} finally {
  // 成功与否都停；stop 失败再重试一次，避免残留实例占端口
  const hasPid = fs.existsSync(path.join(DATA_DIR, "postmaster.pid"));
  if (PG_BIN_DIR && (serverUp || hasPid)) {
    let st = stopServer();
    if (st.code !== 0 && serverUp) {
      sleep(1000);
      st = stopServer();
    }
    const ok = st.code === 0;
    if (serverUp) check(ok, "优雅停止临时实例（pg_ctl stop -m fast）", ok ? "已停止，端口释放" : "停止失败，可能残留进程");
    if (!ok) showFail("pg_ctl stop", st);
    serverUp = false;
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log("");
  console.log(`通过 ${passed}/${total}`);
  console.log(`总耗时=${((Date.now() - T0) / 1000).toFixed(1)}s`);
  console.log(`PG_VERSION=${pgVersion}`);
  process.exitCode = total > 0 && passed === total ? 0 : 1;
}
