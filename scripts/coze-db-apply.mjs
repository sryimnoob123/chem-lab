/**
 * 把 db/migrations/0001_init.sql 应用到扣子数据库：分批（每批 6 条）+ 失败重试。
 * 用法：node scripts/coze-db-apply.mjs <db-id> [sqlPath]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const dbId = process.argv[2];
const sqlPath = process.argv[3] ?? "db/migrations/0001_init.sql";
if (!dbId) {
  console.error("用法: node scripts/coze-db-apply.mjs <db-id> [sqlPath]");
  process.exit(1);
}

const CLI_ENTRY = process.env.COZE_CLI_ENTRY ?? "E:/TOOLS/node/node_modules/@coze/cli/bin/main";
const BATCH = Number(process.env.SQL_BATCH ?? 6);
const RETRY = Number(process.env.SQL_RETRY ?? 4);

const raw = fs.readFileSync(sqlPath, "utf8");
const stripped = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const statements = stripped
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const batches = [];
for (let i = 0; i < statements.length; i += BATCH) batches.push(statements.slice(i, i + BATCH));

function runSql(sql) {
  const r = spawnSync(
    process.execPath,
    [CLI_ENTRY, "code", "db", "query", "--db-id", dbId, "--sql", sql, "--confirm", "--format", "json"],
    { encoding: "utf8", timeout: 180000 },
  );
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const isOk = r.status === 0 && !/"errorName"/.test(out);
  const desc = (/"desc":\s*"([^"]*)"/.exec(out) ?? [])[1] ?? out.slice(0, 120);
  return { isOk, desc };
}

console.log(`共 ${statements.length} 条语句 → ${batches.length} 批（每批 ${BATCH}），db=${dbId}`);

let okBatches = 0;
let failedBatches = 0;
for (const [i, batch] of batches.entries()) {
  const sql = batch.map((s) => `${s};`).join("\n");
  let result = { isOk: false, desc: "not run" };
  for (let attempt = 1; attempt <= RETRY; attempt++) {
    result = runSql(sql);
    if (result.isOk) break;
    // fetch failed / 网络抖动 → 等一下重试
    if (/fetch failed|timeout|ECONN/i.test(result.desc)) {
      console.log(`  [批 ${i + 1}] 第 ${attempt} 次网络失败，重试…`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    } else if (attempt < RETRY) {
      // 依赖未就绪之类，也重试一次
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  if (result.isOk) {
    okBatches++;
    console.log(`[批 ${i + 1}/${batches.length}] OK · ${batch.length} 条`);
  } else {
    failedBatches++;
    console.log(`[批 ${i + 1}/${batches.length}] FAIL · ${batch.map((s) => s.slice(0, 26)).join(" | ")} → ${result.desc}`);
  }
}

console.log(`\n完成：成功 ${okBatches} 批 · 失败 ${failedBatches} 批`);
process.exitCode = failedBatches ? 1 : 0;
