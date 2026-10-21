"use client";

/**
 * 事故注入：一键把实验推进到事故所在步并触发陷阱动作。
 *
 * 走现有接口，不新增调试 API：
 * 1) POST /api/runs（同学生同实验复用未完成 run）
 * 2) POST /api/runs/<id>/events，提交「前置动作 + 陷阱动作」
 * 另外给一个 `?hazard=` 深链，方便手动打开实验页复现。
 */

import { useState } from "react";
import Link from "next/link";
import type { DevHazard } from "./types";
import styles from "./devtools.module.css";

interface ActionResponse {
  ok?: boolean;
  runId?: string;
  error?: string;
}

interface EventResponse {
  ok?: boolean;
  error?: string;
  events?: Array<{ kind?: string; reason?: string }>;
  incidents?: Array<{ incidentId?: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function DevHazardList({
  experimentId,
  hazards,
}: {
  experimentId: string;
  hazards: DevHazard[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function inject(hazard: DevHazard) {
    setBusyId(hazard.incidentId);
    setMessage("");
    try {
      const runRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experimentId }),
      });
      const runBody: unknown = await runRes.json().catch(() => ({}));
      const runData = isRecord(runBody) ? (runBody as ActionResponse) : {};
      if (!runRes.ok || typeof runData.runId !== "string") {
        setMessage(`建 run 失败：${runData.error ?? runRes.status}`);
        return;
      }

      const runId = runData.runId;
      try {
        window.localStorage.setItem("chem-lab:dev:runId", runId);
      } catch {
        /* 隐私模式忽略 */
      }

      const actions = [...hazard.prelude, hazard.trigger];
      const eventRes = await fetch(`/api/runs/${runId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: actions }),
      });
      const eventBody: unknown = await eventRes.json().catch(() => ({}));
      const eventData = isRecord(eventBody) ? (eventBody as EventResponse) : {};
      if (!eventRes.ok) {
        setMessage(`提交失败：${eventData.error ?? eventRes.status}`);
        return;
      }

      const invalid = (eventData.events ?? []).find((event) => event.kind === "invalid");
      const hit = (eventData.incidents ?? [])
        .map((incident) => incident.incidentId)
        .filter((id): id is string => typeof id === "string");

      if (invalid) {
        setMessage(`未命中：${invalid.reason ?? "invalid"}（该 run 可能不在起点，先在实验页重开）`);
      } else if (hit.length > 0) {
        setMessage(`已触发 ${hit.join("、")} · run ${runId.slice(0, 8)}`);
      } else {
        setMessage(`动作已提交，未命中事故 · run ${runId.slice(0, 8)}`);
      }
    } catch {
      setMessage("注入请求失败");
    } finally {
      setBusyId(null);
    }
  }

  if (hazards.length === 0) {
    return <p className={styles.hint}>该实验定义里没有可注入的 hazard。</p>;
  }

  return (
    <div className={styles.hazards} data-dev="hazards">
      {hazards.map((hazard) => (
        <div key={hazard.incidentId} className={styles.hazard} data-dev-hazard={hazard.incidentId}>
          <span className={`${styles.level} ${styles[`level${hazard.level}`] ?? ""}`}>{hazard.level}</span>
          <span className={styles.hazardTitle}>{hazard.title}</span>
          <span className={styles.mono}>{hazard.incidentId}</span>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busyId !== null}
            onClick={() => void inject(hazard)}
            data-dev="inject"
            data-incident={hazard.incidentId}
          >
            {busyId === hazard.incidentId ? "注入中…" : "注入"}
          </button>
          <Link
            className={styles.link}
            href={`/exp/${experimentId}?force=1&hazard=${hazard.incidentId}`}
            data-dev="hazard-link"
          >
            带 hazard 打开
          </Link>
        </div>
      ))}
      {message ? (
        <p className={styles.message} role="status" data-dev="hazard-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
