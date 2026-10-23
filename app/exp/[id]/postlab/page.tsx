import Link from "next/link";
import { notFound } from "next/navigation";
import { getDefinition } from "@/lib/engine";
import { latestRunId } from "@/lib/persist/latest-run";
import { PostlabStage } from "./postlab-stage";
import styles from "../report/report.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ runId?: string | string[]; auto?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const definition = getDefinition(id);
  return { title: definition ? `后测 · ${definition.title}` : "后测" };
}

/**
 * 交卷之后的第一屏：只做后测（BOPPPS 的 P）。
 * 用户 2026-10-23：先把后测做完，再进评分 —— 分数不能和后测挤在同一屏。
 */
export default async function PostlabPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const definition = getDefinition(id);
  if (!definition) notFound();

  const query = await searchParams;
  const requested = typeof query.runId === "string" ? query.runId.trim() : "";
  const runId = requested || (await latestRunId(id));
  const auto = query.auto === "1" || query.auto === "true";

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.back} href="/experiments">
          ← 实验列表
        </Link>
        <span className={styles.kicker}>实验 {definition.id.replace(/^exp/, "")} · 后测</span>
      </header>

      <div className={styles.sheet}>
        <h1 className={styles.title}>{definition.title}</h1>
        <PostlabStage expId={definition.id} runId={runId} auto={auto} />
      </div>
    </main>
  );
}
