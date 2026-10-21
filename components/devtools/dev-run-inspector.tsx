"use client";

/**
 * runId 查看器：从 URL `?runId=` 或 localStorage 读，调现有 GET /api/runs/<id>
 * 展示 run 状态与最近 5 条 timeline。
 */

import { useEffect, useState } from "react";
import styles from "./devtools.module.css";
import type { DevTimelineRow } from "./types";

const STORE_KEY = "chem-lab:dev:runId";

interface RunSnapshot {
  status: string;
  experimentId: string;
  timeline: DevTimelineRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTimeline(value: unknown): DevTimelineRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is DevTimelineRow => {
    if (!isRecord(row)) return false;
    return typeof row.stepIndex === "number" && typeof row.choiceId === "string";
  });
}

export function DevRunInspector() {
  const [runId, setRunId] = useState("");
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let saved = "";
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("runId") ?? "";
      saved = fromUrl || window.localStorage.getItem(STORE_KEY) || "";
    } catch {
      saved = "";
    }
    // queueMicrotask 里 setState，避免 effect 同步 setState 触发级联渲染（react-hooks 规则）
    queueMicrotask(() => setRunId(saved));
  }, []);

  async function load(id: string) {
    const trimmed = id.trim();
    if (!trimmed) {
      setMessage("先填 runId");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (/^[0-9a-f-]{36}$/i.test(trimmed)) window.localStorage.setItem(STORE_KEY, trimmed);
      const res = await fetch(`/api/runs/${encodeURIComponent(trimmed)}`);
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok || !isRecord(body) || !isRecord(body.run)) {
        setSnapshot(null);
        const code = isRecord(body) && typeof body.error === "string" ? body.error : String(res.status);
        setMessage(`读取失败：${code}`);
        return;
      }
      const run = body.run;
      setSnapshot({
        status: typeof run.status === "string" ? run.status : "unknown",
        experimentId: typeof run.experimentId === "string" ? run.experimentId : "",
        timeline: readTimeline(body.timeline),
      });
      setMessage("");
    } catch {
      setSnapshot(null);
      setMessage("读取请求失败");
    } finally {
      setBusy(false);
    }
  }

  const recent = snapshot ? snapshot.timeline.slice(-5) : [];

  return (
    <section className={styles.card} data-dev="run-inspector">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>当前 run</h2>
        <span className={styles.hint}>从 URL ?runId= 或 localStorage 读取</span>
      </div>

      <div className={styles.row}>
        <input
          className={styles.input}
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
          placeholder="runId（uuid）"
          spellCheck={false}
          data-dev="run-input"
        />
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void load(runId)}
          disabled={busy}
          data-dev="run-load"
        >
          {busy ? "读取中…" : "读取"}
        </button>
        {message ? (
          <span className={styles.message} role="status" data-dev="run-message">
            {message}
          </span>
        ) : null}
      </div>

      {snapshot ? (
        <>
          <p className={styles.hint} data-dev="run-status">
            {snapshot.experimentId} · {snapshot.status} · timeline {snapshot.timeline.length} 条
          </p>
          {recent.length > 0 ? (
            <table className={styles.table} data-dev="run-timeline">
              <thead>
                <tr>
                  <th>步</th>
                  <th>动作</th>
                  <th>结果</th>
                  <th>扣分</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={`${row.stepIndex}-${row.seq}`}>
                    <td className={styles.mono}>{row.stepIndex}</td>
                    <td className={styles.mono}>{row.choiceId || row.actionType}</td>
                    <td>{row.correct ? "正确" : "错误"}</td>
                    <td className={styles.mono}>{row.deduct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.hint}>暂无 timeline</p>
          )}
        </>
      ) : null}
    </section>
  );
}
