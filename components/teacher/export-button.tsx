"use client";

import { useState } from "react";

/** 学情 CSV 导出：需要 teacher cookie（未解锁时后端 403，这里给出可读提示） */
export function TeacherExportButton() {
  const [state, setState] = useState<"idle" | "busy" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function download() {
    setState("busy");
    setMsg("");
    try {
      const res = await fetch("/api/teacher/export");
      if (res.status === 403) {
        setState("err");
        setMsg("请先在右上角「教师解锁」");
        return;
      }
      if (!res.ok) {
        setState("err");
        setMsg(`导出失败（${res.status}）`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const name = m ? decodeURIComponent(m[1]) : "chem-lab-grade.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setState("idle");
      setMsg(`已导出 ${Math.round(blob.size / 1024)} KB`);
    } catch (e) {
      setState("err");
      setMsg(e instanceof Error ? e.message.slice(0, 40) : "导出失败");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        className="btn btn--secondary"
        data-demo-id="demo-teacher-export"
        onClick={download}
        disabled={state === "busy"}
        style={{ minHeight: 36 }}
      >
        {state === "busy" ? "导出中…" : "导出学情 CSV"}
      </button>
      {msg ? (
        <span
          data-demo-id="demo-teacher-export-msg"
          style={{ fontSize: 12, color: state === "err" ? "#a33" : "#1a7f4b" }}
        >
          {msg}
        </span>
      ) : null}
    </span>
  );
}
