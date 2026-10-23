"use client";

/**
 * 主题拆解（2026-10-24）
 *
 * brief 阶段多一块「这件事可以拆成几段」：4 段粗粒度任务 + 每段该挑哪些块。
 * 为什么不做成 28 步清单：那种清单学生照着点就行，等于替他做作业（用户原话「拆粗一点」）。
 * 数据来自 `POST /api/plan/decompose`；没有模型 key 时它返回模板拆解，这一块照常显示，
 * 只在右上角标一个「模板拆解」—— 不搞两套界面。
 */

import { useEffect, useState } from "react";
import { getPiece } from "@/lib/plan/pieces";
import type { PlanPhase } from "@/lib/plan/decompose";
import s from "./brief-decompose.module.css";

export function BriefDecompose({ topicId }: { topicId: string }) {
  const [phases, setPhases] = useState<PlanPhase[] | null>(null);
  const [source, setSource] = useState<"llm" | "template" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/plan/decompose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; source?: "llm" | "template"; phases?: PlanPhase[] } | null) => {
        if (cancelled || !data?.ok || !Array.isArray(data.phases)) return;
        setPhases(data.phases);
        setSource(data.source ?? "template");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  if (!phases) {
    return (
      <div className={s.wrap} data-demo-id="demo-plan-phases" data-state="loading">
        <p className={s.loading}>正在把这件事拆成几段…</p>
      </div>
    );
  }

  return (
    <div className={s.wrap} data-demo-id="demo-plan-phases" data-state={source ?? "template"}>
      <div className={s.head}>
        <span className={s.kicker}>这件事可以拆成 {phases.length} 段</span>
        <span className={s.source} data-demo-id="demo-plan-phases-source">
          {source === "llm" ? "AI 拆解" : "模板拆解"}
        </span>
      </div>
      <ol className={s.list}>
        {phases.map((phase, index) => {
          const open = openId === phase.id;
          return (
            <li key={phase.id} className={s.item} data-open={open}>
              <button
                type="button"
                className={s.row}
                aria-expanded={open}
                data-demo-id={`demo-plan-phase-${phase.id}`}
                onClick={() => setOpenId(open ? null : phase.id)}
              >
                <span className={s.no}>{String(index + 1).padStart(2, "0")}</span>
                <span className={s.text}>
                  <strong>{phase.title}</strong>
                  <span className={s.note}>{phase.note}</span>
                </span>
                <span className={s.count}>{phase.pieceIds.length} 块</span>
              </button>
              {open ? (
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
