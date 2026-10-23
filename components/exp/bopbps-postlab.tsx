"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getCurriculum } from "@/lib/pedagogy/curriculum";
import { scoreStage } from "@/lib/pedagogy/curriculum/types";

const S = {
  card: {
    border: "1px solid var(--line, #dbe5f0)",
    borderRadius: 14,
    background: "var(--card, #fff)",
    padding: 18,
    boxShadow: "0 1px 2px rgba(18,35,59,.05), 0 8px 24px rgba(18,35,59,.05)",
  } as const,
  label: { fontSize: "var(--type-meta)", letterSpacing: ".08em", color: "var(--ink-2)", fontWeight: 500 },
  body: { fontSize: "var(--type-body)", lineHeight: 1.65, color: "var(--ink-2)", margin: 0 },
};

/** BOPPPS 后测（P · Post-assessment）：交卷后的后测一屏，提交后给分与逐题解析。
 *  - `onSubmit`：交卷后的独立后测页用它拿到分数并放出门到报告页（app/exp/[id]/postlab）；
 *  - `readOnly`：报告页里只做「后测回顾」—— 列出答案与解析，不再提供作答按钮
 *    （用户 2026-10-23：后测和评分不能挤在同一屏，报告页不再当考场）。 */
export function BopbpsPostLab({
  expId,
  onSubmit,
  readOnly = false,
  postScore = null,
}: {
  expId: string;
  onSubmit?: (score: number) => void;
  readOnly?: boolean;
  /** 回顾时显示那次后测的成绩（从后测页带过来，报告页不再重算） */
  postScore?: number | null;
}) {
  const c = useMemo(() => getCurriculum(expId), [expId]);
  const [manualPicked, setManualPicked] = useState<Record<string, string>>({});
  const [manualDone, setManualDone] = useState(false);
  const searchParams = useSearchParams();
  /**
   * 一键演示（?auto=1）：自动按正确答案作答并提交，报告才能给到 90+。
   * 这里用派生值而不是 effect 里同步 setState —— 后者会触发级联渲染告警（lint error）。
   */
  const autoDemo = searchParams.get("auto") === "1";
  const autoPicked = useMemo(() => {
    if (!autoDemo || !c?.post.length) return null;
    const all: Record<string, string> = {};
    for (const q of c.post) all[q.id] = q.answer;
    return all;
  }, [autoDemo, c]);
  const picked = autoPicked ?? manualPicked;
  const done = readOnly || autoPicked !== null || manualDone;

  if (!c || !c.post.length) return null;

  const answered = c.post.every((q) => picked[q.id]);
  const score = scoreStage(c.post, picked);

  return (
    <section style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={S.label}>{readOnly ? `P · 后测回顾（${c.post.length} 题）` : `P · 后测（${c.post.length} 题）`}</div>
        <div className="mono" style={{ fontSize: "var(--type-meta)", color: done ? (score >= 67 ? "#1a7f4b" : "#9a6a12") : "var(--ink-2)" }}>
          {readOnly ? (postScore !== null ? `${postScore} / 100` : "已作答") : done ? `${score} / 100` : `${Object.keys(picked).length}/${c.post.length}`}
        </div>
      </div>

      {c.post.map((q, i) => {
        const pick = picked[q.id];
        const ok = pick === q.answer;
        return (
          <div key={q.id} style={{ borderTop: i ? "1px solid #eef2f7" : "none", paddingTop: i ? 14 : 0, marginTop: i ? 14 : 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span
                className="mono"
                style={{
                  flex: "none",
                  fontSize: "var(--type-meta)",
                  color: "#1f5fa8",
                  background: "#eaf2fb",
                  border: "1px solid #d3e3f6",
                  borderRadius: 6,
                  padding: "1px 6px",
                }}
              >
                {q.competency}
              </span>
              <p style={{ ...S.body, color: "var(--ink)", fontWeight: 500 }}>{q.stem}</p>
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {q.options.map((o) => {
                const on = pick === o.key;
                const isAnswer = done && o.key === q.answer;
                const isWrong = done && on && !ok;
                return (
                  <button
                    key={o.key}
                    type="button"
                    data-demo-id={`bopbps-post-${q.id}-${o.key}`}
                    onClick={() => !done && setManualPicked((p) => ({ ...p, [q.id]: o.key }))}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      textAlign: "left",
                      minHeight: 44,
                      padding: "9px 12px",
                      borderRadius: 10,
                      cursor: done ? "default" : "pointer",
                      fontSize: "var(--type-body)",
                      lineHeight: 1.6,
                      color: "var(--ink)",
                      background: isAnswer ? "#e6f6ed" : isWrong ? "#fdeceb" : on ? "#eaf2fb" : "#fff",
                      border: `1px solid ${isAnswer ? "#a9dcc0" : isWrong ? "#f0b8b3" : on ? "#9dc0e8" : "#dbe5f0"}`,
                    }}
                  >
                    <span className="mono" style={{ flex: "none", fontWeight: 700, color: isAnswer ? "#1a7f4b" : isWrong ? "#a33" : "#7b8a9c" }}>
                      {o.key}
                    </span>
                    <span>{o.text}</span>
                  </button>
                );
              })}
            </div>
            {done ? (
              <p style={{ ...S.body, marginTop: 8, color: ok ? "#1a7f4b" : "#9a6a12", whiteSpace: "pre-line" }}>
                {ok ? "✓ 正确 · " : `答案 ${q.answer} · `}
                {q.explanation}
              </p>
            ) : null}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        {readOnly ? null : done ? (
          <>
            <span style={{ fontSize: "var(--type-meta)", color: "var(--ink-2)" }}>
              后测完成 · 得分 {score} / 100
            </span>
            <button
              type="button"
              data-demo-id="bopbps-post-reset"
              onClick={() => {
                setManualDone(false);
                setManualPicked({});
              }}
              className="btn btn--secondary"
              style={{ minHeight: 44, padding: "0 14px" }}
            >
              重做后测
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-demo-id="bopbps-post-submit"
              disabled={!answered}
              onClick={() => {
                setManualDone(true);
                onSubmit?.(score);
              }}
              className="btn btn--primary"
              style={{ minHeight: 44, padding: "0 18px" }}
            >
              提交后测
            </button>
            <span style={{ fontSize: "var(--type-meta)", color: "var(--ink-2)" }}>{answered ? "提交后看逐题解析" : "答完 3 题后提交"}</span>
          </>
        )}
      </div>

      <p style={{ ...S.body, marginTop: 12, fontSize: "var(--type-meta)", color: "var(--ink-2)" }}>{c.summary}</p>
    </section>
  );
}
