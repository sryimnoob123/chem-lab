"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getCurriculum } from "@/lib/pedagogy/curriculum";
import { scoreStage, type CurriculumQuestion } from "@/lib/pedagogy/curriculum/types";
import { PreLabDrawer } from "./prelab-drawer";

const STORE_KEY = (id: string) => `bopbps:v1:${id}:pre`;

/** 前测卡退场时长：与 globals.css 的 .ix-leave（--snap 160ms）对齐，≤300ms */
const GATE_LEAVE_MS = 180;

function loadPassed(id: string): boolean {
  try {
    return window.localStorage.getItem(STORE_KEY(id)) === "pass";
  } catch {
    return false;
  }
}

function markPassed(id: string) {
  try {
    window.localStorage.setItem(STORE_KEY(id), "pass");
  } catch {
    /* 隐私模式写不了，本次会话内仍然解锁 */
  }
}

function clearPassed(id: string) {
  try {
    window.localStorage.removeItem(STORE_KEY(id));
  } catch {
    /* 忽略 */
  }
}

const S = {
  card: {
    border: "1px solid var(--line, #dbe5f0)",
    borderRadius: 14,
    background: "var(--card, #fff)",
    padding: 18,
    boxShadow: "0 1px 2px rgba(18,35,59,.05), 0 8px 24px rgba(18,35,59,.05)",
  } as const,
  label: {
    fontSize: "var(--type-meta)",
    letterSpacing: ".14em",
    textTransform: "uppercase" as const,
    color: "#7b8a9c",
    fontWeight: 600,
  },
  h3: { fontSize: "var(--type-title)", fontWeight: 500, margin: "8px 0 8px", color: "var(--ink)" },
  body: { fontSize: "var(--type-body)", lineHeight: 1.65, color: "var(--ink-2)", margin: 0 },
};

function Question({
  q,
  picked,
  onPick,
  revealed,
  index,
}: {
  q: CurriculumQuestion;
  picked?: string;
  onPick: (key: string) => void;
  revealed: boolean;
  index: number;
}) {
  const isCorrectPick = picked === q.answer;
  return (
    <div style={{ borderTop: index ? "1px solid #eef2f7" : "none", paddingTop: index ? 14 : 0, marginTop: index ? 14 : 0 }}>
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
        <p style={{ ...S.body, color: "#12233b", fontWeight: 500 }}>{q.stem}</p>
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {q.options.map((o) => {
          const on = picked === o.key;
          const isAnswer = revealed && o.key === q.answer;
          const isWrongPick = revealed && on && !isCorrectPick;
          return (
            <button
              key={o.key}
              type="button"
              data-demo-id={`bopbps-op-${q.id}-${o.key}`}
              onClick={() => onPick(o.key)}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                textAlign: "left",
                minHeight: 44,
                padding: "9px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: "var(--type-body)",
                lineHeight: 1.6,
                color: "#22303f",
                background: isAnswer ? "#e6f6ed" : isWrongPick ? "#fdeceb" : on ? "#eaf2fb" : "#fff",
                border: `1px solid ${isAnswer ? "#a9dcc0" : isWrongPick ? "#f0b8b3" : on ? "#9dc0e8" : "#dbe5f0"}`,
                transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease",
              }}
            >
              <span
                className="mono"
                style={{ flex: "none", fontWeight: 700, color: isAnswer ? "#1a7f4b" : isWrongPick ? "#a33" : "#7b8a9c" }}
              >
                {o.key}
              </span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {revealed && picked && !isCorrectPick ? (
        <p style={{ ...S.body, fontSize: "var(--type-meta)", marginTop: 8, color: "#1a7f4b", whiteSpace: "pre-line" }}>
          答案 {q.answer} · {q.explanation}
        </p>
      ) : null}
    </div>
  );
}

/** 操作台未解锁时的占位：与操作台同尺寸，避免"点了跳页/白屏"的观感 */
function LabPlaceholder() {
  return (
    <section
      data-demo-id="bopbps-lab-locked"
      aria-hidden="true"
      style={{
        marginTop: 14,
        border: "1px dashed #cfdced",
        borderRadius: 14,
        background: "repeating-linear-gradient(135deg,#fbfdff 0 12px,#f4f8fd 12px 24px)",
        padding: "22px 18px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "var(--type-meta)", fontWeight: 500, color: "var(--ink-2)" }}>操作台已就位，答对上面的 3 道前测即解锁</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 92,
              height: 34,
              borderRadius: 9,
              background: "#eaf0f8",
              border: "1px solid #dfe8f3",
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </section>
  );
}


/**
 * 门禁页的实验台底：纸白 + 极淡方格纸 + 玻璃器皿线稿，正文卡片仍是白底。
 * 只用 CSS 渐变与内联 SVG（无外链图、无新依赖）；描边走淡墨 --ink-2，
 * 纸白底上不用白色高光。铺满视口宽度，左右出血盖住 980 正文列以外的余白。
 */
function BenchBackdrop() {
  return (
    <div aria-hidden="true" className="bop-bench">
      <svg className="bop-bench__art" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          {/* 器材纹样：烧杯 / 锥形瓶 / 试管，稀疏平铺，只做背景肌理 */}
          <pattern id="bop-bench-tile" width="320" height="300" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#4a5768" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M26 48h60v62a13 13 0 0 1-13 13H39a13 13 0 0 1-13-13Z" />
              <path d="M26 48q7-9 15 0" />
              <path d="M36 86h40" strokeDasharray="3 6" />
              <path d="M36 102h26" strokeDasharray="3 6" />
              <path d="M186 30h12v28l24 52a14 14 0 0 1-13 20H175a14 14 0 0 1-13-20l24-52Z" />
              <path d="M181 46h22" />
              <path d="M166 98h42" strokeDasharray="3 6" />
              <path d="M264 46v66a10 10 0 0 0 20 0V46" />
              <path d="M259 46h30" />
              <path d="M264 92h20" strokeDasharray="3 6" />
            </g>
          </pattern>
        </defs>
        <rect width="1200" height="900" fill="url(#bop-bench-tile)" opacity=".08" />
        {/* 右侧大件：铁架台 + 滴定管，给背景一个能认出来的"实验台"焦点 */}
        <g
          transform="translate(920 120)"
          fill="none"
          stroke="#4a5768"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".07"
        >
          <path d="M18 470h150" />
          <path d="M54 470V26" />
          <path d="M54 58h36" />
          <path d="M54 122h36" />
          <path d="M120 46v296" />
          <path d="M132 46v296" />
          <path d="M120 46h12" />
          <path d="M114 342h24" />
          <path d="M126 342l-8 28h16Z" />
          <path d="M120 90h8M120 122h8M120 154h8M120 186h8M120 218h8M120 250h8" />
        </g>
      </svg>
      <style>{`
        .bop-bench {
          /* 固定铺满视口：不参与文档流，不产出横向滚动条；内容滚动时台面留在原地 */
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          background:
            radial-gradient(90% 55% at 84% 4%, rgba(74,87,104,.07), transparent 72%),
            linear-gradient(180deg, rgba(74,87,104,.06) 0%, rgba(74,87,104,0) 16%, rgba(74,87,104,0) 72%, rgba(74,87,104,.07) 100%),
            repeating-linear-gradient(90deg, rgba(74,87,104,.055) 0 1px, transparent 1px 40px),
            repeating-linear-gradient(0deg, rgba(74,87,104,.05) 0 1px, transparent 1px 40px),
            var(--bench-ink, #f6f7f5);
        }
        .bop-bench__art {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }
        /* 台面下沿：一条淡墨接缝 + 轻微压深，像实验台边缘 */
        .bop-bench::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 72px;
          border-top: 1px solid rgba(74,87,104,.14);
          background: linear-gradient(to top, rgba(74,87,104,.08), rgba(74,87,104,0));
        }
      `}</style>
    </div>
  );
}


/**
 * BOPPPS 前段：问卷与操作台**同屏**。
 * - 未通过：问卷在上，操作台位置是一个虚线占位（不提前创建 run）
 * - 通过后：原地把占位换成操作台，问卷收成一条细条（带「重做前测」）
 * - 不整页跳转、不重新加载，避免"点了在加载"的观感
 */
export function BopbpsGate({
  expId,
  bypass = false,
  children,
}: {
  expId: string;
  bypass?: boolean;
  children: ReactNode;
}) {
  const c = useMemo(() => getCurriculum(expId), [expId]);
  const [stage, setStage] = useState<"loading" | "pre" | "lab">("loading");
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    return () => {
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    };
  }, []);

  useEffect(() => {
    // ?fresh=1 / ?reset=1：清掉本地预习记录，强制回到问卷（排查"看不到最新界面"用）
    let forced = false;
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("fresh") === "1" || qs.get("reset") === "1") {
        clearPassed(expId);
        forced = true;
      }
    } catch {
      /* 忽略 */
    }
    const next = forced ? "pre" : loadPassed(expId) || !c ? "lab" : "pre";
    queueMicrotask(() => setStage(next));
  }, [expId, c]);

  const submit = useCallback(() => {
    if (!c || leaving) return;
    const missing = c.pre.filter((q) => !picked[q.id]).length;
    if (missing) {
      setHint(`还有 ${missing} 题没选`);
      return;
    }
    setHint("");
    setRevealed(true);
    if (scoreStage(c.pre, picked) >= 100) {
      markPassed(expId);
      // 减动效：直接切换；否则先让前测卡 180ms 退场，再淡入操作台，避免硬替换
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setStage("lab");
        return;
      }
      setLeaving(true);
      leaveTimer.current = setTimeout(() => {
        setLeaving(false);
        setStage("lab");
      }, GATE_LEAVE_MS);
    }
  }, [c, picked, expId, leaving]);

  if (bypass || !c) return <>{children}</>;

  if (stage === "loading") {
    return (
      <>
        <BenchBackdrop />
        <div className="ix-page-enter" style={{ maxWidth: 980, margin: "0 auto", padding: "28px clamp(16px,4vw,28px)" }} aria-busy="true">
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ ...S.card, height: 160, opacity: 0.6 }} />
            <LabPlaceholder />
          </div>
        </div>
      </>
    );
  }

  if (stage === "lab") {
    return (
      <>
        {children}
        <PreLabDrawer
          curriculum={c}
          picked={picked}
          onRetry={() => {
            clearPassed(expId);
            setPicked({});
            setRevealed(false);
            setStage("pre");
          }}
        />
      </>
    );
  }

  const passed = scoreStage(c.pre, picked) >= 100;

  return (
    <>
      <BenchBackdrop />
      <div className={leaving ? "ix-leave" : "ix-page-enter"} style={{ maxWidth: 980, margin: "0 auto", padding: "24px clamp(16px,4vw,28px) 40px" }}>
        {/* 正文整体抬到背景之上：卡片保持白底，方格与线稿只从余白和卡片间隙透出来 */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={S.label}>BOPPPS · 预习段 · {expId.toUpperCase()}</div>
          <h1 style={{ fontSize: "var(--type-display)", fontWeight: 500, margin: "8px 0 16px", letterSpacing: "-.01em", color: "var(--ink)" }}>
            先过前测，再进操作台
          </h1>

          <section style={{ ...S.card, marginBottom: 12 }}>
            <div style={S.label}>B · 导入</div>
            <p style={{ ...S.body, marginTop: 8 }}>{c.bridgeIn}</p>
          </section>

          <section style={{ ...S.card, marginBottom: 12 }}>
            <div style={S.label}>O · 目标</div>
            <ul style={{ ...S.body, margin: "10px 0 0", paddingLeft: 18 }}>
              {c.objectives.map((o) => (
                <li key={o.competency} style={{ marginBottom: 6 }}>
                  <span className="mono" style={{ color: "#1f5fa8", fontWeight: 700, marginRight: 6 }}>
                    {o.competency}
                  </span>
                  {o.text}
                </li>
              ))}
            </ul>
          </section>

          <section style={S.card}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <div style={S.label}>P · 前测（{c.pre.length} 题，全对解锁下方操作台）</div>
              <div className="mono" style={{ fontSize: "var(--type-meta)", color: passed ? "#1a7f4b" : "var(--ink-2)" }}>
                {c.pre.filter((q) => picked[q.id]).length}/{c.pre.length}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              {c.pre.map((q, i) => (
                <Question
                  key={q.id}
                  q={q}
                  index={i}
                  picked={picked[q.id]}
                  revealed={revealed}
                  onPick={(key) => {
                    setRevealed(false);
                    setPicked((p) => ({ ...p, [q.id]: key }));
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" data-demo-id="bopbps-pre-submit" onClick={submit} className="btn btn--primary" style={{ minHeight: 44, padding: "0 18px" }}>
                提交前测
              </button>
              {revealed && !passed ? (
                <button
                  type="button"
                  data-demo-id="bopbps-pre-reset"
                  onClick={() => {
                    setPicked({});
                    setRevealed(false);
                  }}
                  className="btn btn--secondary"
                  style={{ minHeight: 44, padding: "0 14px" }}
                >
                  重新作答
                </button>
              ) : null}
              <span style={{ fontSize: "var(--type-meta)", color: hint ? "#a33" : "var(--ink-2)" }}>
                {revealed ? (passed ? "全部正确，操作台已在下方解锁" : "还有错题，看解析后改选再提交") : hint || "选完 3 题后提交"}
              </span>
            </div>
          </section>

          <LabPlaceholder />
        </div>
      </div>
    </>
  );
}
