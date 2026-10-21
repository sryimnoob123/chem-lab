"use client";

import { useState } from "react";
import type { Curriculum } from "@/lib/pedagogy/curriculum/types";

/**
 * 操作台内的「预习」抽屉：不离开操作台就能回看 B 导入 / O 目标 / P 前测与解析。
 * 操作台是 fixed 全屏，所以这里用 fixed 悬浮入口 + 右侧抽屉，z-index 高于操作台。
 */
export function PreLabDrawer({
  curriculum,
  picked,
  onRetry,
}: {
  curriculum: Curriculum;
  picked: Record<string, string>;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const correct = curriculum.pre.filter((q) => picked[q.id] === q.answer).length;

  return (
    <>
      <button
        type="button"
        data-demo-id="bopbps-drawer-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          position: "fixed",
          right: 18,
          bottom: 92,
          zIndex: 9000,
          minHeight: 40,
          padding: "0 14px",
          borderRadius: 999,
          border: "1px solid #a9dcc0",
          background: "#e9f7ef",
          color: "#1a7f4b",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 2px 10px rgba(18,35,59,.16)",
        }}
      >
        预习 ✓ {correct}/{curriculum.pre.length}
      </button>

      {open ? (
        <div
          data-demo-id="bopbps-drawer"
          role="dialog"
          aria-label="预习回顾"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(460px, 92vw)",
            zIndex: 9001,
            background: "#fff",
            borderLeft: "1px solid #dbe5f0",
            boxShadow: "-8px 0 32px rgba(18,35,59,.14)",
            overflowY: "auto",
            padding: "16px 18px 88px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <strong style={{ fontSize: 15 }}>预习回顾</strong>
            <span className="mono" style={{ fontSize: 11.5, color: "#1a7f4b" }}>
              前测 {correct}/{curriculum.pre.length} 全对
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                marginLeft: "auto",
                minWidth: 32,
                minHeight: 32,
                borderRadius: 8,
                border: "1px solid #dbe5f0",
                background: "#fff",
                cursor: "pointer",
              }}
              aria-label="关闭"
            >
              ✕
            </button>
          </div>

          <section style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: ".14em", color: "#7b8a9c", fontWeight: 600 }}>B · 导入</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "#3d4d61", margin: "6px 0 0" }}>{curriculum.bridgeIn}</p>
          </section>

          <section style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: ".14em", color: "#7b8a9c", fontWeight: 600 }}>O · 目标</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: "#3d4d61" }}>
              {curriculum.objectives.map((o) => (
                <li key={o.competency} style={{ marginBottom: 4 }}>
                  <span className="mono" style={{ color: "#1f5fa8", fontWeight: 700, marginRight: 6 }}>
                    {o.competency}
                  </span>
                  {o.text}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div style={{ fontSize: 11, letterSpacing: ".14em", color: "#7b8a9c", fontWeight: 600 }}>P · 前测回顾</div>
            <ol style={{ margin: "8px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {curriculum.pre.map((q) => {
                const mine = picked[q.id];
                const ok = mine === q.answer;
                return (
                  <li key={q.id} style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: "9px 11px" }}>
                    <div style={{ fontSize: 13, color: "#12233b", fontWeight: 500 }}>{q.stem}</div>
                    <div style={{ fontSize: 12.5, marginTop: 6, color: ok ? "#1a7f4b" : "#9a6a12" }}>
                      {ok ? "✓ 你的选择正确" : mine ? `你选了 ${mine}` : "未作答"} · 正确答案 {q.answer}
                    </div>
                    <div style={{ fontSize: 12, color: "#5b6b7d", marginTop: 4, whiteSpace: "pre-line" }}>{q.explanation}</div>
                  </li>
                );
              })}
            </ol>
          </section>

          <button
            type="button"
            data-demo-id="bopbps-drawer-retry"
            onClick={() => {
              onRetry();
              setOpen(false);
            }}
            style={{
              marginTop: 16,
              minHeight: 40,
              padding: "0 14px",
              borderRadius: 9,
              border: "1px solid #dbe5f0",
              background: "#fff",
              color: "#1f5fa8",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            重做前测
          </button>
        </div>
      ) : null}
    </>
  );
}
