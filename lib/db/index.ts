import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

/**
 * 本地开发用 PGlite（Postgres 编译成 WASM，零安装，数据落 .pgdata/）。
 * 生产在扣子跑真 PostgreSQL：把这里换成 postgres.js 驱动、连平台注入的环境变量即可，
 * SQL 与 schema 完全一致（见 AGENTS.md §1）。
 *
 * 必须用绝对路径：Turbopack 下相对路径有时被解析成 URL 对象，PGlite 只接受 string。
 */
const dir = path.resolve(process.cwd(), process.env.PGLITE_DIR ?? "./.pgdata");

const globalForDb = globalThis as unknown as { __pg?: PGlite };

const client = globalForDb.__pg ?? new PGlite(dir);
// 生产 standalone 构建会把同一模块打进多个 chunk；必须无条件缓存到 globalThis，
// 否则 API 路由和 RSC 页面各自 new 一个 PGlite，出现“写入成功但报告读不到”的假象。
globalForDb.__pg = client;

export const db = drizzle(client, { schema });
export { client };
