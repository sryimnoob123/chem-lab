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
    fontSize: 11,
    letterSpacing: ".14em",
    textTransform: "uppercase" as const,
    color: "#7b8a9c",
    fontWeight: 600,
  },
  h3: { fontSize: 15, margin: "6px 0 8px", color: "#12233b" },
  body: { fontSize: 14, lineHeight: 1.75, color: "#3d4d61", margin: 0 },
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
            fontSize: 11,
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
                fontSize: 13.5,
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
        <p style={{ ...S.body, fontSize: 13, marginTop: 8, color: "#1a7f4b", whiteSpace: "pre-line" }}>
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
      <div style={{ fontSize: 13, fontWeight: 600, color: "#5b6b7d" }}>操作台已就位，答对上面的 3 道前测即解锁</div>
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
      <div className="ix-page-enter" style={{ maxWidth: 980, margin: "0 auto", padding: "28px clamp(16px,4vw,28px)" }} aria-busy="true">
        <div style={{ ...S.card, height: 160, opacity: 0.6 }} />
        <LabPlaceholder />
      </div>
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
    <div className={leaving ? "ix-leave" : "ix-page-enter"} style={{ maxWidth: 980, margin: "0 auto", padding: "24px clamp(16px,4vw,28px) 40px" }}>
      <div style={S.label}>BOPPPS · 预习段 · {expId.toUpperCase()}</div>
      <h1 style={{ fontSize: 24, margin: "8px 0 16px", letterSpacing: "-.01em", color: "#12233b" }}>
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
          <div className="mono" style={{ fontSize: 12, color: passed ? "#1a7f4b" : "#7b8a9c" }}>
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
          <span style={{ fontSize: 13, color: hint ? "#a33" : "#7b8a9c" }}>
            {revealed ? (passed ? "全部正确，操作台已在下方解锁" : "还有错题，看解析后改选再提交") : hint || "选完 3 题后提交"}
          </span>
        </div>
      </section>

      <LabPlaceholder />
    </div>
  );
}
