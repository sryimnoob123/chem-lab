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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { REFERENCE_PLAN, getPiece, type PieceKind, type PlanInput } from "@/lib/plan/pieces";
import { validate } from "@/lib/plan/rules";
import { mockAssess, type AssessPointKind } from "@/lib/plan/assess-mock";
import { applyTopic, type PlanTopic } from "@/lib/plan/topics";
import type { LlmAssessResult } from "@/lib/plan/llm-assess";
import { PieceLibrary } from "./piece-library";
import { ScorePanel } from "./score-panel";
import { TopicPicker } from "./topic-picker";
import s from "./plan.module.css";

const DEFAULT_PARAMS: Record<string, string | number | boolean> = { ...REFERENCE_PLAN.params };

/** 点评要点三类：图标代替三栏堆叠（颜色由 CSS 的 data-kind 控制） */
const KIND_ICON: Record<AssessPointKind, string> = { good: "✓", risk: "!", todo: "→" };

/** 云端失败原因 → 一行小字（不改变面板结构） */
const FALLBACK_LABEL: Record<NonNullable<LlmAssessResult["fallback"]>, string> = {
  timeout: "AI 超时",
  "rate-limit": "AI 限流",
  http: "AI 接口报错",
  empty: "AI 没返回内容",
  error: "AI 返回格式不对",
  network: "AI 连不上",
};

const PRETTY_PARAM: { key: string; label: string; kind: "number" | "bool" }[] = [
  { key: "dryTemp", label: "基准物干燥温度（℃）", kind: "number" },
  { key: "parallelCount", label: "平行测定份数", kind: "number" },
  { key: "hood", label: "在通风橱内操作", kind: "bool" },
];

export function PlanDesigner({ studentNo }: { studentNo: string }) {
  /** 先选主题（P0）：null = 还没选，显示主题卡；选了才进画布 */
  const [topic, setTopic] = useState<PlanTopic | null>(null);
  const [pieces, setPieces] = useState<string[]>([]);
  const [params, setParams] = useState<Record<string, string | number | boolean>>(DEFAULT_PARAMS);
  const [kind, setKind] = useState<PieceKind | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const plan: PlanInput = useMemo(() => ({ pieces, params }), [pieces, params]);
  /** 基础 21 条 + 主题专属约束合成一份报告：一张评分卡，不出现两套分数 */
  const report = useMemo(() => applyTopic(validate(plan), plan, topic ?? undefined), [plan, topic]);
  /**
   * 点评只有一条链路（`/api/plan/assess` → `lib/plan/llm-assess.ts`）：
   * - `local` 是本地点评（assess-mock.ts 的 mockAssess），先渲染它，永远有内容、不白屏；
   * - 云端返回前也显示它，保证面板高度不跳；
   * - provider 没凭据 / 超时 / 限流 / 坏 JSON 时，服务端回退的也是同一份 local。
   */
  const local = useMemo(() => mockAssess(plan, report, topic ?? undefined), [plan, report, topic]);

  const [remote, setRemote] = useState<{ key: string; result: LlmAssessResult } | null>(null);
  const [remarkLoading, setRemarkLoading] = useState(false);
  /** 云端结果必须与当前方案同 key，避免旧点评挂在新方案上 */
  const requestKey = useMemo(
    () => JSON.stringify([pieces, params, topic?.id ?? null]),
    [pieces, params, topic],
  );

  useEffect(() => {
    if (pieces.length === 0) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRemarkLoading(true);
      void fetch("/api/plan/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pieces, params, topicId: topic?.id }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: (LlmAssessResult & { ok?: boolean }) | null) => {
          if (cancelled || !data?.ok) return;
          setRemote({
            key: requestKey,
            result: {
              provider: data.provider,
              text: data.text,
              points: data.points ?? [],
              questions: data.questions ?? [],
              fallback: data.fallback,
              pointsFrom: data.pointsFrom,
            },
          });
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setRemarkLoading(false);
        });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pieces, params, topic, requestKey]);

  /** 当前方案的点评：云端同 key 才用云端，否则本地 */
  const shown = remote && remote.key === requestKey ? remote.result : local;
  const busy = remarkLoading && pieces.length > 0;
  const orderedPoints = useMemo(() => {
    const rank: Record<string, number> = { good: 0, risk: 1, todo: 2 };
    return [...shown.points].sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9));
  }, [shown.points]);

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
          assessment: shown.text,
          assessmentOffline: shown.provider === "mock",
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

      {topic ? (
        <div className={s.topicHead} data-demo-id="demo-topic-head">
          <span className={s.topicHeadTitle}>{topic.title}</span>
          <span className={s.topicLevel} data-demo-id="demo-topic-level">
            {topic.level}
          </span>
          <span className={s.topicHeadGoal}>{topic.goal}</span>
          <button
            type="button"
            className={s.topicSwitch}
            data-demo-id="demo-topic-switch"
            onClick={() => {
              setTopic(null);
              setPieces([]);
            }}
          >
            换主题
          </button>
        </div>
      ) : (
        <TopicPicker
          onPick={(picked) => {
            setTopic(picked);
            setPieces([]);
          }}
        />
      )}

      {!topic ? null : (
        <>
      <ScorePanel report={report} pieceCount={pieces.length} />

      <div className={s.cols}>
        <PieceLibrary
          selected={pieces}
          kind={kind}
          onKind={setKind}
          onToggle={toggle}
          featured={topic?.featured}
        />

        <div className={s.right}>
          <section className={s.panel} aria-label="我的方案" data-plan-drop="list">
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

          <section className={s.panel} aria-label="方案点评" aria-busy={busy}>
            <div className={s.panelHead}>
              <h2 className={s.panelTitle}>方案点评</h2>
              <span className={s.mono} data-demo-id="demo-remark-provider">
                {busy ? "正在点评…" : shown.provider === "mock" ? "离线点评" : "AI 点评"}
              </span>
            </div>
            <div className={s.remarkBody}>
              <p className={s.remark} data-demo-id="demo-remark-text">
                {shown.text}
              </p>
              {shown.fallback ? (
                <p className={s.remarkFallback} data-demo-id="demo-remark-fallback">
                  {FALLBACK_LABEL[shown.fallback]}，已用离线点评。
                </p>
              ) : null}
              {orderedPoints.length > 0 ? (
                <ul className={s.remarkPoints} data-demo-id="demo-remark-points">
                  {orderedPoints.map((point, index) => (
                    <li
                      key={`${point.kind}-${point.pieceId ?? point.ruleId ?? index}`}
                      className={s.remarkPoint}
                      data-kind={point.kind}
                      data-piece={point.pieceId}
                      data-rule={point.ruleId}
                    >
                      <span className={s.remarkIcon} aria-hidden="true">
                        {KIND_ICON[point.kind]}
                      </span>
                      {point.text}
                    </li>
                  ))}
                </ul>
              ) : null}
              {shown.questions.length > 0 ? (
                <div className={s.remarkAsk} data-demo-id="demo-remark-questions">
                  {shown.questions.slice(0, 2).map((question) => (
                    <p key={question} className={s.remarkQuestion}>
                      {question}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
        </>
      )}
    </main>
  );
}
