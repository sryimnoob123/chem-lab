"use client";

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 32, fontFamily: "monospace", color: "#c9d6e4", background: "#0e1620", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 18 }}>报告页渲染失败</h1>
      <p style={{ fontSize: 12, opacity: 0.75 }}>{error.message || "UNKNOWN_ERROR"}</p>
      <button type="button" onClick={reset} style={{ marginTop: 12, minHeight: 44, padding: "0 12px" }}>
        重试
      </button>
    </main>
  );
}
