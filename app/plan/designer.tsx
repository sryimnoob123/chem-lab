"use client";

/**
 * 拼接式方案设计（客户端外壳）—— 状态、保存、方案列表。
 *
 * 页面顺序（2026-10-22 口径）：先评分、后校验。
 *   顶部  ScorePanel（总分 + 一句话结论 + 哪里对/哪里不对 + 可展开的校验明细）
 *   左栏  PieceLibrary（按实验阶段分组出题）
 *   右栏  我的方案 / 参数 / 方案点评
 * 规则判定全在 lib/plan/rules.ts，组件只渲染。
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { REFERENCE_PLAN, getPiece, type PieceKind, type PlanInput } from "@/lib/plan/pieces";
import { validate } from "@/lib/plan/rules";
import { offlineAssessment } from "@/lib/plan/assess";
import { PieceLibrary } from "./piece-library";
import { ScorePanel } from "./score-panel";
import s from "./plan.module.css";

const DEFAULT_PARAMS: Record<string, string | number | boolean> = { ...REFERENCE_PLAN.params };

const PRETTY_PARAM: { key: string; label: string; kind: "number" | "bool" }[] = [
  { key: "dryTemp", label: "基准物干燥温度（℃）", kind: "number" },
  { key: "parallelCount", label: "平行测定份数", kind: "number" },
  { key: "hood", label: "在通风橱内操作", kind: "bool" },
];

export function PlanDesigner({ studentNo }: { studentNo: string }) {
  const [pieces, setPieces] = useState<string[]>([]);
  const [params, setParams] = useState<Record<string, string | number | boolean>>(DEFAULT_PARAMS);
  const [kind, setKind] = useState<PieceKind | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const plan: PlanInput = useMemo(() => ({ pieces, params }), [pieces, params]);
  const report = useMemo(() => validate(plan), [plan]);
  const assessment = useMemo(() => offlineAssessment(plan, report), [plan, report]);

  const toggle = (id: string) =>
    setPieces((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
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
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        planId?: string;
        error?: string;
      };
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

  return (
    <main className={s.page}>
      <header className={s.topbar}>
        <Link href="/experiments" className={s.back}>
          ← 实验列表
        </Link>
        <h1 className={s.title}>进阶学习 · 实验 10</h1>
        <span className={s.who}>学号 {studentNo}</span>
      </header>
      <p className={s.lead}>
        素材按实验环节分三段：① HCl 标定 → ② 总碱度测定 → ③ 通用器材与记录。点块加入方案、上下调序，顶部随时给分。
      </p>

      <ScorePanel report={report} pieceCount={pieces.length} />

      <div className={s.cols}>
        <PieceLibrary selected={pieces} kind={kind} onKind={setKind} onToggle={toggle} />

        <div className={s.right}>
          <section className={s.panel} aria-label="我的方案">
            <div className={s.panelHead}>
              <h2 className={s.panelTitle}>我的方案</h2>
              <span className={s.mono} data-demo-id="demo-design-piece-count">
                {pieces.length} 项
              </span>
            </div>

            {pieces.length === 0 ? (
              <p className={s.empty}>还没有素材。从左边 ① HCl 标定 开始挑，或先载入参考方案。</p>
            ) : (
              <ol className={s.planList}>
                {pieces.map((id, i) => {
                  const title = getPiece(id)?.title ?? id;
                  return (
                    <li key={id} className={s.planRow}>
                      <span className={s.planIdx}>{String(i + 1).padStart(2, "0")}</span>
                      <span className={s.planTitle}>{title}</span>
                      <span className={s.planTools}>
                        <button
                          type="button"
                          className={s.mini}
                          onClick={() => move(id, -1)}
                          aria-label={`上移 ${title}`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={s.mini}
                          onClick={() => move(id, 1)}
                          aria-label={`下移 ${title}`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={s.mini}
                          onClick={() => remove(id)}
                          aria-label={`移除 ${title}`}
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className={s.actions}>
              <button
                type="button"
                data-demo-id="demo-design-reference"
                className="btn btn--secondary"
                onClick={() => {
                  setPieces([...REFERENCE_PLAN.pieces]);
                  setParams({ ...REFERENCE_PLAN.params });
                }}
              >
                载入参考方案
              </button>
              <button
                type="button"
                data-demo-id="demo-design-clear"
                className="btn btn--secondary"
                onClick={() => {
                  setPieces([]);
                  setSaved("idle");
                  setSaveMsg("");
                }}
              >
                清空
              </button>
              <button
                type="button"
                data-demo-id="demo-design-save"
                className="btn btn--primary"
                onClick={save}
                disabled={saved === "saving" || !pieces.length}
              >
                {saved === "saving" ? "保存中…" : "保存方案"}
              </button>
              {saveMsg ? (
                <span className={s.saveMsg} data-state={saved} data-demo-id="demo-design-save-msg">
                  {saveMsg}
                </span>
              ) : null}
            </div>
          </section>

          <section className={s.panel} aria-label="参数">
            <h2 className={s.panelTitle}>参数</h2>
            <div className={s.params}>
              {PRETTY_PARAM.map((p) => (
                <label key={p.key} className={s.paramRow}>
                  <span className={s.paramLabel}>{p.label}</span>
                  {p.kind === "number" ? (
                    <input
                      type="number"
                      className={s.input}
                      data-demo-id={`demo-design-param-${p.key}`}
                      value={String(params[p.key] ?? "")}
                      onChange={(e) =>
                        setParams((st) => ({ ...st, [p.key]: Number(e.target.value) }))
                      }
                    />
                  ) : (
                    <input
                      type="checkbox"
                      className={s.check}
                      data-demo-id={`demo-design-param-${p.key}`}
                      checked={Boolean(params[p.key])}
                      onChange={(e) => setParams((st) => ({ ...st, [p.key]: e.target.checked }))}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          <section className={s.panel} aria-label="方案点评">
            <h2 className={s.panelTitle}>方案点评</h2>
            <p className={s.remark}>{assessment.text}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
