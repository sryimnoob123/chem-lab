/**
 * 真 PostgreSQL 模式验证：证明 lib/db/index.ts 的 PG 分支 + db/init.mjs 能在一起跑。
 *
 * 做法：initdb 一个临时实例（trust，端口 55432）→ 建库 → DATABASE_URL 跑 db/init.mjs
 *      → 再用 DATABASE_URL 起 standalone server（3011）→ 打 /api/experiments 应为 10 条
 * 全程不碰 3001 与本地 .pgdata。
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PG_BIN = process.env.PG_BIN ?? "E:\\TOOLS\\pgsql\\bin";
const PORT = process.env.PG_PORT ?? "55432";
const DB = "chemlab_pgmode";
const DATA_DIR = path.join(os.tmpdir(), `chem-lab-pg-${Date.now()}`);
const exe = (name) => path.join(PG_BIN, process.platform === "win32" ? `${name}.exe` : name);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 120000, ...opts });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

if (!fs.existsSync(exe("initdb"))) {
  console.error(`找不到 initdb：${exe("initdb")}`);
  process.exit(1);
}

console.log(`[1/6] initdb → ${DATA_DIR}`);
const init = run(exe("initdb"), ["-D", DATA_DIR, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C", "--no-sync"]);
if (init.code !== 0) {
  console.error(init.out.slice(-800));
  process.exit(1);
}

console.log(`[2/6] 启动临时 PostgreSQL :${PORT}`);
const start = run(exe("pg_ctl"), ["-D", DATA_DIR, "-o", `-p ${PORT}`, "-l", path.join(DATA_DIR, "pg.log"), "start", "-w", "-t", "60"], {
  stdio: "ignore",
});
if (start.code !== 0) {
  console.error("pg_ctl start 失败");
  process.exit(1);
}

const url = `postgres://postgres@127.0.0.1:${PORT}/${DB}`;

try {
  console.log(`[3/6] createdb ${DB}`);
  const created = run(exe("psql"), ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${DB};`]);
  if (created.code !== 0) throw new Error(created.out);

  console.log(`[4/6] DATABASE_URL=... node db/init.mjs`);
  const initDb = spawnSync(process.execPath, ["db/init.mjs"], {
    env: { ...process.env, DATABASE_URL: url, PGLITE_DIR: "" },
    encoding: "utf8",
    timeout: 120000,
  });
  console.log((initDb.stdout ?? "").trim().split("\n").slice(0, 3).join("\n"));
  if (initDb.status !== 0) throw new Error(initDb.stderr ?? "db/init.mjs 失败");

  const count = run(exe("psql"), ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", DB, "-t", "-A", "-c", "SELECT count(*) FROM experiments;"]);
  console.log(`[5/6] experiments 行数 = ${count.out.trim()}`);

  console.log(`[6/6] 用 DATABASE_URL 起 standalone :3011`);
  const child = spawn(process.execPath, [".next/standalone/server.js"], {
    env: { ...process.env, DATABASE_URL: url, PORT: "3011", HOSTNAME: "127.0.0.1", PGLITE_DIR: "" },
    stdio: "ignore",
    detached: false,
  });

  const deadline = Date.now() + 60000;
  let ok = false;
  let lastErr = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch("http://localhost:3011/api/experiments", { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const json = await res.json();
        const n = Array.isArray(json) ? json.length : 0;
        console.log(`   /api/experiments → HTTP ${res.status}，${n} 条`);
        ok = n === 10;
        if (!ok) lastErr = `条数 ${n} ≠ 10`;
        break;
      }
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = String(e).slice(0, 80);
    }
  }

  child.kill();
  console.log(ok ? "\n✅ PG 模式验证通过（10 条实验从真 PostgreSQL 读出）" : `\n❌ PG 模式失败：${lastErr}`);
  process.exitCode = ok ? 0 : 1;
} catch (e) {
  console.error("失败：", String(e).slice(0, 400));
  process.exitCode = 1;
} finally {
  run(exe("pg_ctl"), ["-D", DATA_DIR, "stop", "-m", "fast", "-w", "-t", "60"], { stdio: "ignore" });
  // Windows 上 PG 释放文件句柄有一小段延迟，清理失败不影响验证结论
  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    console.log(`（临时目录未清理，可手动删除：${DATA_DIR}）`);
  }
}
