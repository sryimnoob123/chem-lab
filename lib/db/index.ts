import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import type { PgDatabase } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * 数据库入口：一套 schema，两种宿主。
 *
 * - 本地开发：PGlite（Postgres 编译成 WASM，零安装，数据落 .pgdata/）。
 * - 扣子平台 / 任何真 PostgreSQL：postgres.js + Drizzle，连接串来自环境变量。
 *
 * 扣子编程内置的数据库就是标准 PostgreSQL，连接凭据由平台以 COZE_ 前缀的系统环境变量注入
 * （见 docs/扣子部署适配.md）。这里把常见命名都探测一遍，导上去不需要再改代码。
 */

/** 按优先级探测连接串：通用 DATABASE_URL → 平台注入的 COZE_* → 拆开的 PG* 变量 */
function resolveDatabaseUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.COZE_DATABASE_URL,
    process.env.COZE_PG_URL,
    process.env.COZE_POSTGRES_URL,
    process.env.COZE_DB_URL,
    process.env.POSTGRES_URL,
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value && /^postgres(ql)?:\/\//i.test(value)) return value;
  }

  // 有些平台只给拆开的几段
  const host = process.env.COZE_PG_HOST ?? process.env.PGHOST;
  const user = process.env.COZE_PG_USER ?? process.env.PGUSER;
  const password = process.env.COZE_PG_PASSWORD ?? process.env.PGPASSWORD;
  const database = process.env.COZE_PG_DATABASE ?? process.env.PGDATABASE;
  if (host && user && database) {
    const port = process.env.COZE_PG_PORT ?? process.env.PGPORT ?? "5432";
    const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
    return `postgres://${auth}@${host}:${port}/${database}`;
  }
  return null;
}

const databaseUrl = resolveDatabaseUrl();

const globalForDb = globalThis as unknown as {
  __pg?: PGlite;
  __sql?: ReturnType<typeof postgres>;
};

/**
 * 生产 standalone 构建会把同一模块打进多个 chunk，必须无条件缓存到 globalThis，
 * 否则 API 路由和 RSC 页面各自 new 一个连接，出现"写入成功但报告读不到"的假象。
 */
function createPgClient(url: string) {
  if (!globalForDb.__sql) {
    globalForDb.__sql = postgres(url, {
      max: Number(process.env.PGPOOL_MAX ?? 10),
      idle_timeout: 20,
      connect_timeout: 10,
      // 托管实例走连接池，关掉 prepare 以兼容池切换
      prepare: false,
    });
  }
  return globalForDb.__sql;
}

function createPgliteClient() {
  // 必须用绝对路径：Turbopack 下相对路径有时被解析成 URL 对象，PGlite 只接受 string。
  const dir = path.resolve(process.cwd(), process.env.PGLITE_DIR ?? "./.pgdata");
  if (!globalForDb.__pg) globalForDb.__pg = new PGlite(dir);
  return globalForDb.__pg;
}

/** 两种驱动的实例类型不同，对调用方暴露同一套 PgDatabase 接口 */
type Db = PgDatabase<never, typeof schema>;

export const dbMode: "postgres" | "pglite" = databaseUrl ? "postgres" : "pglite";

export const db: Db = (
  databaseUrl ? drizzlePg(createPgClient(databaseUrl), { schema }) : drizzlePglite(createPgliteClient(), { schema })
) as unknown as Db;

/** 仅 PGlite 模式有底层 client；PG 模式下由 postgres.js 的连接池接管 */
export const client = globalForDb.__pg;
