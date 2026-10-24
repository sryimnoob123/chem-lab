"use client";

/**
 * 主题拆解（2026-10-24）
 *
 * brief 阶段多一块「这件事可以拆成几段」：4 段粗粒度任务 + 每段该挑哪些块。
 * 为什么不做成 28 步清单：那种清单学生照着点就行，等于替他做作业（用户原话「拆粗一点」）。
 * 数据来自 `POST /api/plan/decompose`；没有模型 key 时它返回模板拆解，这一块照常显示，
 * 只在右上角标一个「模板拆解」—— 不搞两套界面。
 *
 * 2026-10-24 二轮：原来请求失败会永久停在「正在拆…」，换主题还会短暂显示上一个主题的分段。
 * 现在按 topicId 派生渲染（换主题即视为「还没拿到」），旧请求 abort，失败给一句人话和「重试」。
 * 注意：effect 里**不**同步 setState（eslint react-hooks 会报 cascading render），
 * 所以状态都带着 topicId 一起存，渲染时比对。
 */

import { useCallback, useEffect, useState } from "react";
import { getPiece } from "@/lib/plan/pieces";
import type { PlanPhase } from "@/lib/plan/decompose";
import s from "./brief-decompose.module.css";

type DecomposePayload = { ok?: boolean; source?: "llm" | "template"; phases?: PlanPhase[] };

type Loaded = { topicId: string; phases: PlanPhase[]; source: "llm" | "template" };

export function BriefDecompose({ topicId }: { topicId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  /** 失败也要记住是哪个主题失败的，换主题不该继续显示上一个主题的错误 */
  const [failedFor, setFailedFor] = useState<string | null>(null);
  /** 点「重试」自增，用来重跑同一个 effect */
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<{ topicId: string; id: string | null }>({ topicId, id: null });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/plan/decompose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DecomposePayload;
      })
      .then((data) => {
        if (!data?.ok || !Array.isArray(data.phases) || data.phases.length === 0) throw new Error("BAD_PAYLOAD");
        setLoaded({ topicId, phases: data.phases, source: data.source ?? "template" });
        setFailedFor(null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailedFor(topicId);
      });

    return () => controller.abort();
  }, [topicId, attempt]);

  const retry = useCallback(() => {
    setFailedFor(null);
    setAttempt((n) => n + 1);
  }, []);

  const current = loaded && loaded.topicId === topicId ? loaded : null;
  const openId = open.topicId === topicId ? open.id : null;

  if (!current && failedFor === topicId) {
    return (
      <div className={s.wrap} data-demo-id="demo-plan-phases" data-state="error">
        <p className={s.loading}>拆解没拿到（网络或服务没有响应）。</p>
        <button type="button" className={s.retry} data-demo-id="demo-plan-phases-retry" onClick={retry}>
          重试
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={s.wrap} data-demo-id="demo-plan-phases" data-state="loading">
        <p className={s.loading}>正在把这件事拆成几段…</p>
      </div>
    );
  }

  return (
    <div className={s.wrap} data-demo-id="demo-plan-phases" data-state={current.source}>
      <div className={s.head}>
        <span className={s.kicker}>这件事可以拆成 {current.phases.length} 段</span>
        <span className={s.source} data-demo-id="demo-plan-phases-source">
          {current.source === "llm" ? "AI 拆解" : "模板拆解"}
        </span>
      </div>
      <ol className={s.list}>
        {current.phases.map((phase, index) => {
          const expanded = openId === phase.id;
          return (
            <li key={phase.id} className={s.item} data-open={expanded}>
              <button
                type="button"
                className={s.row}
                aria-expanded={expanded}
                data-demo-id={`demo-plan-phase-${phase.id}`}
                onClick={() => setOpen({ topicId, id: expanded ? null : phase.id })}
              >
                <span className={s.no}>{String(index + 1).padStart(2, "0")}</span>
                <span className={s.text}>
                  <strong>{phase.title}</strong>
                  <span className={s.note}>{phase.note}</span>
                </span>
                <span className={s.count}>{phase.pieceIds.length} 块</span>
              </button>
              {expanded ? (
                <ul className={s.pieces} data-demo-id={`demo-plan-phase-list-${phase.id}`}>
                  {phase.pieceIds.map((id) => (
                    <li key={id}>{getPiece(id)?.title ?? id}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
