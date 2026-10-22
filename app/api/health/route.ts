/**
 * GET /api/health —— 部署自检（扣子导入后第一件事就是打这个接口）。
 *
 * 为什么需要：扣子上最容易出的一类故障是「平台没注入数据库凭据 → 代码回落到 PGlite →
 * 线上容器只读 → 所有 /api 500」，而页面本身还能渲染，看起来像“评分坏了 / 数据丢了”。
 * 这里一次性把三件事说清楚：连的哪种库、表建没建、种子数据在不在。
 *
 * 返回：{ ok, dbMode, counts, tables?, error? }
 *   - dbMode = "postgres" 才是对的（线上 PGlite 必错）
 *   - counts.experiments = 0 → 建表成功但没播种
 *   - error 有值 → 直接把这行贴回来即可定位
 */

import { sql } from "drizzle-orm";
import { db, dbMode } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const rows = await db.execute<{
      experiments: number;
      students: number;
      runs: number;
    }>(sql`
      select
        (select count(*)::int from experiments) as experiments,
        (select count(*)::int from students) as students,
        (select count(*)::int from runs) as runs
    `);
    const counts = (rows as unknown as { rows?: Array<Record<string, number>> }).rows?.[0] ??
      (rows as unknown as Array<Record<string, number>>)[0] ?? { experiments: 0, students: 0, runs: 0 };

    return Response.json({
      ok: true,
      dbMode,
      counts: {
        experiments: Number(counts.experiments ?? 0),
        students: Number(counts.students ?? 0),
        runs: Number(counts.runs ?? 0),
      },
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        dbMode,
        error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : String(error).slice(0, 300),
        hint:
          dbMode === "pglite"
            ? "平台没有注入数据库连接串，代码回落到了 PGlite；线上容器只读，必须配 DATABASE_URL 或 COZE_PG_* 变量"
            : "能连库但查询失败，通常是没执行 db/migrations/0001_init.sql（表不存在）",
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
