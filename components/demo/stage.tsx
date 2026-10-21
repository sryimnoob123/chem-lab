"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DemoDirector } from "@/lib/demo/director";
import type { DemoScript, DirectorState } from "@/lib/demo/types";

const STATE_TEXT: Record<DirectorState, string> = {
  idle: "待播放",
  playing: "演示中",
  paused: "已暂停",
  done: "播放完毕",
};

/** 演示模式给 iframe 带上 play=demo：页面据此走"只读不落库"分支 */
function srcOf(scriptPage: string | undefined, autoplay: boolean): string {
  const page = scriptPage ?? "/";
  if (!autoplay) return page;
  const sep = page.includes("?") ? "&" : "?";
  return `${page}${sep}play=demo`;
}

export function DemoStage({ scripts, autoplay = false }: { scripts: DemoScript[]; autoplay?: boolean }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const directorRef = useRef<DemoDirector | null>(null);
  const [activeId, setActiveId] = useState(scripts[0]?.id ?? "");
  const [state, setState] = useState<DirectorState>("idle");
  const [caption, setCaption] = useState("点「播放演示」，脚本会自动走一遍，光标是模拟的。");
  const [stepText, setStepText] = useState("");

  const script = scripts.find((s) => s.id === activeId) ?? scripts[0];

  const stop = useCallback(() => {
    directorRef.current?.stop();
    directorRef.current = null;
    setState("idle");
  }, []);

  const play = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !script) return;
    directorRef.current?.stop();
    const director = new DemoDirector({
      onState: setState,
      onCaption: setCaption,
      onStep: (i, step) => setStepText(`${i + 1}/${script.steps.length} · ${step.text ?? step.kind}`),
    });
    directorRef.current = director;
    void director.play(doc, script);
  }, [script]);

  const toggle = useCallback(() => {
    const d = directorRef.current;
    if (!d || state === "idle" || state === "done") {
      play();
      return;
    }
    if (state === "playing") d.pause();
    else d.resume();
  }, [play, state]);

  useEffect(() => () => directorRef.current?.stop(), []);

  // 自动播放启动器：iframe 的 onLoad 常早于 hydration，这里带重试兜底
  useEffect(() => {
    if (!autoplay) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const doc = frameRef.current?.contentDocument;
      const ready = Boolean(doc && doc.body && doc.body.childElementCount > 0);
      if (ready && !directorRef.current) {
        clearInterval(timer);
        play();
        return;
      }
      if (tries > 20) clearInterval(timer);
    }, 400);
    return () => clearInterval(timer);
  }, [autoplay, play, activeId]);

  // 自动播放：播完一场 → 停 1.2s → 切下一场（换 iframe 后会触发 onLoad 再自动开播）
  useEffect(() => {
    if (!autoplay || state !== "done" || scripts.length < 2) return;
    const t = setTimeout(() => {
      const i = scripts.findIndex((s) => s.id === activeId);
      const next = scripts[(i + 1) % scripts.length];
      setCaption(`下一场：${next.title}`);
      setActiveId(next.id);
    }, 1200);
    return () => clearTimeout(t);
  }, [autoplay, state, activeId, scripts]);

  return (
    <div className="demo-shell">
      <div className="demo-bar">
        <div className="demo-bar__left">
          <span className="demo-bar__label">演示脚本</span>
          <select
            className="demo-bar__select mono"
            value={activeId}
            onChange={(e) => {
              stop();
              setActiveId(e.target.value);
              setCaption("已切换脚本，下次播放生效。");
            }}
            data-demo-id="demo-page-script"
          >
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <span className={`demo-bar__state`} data-state={state}>
            {STATE_TEXT[state]}
          </span>
        </div>
        <div className="demo-bar__right">
          <button className="btn btn--primary" type="button" onClick={toggle} data-demo-id="demo-page-play">
            {state === "playing" ? "暂停" : state === "paused" ? "继续" : "播放演示"}
          </button>
          <button className="btn btn--secondary" type="button" onClick={play} data-demo-id="demo-page-replay">
            重播
          </button>
        </div>
      </div>

      <div className="demo-frame">
        <iframe
          ref={frameRef}
          className="demo-frame__iframe"
          src={srcOf(script?.page, autoplay)}
          title={script?.title ?? "演示"}
          onLoad={() => {
            setCaption(autoplay ? "自动播放中…" : "页面已就绪，点「播放演示」开始。");
            if (autoplay) setTimeout(() => play(), 700);
          }}
        />
      </div>

      <div className="demo-caption">
        <span className="demo-caption__step mono">{stepText || STATE_TEXT[state]}</span>
        <span className="demo-caption__text">{caption}</span>
      </div>
    </div>
  );
}
