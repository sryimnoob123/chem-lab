"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PIECE_KINDS, PIECES, REFERENCE_PLAN, type PieceKind, type PlanInput } from "@/lib/plan/pieces";
import { validate } from "@/lib/plan/rules";
import { offlineAssessment } from "@/lib/plan/assess";

const KIND_LABEL: Record<PieceKind, string> = {
  apparatus: "器材",
  reagent: "试剂",
  step: "步骤",
  param: "参数",
};

const DEFAULT_PARAMS: Record<string, string | number | boolean> = { ...REFERENCE_PLAN.params };

const PRETTY_PARAM: { key: string; label: string; kind: "number" | "bool" }[] = [
  { key: "dryTemp", label: "基准物干燥温度（℃）", kind: "number" },
  { key: "parallelCount", label: "平行测定份数", kind: "number" },
  { key: "hood", label: "在通风橱内操作", kind: "bool" },
];

export function PlanDesigner({ studentNo }: { studentNo: string }) {
  const [pieces, setPieces] = useState<string[]>([]);
  const [params, setParams] = useState<Record<string, string | number | boolean>>(DEFAULT_PARAMS);
  const [kind, setKind] = useState<PieceKind>("apparatus");
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const plan: PlanInput = useMemo(() => ({ pieces, params }), [pieces, params]);
  const report = useMemo(() => validate(plan), [plan]);
  const assessment = useMemo(() => offlineAssessment(plan, report), [plan, report]);

  const add = (id: string) => setPieces((p) => (p.includes(id) ? p : [...p, id]));
  const remove = (id: string) => setPieces((p) => p.filter((x) => x !== id));
  const move = (id: string, dir: -1 | 1) =>
    setPieces((p) => {
      const i = p.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setSaved("saving");
    setSaveMsg("");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          experimentId: "exp10",
          params: { pieces },
          feasible: report.feasible,
          score: report.score,
          issues: report.issues.map((i) => ({ ruleId: i.ruleId, level: i.level, text: i.text })),
          assessment: assessment.text,
          assessmentOffline: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; planId?: string; error?: string };
      if (res.ok && body.ok) {
        setSaved("ok");
        setSaveMsg(`已保存方案 ${body.planId ?? ""}`);
      } else {
        setSaved("err");
        setSaveMsg(body.error ?? `保存失败（HTTP ${res.status}）`);
      }
    } catch (e) {
      setSaved("err");
      setSaveMsg(String(e).slice(0, 80));
    }
  };

  const list = PIECES.filter((p) => p.kind === kind);
  const scoreTone = report.score >= 90 ? "#1a7f4b" : report.score >= 60 ? "#9a6a12" : "#a33";

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px clamp(14px,3vw,26px) 56px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <Link href="/experiments" className="mono" style={{ fontSize: 12, color: "#1f5fa8", textDecoration: "none" }}>
          ← 实验列表
        </Link>
        <h1 style={{ fontSize: 22, margin: 0, letterSpacing: "-.01em" }}>拼接式方案设计 · 实验 10</h1>
        <span className="mono" style={{ fontSize: 12, color: "#7b8a9c" }}>
          学号 {studentNo}
        </span>
      </header>
      <p style={{ fontSize: 13.5, color: "#4a5c72", lineHeight: 1.7, margin: "8px 0 16px" }}>
        把左侧素材按流程顺序放进右侧方案，规则引擎会逐条校验（21 条规则），拼对给可行方案与评分。参数默认取参考值，可改。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        {/* 左：素材库 */}
        <section style={card}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {PIECE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                data-demo-id={`demo-design-tab-${k}`}
                style={{
                  ...chip,
                  background: kind === k ? "#1f5fa8" : "#fff",
                  color: kind === k ? "#fff" : "#3d4d61",
                  borderColor: kind === k ? "#1f5fa8" : "#dbe5f0",
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 560, overflow: "auto" }}>
            {list.map((p) => {
              const on = pieces.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  data-demo-id={p.demoId}
                  onClick={() => (on ? remove(p.id) : add(p.id))}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    minHeight: 44,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: `1px solid ${on ? "#9dc0e8" : "#e3eaf3"}`,
                    background: on ? "#eaf2fb" : "#fff",
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#12233b" }}>
                    {p.title} {on ? <span style={{ color: "#1a7f4b", fontSize: 11 }}>✓ 已加入</span> : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#7b8a9c", lineHeight: 1.5 }}>{p.sub}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 右：方案 + 校验 */}
        <section style={{ display: "grid", gap: 14 }}>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>我的方案</strong>
              <span className="mono" style={{ fontSize: 12, color: "#7b8a9c" }} data-demo-id="demo-design-piece-count">
                {pieces.length} 项
              </span>
              <span
                className="mono"
                data-demo-id="demo-design-score"
                style={{ fontSize: 13, fontWeight: 700, color: scoreTone, marginLeft: "auto" }}
              >
                {report.score} / 100 · {report.feasible ? "可行" : "不可行"}
              </span>
            </div>

            {pieces.length === 0 ? (
              <p style={{ fontSize: 13, color: "#7b8a9c", margin: "12px 0 0" }}>还没有素材。从左边点选，或先载入参考方案。</p>
            ) : (
              <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
                {pieces.map((id, i) => {
                  const p = PIECES.find((x) => x.id === id);
                  return (
                    <li key={id} style={{ fontSize: 13, color: "#22303f" }}>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="mono" style={{ color: "#7b8a9c", fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</span>
                        {p?.title ?? id}
                        <button type="button" onClick={() => move(id, -1)} style={mini} aria-label="上移">
                          ↑
                        </button>
                        <button type="button" onClick={() => move(id, 1)} style={mini} aria-label="下移">
                          ↓
                        </button>
                        <button type="button" onClick={() => remove(id)} style={mini} aria-label="移除">
                          ✕
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                type="button"
                data-demo-id="demo-design-reference"
                onClick={() => {
                  setPieces([...REFERENCE_PLAN.pieces]);
                  setParams({ ...REFERENCE_PLAN.params });
                }}
                className="btn btn--secondary"
                style={{ minHeight: 44, padding: "0 14px" }}
              >
                载入参考方案
              </button>
              <button
                type="button"
                data-demo-id="demo-design-clear"
                onClick={() => {
                  setPieces([]);
                  setSaved("idle");
                  setSaveMsg("");
                }}
                className="btn btn--secondary"
                style={{ minHeight: 44, padding: "0 14px" }}
              >
                清空
              </button>
              <button
                type="button"
                data-demo-id="demo-design-save"
                onClick={save}
                disabled={saved === "saving" || !pieces.length}
                className="btn btn--primary"
                style={{ minHeight: 44, padding: "0 18px" }}
              >
                {saved === "saving" ? "保存中…" : "保存方案"}
              </button>
              {saveMsg ? (
                <span
                  data-demo-id="demo-design-save-msg"
                  style={{ fontSize: 12.5, color: saved === "ok" ? "#1a7f4b" : "#a33", alignSelf: "center" }}
                >
                  {saveMsg}
                </span>
              ) : null}
            </div>
          </div>

          <div style={card}>
            <strong style={{ fontSize: 14 }}>参数</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {PRETTY_PARAM.map((p) => (
                <label key={p.key} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: "#3d4d61" }}>
                  <span style={{ minWidth: 190 }}>{p.label}</span>
                  {p.kind === "number" ? (
                    <input
                      type="number"
                      data-demo-id={`demo-design-param-${p.key}`}
                      value={String(params[p.key] ?? "")}
                      onChange={(e) => setParams((s) => ({ ...s, [p.key]: Number(e.target.value) }))}
                      style={{ width: 110, minHeight: 36, padding: "4px 8px", borderRadius: 8, border: "1px solid #dbe5f0" }}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      data-demo-id={`demo-design-param-${p.key}`}
                      checked={Boolean(params[p.key])}
                      onChange={(e) => setParams((s) => ({ ...s, [p.key]: e.target.checked }))}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>

          <div style={card} data-demo-id="demo-design-issues">
            <strong style={{ fontSize: 14 }}>
              校验 · 通过 {report.passed.length} 条 / 问题 {report.issues.length} 条
            </strong>
            {report.issues.length === 0 ? (
              <p style={{ fontSize: 13, color: "#1a7f4b", margin: "10px 0 0" }}>✓ 21 条规则全部通过，方案可执行。</p>
            ) : (
              <ul style={{ margin: "10px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {report.issues.map((it) => (
                  <li
                    key={it.ruleId}
                    style={{
                      border: `1px solid ${it.level === "block" ? "#f0b8b3" : "#f3e2bd"}`,
                      background: it.level === "block" ? "#fdeceb" : "#fdf6e7",
                      borderRadius: 10,
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: it.level === "block" ? "#a33" : "#9a6a12" }}>
                      {it.level === "block" ? "✕" : "!"} {it.text}
                    </div>
                    <div style={{ fontSize: 12, color: "#5b6b7d", marginTop: 3 }}>{it.hint}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={card}>
            <strong style={{ fontSize: 14 }}>方案点评</strong>
            <p style={{ fontSize: 13, color: "#3d4d61", lineHeight: 1.75, margin: "8px 0 0", whiteSpace: "pre-line" }}>
              {assessment.text}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

const card = {
  border: "1px solid #dbe5f0",
  borderRadius: 14,
  background: "#fff",
  padding: 14,
  boxShadow: "0 1px 2px rgba(18,35,59,.05), 0 8px 24px rgba(18,35,59,.05)",
} as const;

const chip = {
  minHeight: 34,
  padding: "4px 12px",
  borderRadius: 999,
  border: "1px solid #dbe5f0",
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
} as const;

const mini = {
  minWidth: 24,
  minHeight: 24,
  padding: "0 6px",
  borderRadius: 6,
  border: "1px solid #e3eaf3",
  background: "#fff",
  cursor: "pointer",
  fontSize: 11,
  color: "#5b6b7d",
} as const;
