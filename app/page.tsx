import { db } from "@/lib/db";
import { experiments } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  let rows: { id: string; title: string; steps: number }[] = [];
  let dbError: string | null = null;

  try {
    rows = await db.select().from(experiments);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm tracking-widest text-[var(--muted)]">CHEM LAB</p>
      <h1 className="mt-2 text-3xl font-semibold">无机及分析化学实验 · 虚拟实验平台</h1>
      <p className="mt-3 text-[var(--muted)]">
        骨架已起：Next.js App Router + PostgreSQL(PGlite) + Drizzle。下面这条数据是从数据库里读出来的。
      </p>

      <section className="mt-8 rounded-xl border border-[var(--line)] bg-white p-5">
        <h2 className="text-base font-medium">数据库连通检查</h2>
        {dbError ? (
          <p className="mt-2 text-sm text-red-600">读取失败：{dbError}</p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">连接正常，表为空（还没播种）。</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {rows.map((r) => (
              <li key={r.id}>
                <span className="font-mono text-[var(--muted)]">{r.id}</span> · {r.title} · {r.steps} 步
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
