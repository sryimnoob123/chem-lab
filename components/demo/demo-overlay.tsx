"use client";

import { useEffect, useState } from "react";
import { DemoStage } from "./stage";
import { DEMO_SCRIPTS } from "@/lib/demo/scripts";
import { SCRIPT_NOTES } from "@/lib/demo/notes";

const ORDER = ["home", "login", "catalog", "exp09", "report", "fx", "teacher"];

/** 标准流程顺序：门户 → 登录 → 实验 → 交卷报告 → 事故 → 教师端 */
const ordered = ORDER.map((id) => DEMO_SCRIPTS.find((s) => s.id === id)).filter(
  (s): s is NonNullable<typeof s> => Boolean(s),
);
const scripts = ordered.length ? ordered : DEMO_SCRIPTS;

/**
 * 演示模式浮层：点一下自己演一遍标准流程，随时 Esc / 退出 / 重播。
 * 全程无人工操作，字幕旁白说明每一步在考点什么。
 */
export function DemoOverlay({ onClose }: { onClose: () => void }) {
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="demo-overlay" role="dialog" aria-modal="true" aria-label="演示模式">
      <div className="demo-overlay__frame">
        <div className="demo-overlay__hint" aria-hidden="true">
          {SCRIPT_NOTES.overlayHint}
        </div>
        <DemoStage key={runKey} scripts={scripts} autoplay />
        <div className="demo-overlay__actions">
          <button
            type="button"
            className="btn btn--secondary ix"
            onClick={() => setRunKey((k) => k + 1)}
            data-demo-id="demo-mode-restart"
          >
            从头再演一遍
          </button>
          <button type="button" className="btn btn--primary ix" onClick={onClose} data-demo-id="demo-mode-exit">
            退出演示（Esc）
          </button>
        </div>
      </div>
    </div>
  );
}

/** 右上角的「演示模式」按钮 + 浮层 */
export function DemoLaunch({ label = "一键演示" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="demo-launch ix"
        onClick={() => setOpen(true)}
        data-demo-id="demo-mode-open"
        title="自动演一遍标准流程，不需要人操作"
      >
        <span className="demo-launch__dot" aria-hidden="true" />
        {label}
      </button>
      {open ? <DemoOverlay onClose={() => setOpen(false)} /> : null}
    </>
  );
}
