"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ReactionScene } from "@/components/exp/scene/bench";
import { StepDemo } from "@/components/exp/scene/step-demo";
import { FxByKey } from "@/components/exp/scene/fx";
import { FX_LIST, getFx, type FxKey } from "@/lib/scene/fx";
import styles from "./page.module.css";

type ActiveFx = { key: FxKey; seq: number };

/** 事故大秀：每个 2.8s，播完停在总结帧。 */
const SHOW_STEP_MS = 2800;
const SHOW_SAFETY = "八类事故的共同起点：不戴护具、颠倒顺序、用错量器。";

/**
 * /scene-preview —— 场景验收页（asset-pipeline 独占）
 * - 默认：拖拽反应实验台 + 8 特效按钮 + 双分支演示
 * - `?show=fx`：30 秒无人值守事故大秀（导演台用）
 * - `?demo=1&reagent=agno3&vessel=flask`：事件驱动的预设演出（不依赖真实拖拽）
 */
export default function ScenePreviewPage() {
  const [active, setActive] = useState<ActiveFx | null>(null);
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<"fx" | null>(null);
  const [showIndex, setShowIndex] = useState(0);
  const [showRun, setShowRun] = useState(0);

  // 演示模式走 URL 参数（客户端读取，避免 useSearchParams 的 Suspense 约束）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 参数只在挂载后读一次，避免 SSR 水合不一致
    if (q.get("show") === "fx") setMode("fx");
  }, []);

  // 大秀计时器：到点换下一个；最后一个之后再停 2.8s 进总结帧
  useEffect(() => {
    if (mode !== "fx" || showIndex > FX_LIST.length) return;
    const timer = window.setTimeout(() => setShowIndex((i) => i + 1), SHOW_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [mode, showIndex, showRun]);

  const play = useCallback((key: FxKey) => {
    setDone(false);
    setActive({ key, seq: Date.now() });
  }, []);

  const handleDone = useCallback(() => {
    setDone(true);
  }, []);

  const meta = active ? getFx(active.key) : null;

  if (mode === "fx") {
    const current = showIndex < FX_LIST.length ? FX_LIST[showIndex] : null;
    const ended = showIndex >= FX_LIST.length;
    return (
      <main className={`${styles.page} ${styles.showPage}`}>
        <section className={styles.show} aria-label="事故大秀" data-demo-id="demo-fx-show" data-show-index={showIndex}>
          <header className={styles.showHead}>
            <h1 className={styles.showTitle}>事故大秀 · 8 种实验室事故</h1>
            <p className={styles.showSub}>
              {ended ? `演完 · ${SHOW_SAFETY}` : `${showIndex + 1} / ${FX_LIST.length} · ${current?.label ?? ""}`}
            </p>
          </header>

          <div className={styles.showStage} data-fx-active={current?.key ?? "summary"}>
            {current ? (
              <FxByKey
                key={`${showRun}-${showIndex}`}
                fx={current.key}
                level={current.key === "explosion" || current.key === "glassBreak" ? "L4" : "L3"}
                active
                scale="full"
                onDone={() => undefined}
              />
            ) : (
              <div className={styles.summary} data-demo-id="demo-fx-summary">
                <ul className={styles.summaryList}>
                  {FX_LIST.map((fx) => (
                    <li key={fx.key} className={styles.summaryItem}>
                      <span className={styles.summaryName}>{fx.label}</span>
                      <span className={styles.summaryHint}>{fx.hint}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.summarySafety}>{SHOW_SAFETY}</p>
              </div>
            )}
          </div>

          <footer className={styles.showFoot}>
            <button
              type="button"
              className={`ix ${styles.fxButton}`}
              data-demo-id="demo-fx-show-replay"
              onClick={() => {
                setShowIndex(0);
                setShowRun((n) => n + 1);
              }}
            >
              重播
            </button>
            <a className={`ix ${styles.fxButton}`} href="/scene-preview">
              退出大秀
            </a>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>场景预览 · 拖拽反应与事故特效</h1>
          <p className={styles.subtitle}>
            上半：把试剂拖到锥形瓶/烧杯/试管上，看沉淀、气泡、变色、放热。下半：8 种事故特效，点按钮播放。
          </p>
        </div>
        <Link className={styles.back} href="/">
          返回首页
        </Link>
      </header>

      <p className={styles.entryRow}>
        <a className={`ix ${styles.back}`} href="/scene-preview?show=fx">
          进入 30 秒事故大秀（无人值守）
        </a>
        <a className={`ix ${styles.back}`} href="/scene-preview?demo=1&reagent=agno3&vessel=flask">
          预设演出：AgNO₃ 已投入锥形瓶
        </a>
      </p>

      <section className={styles.section} aria-labelledby="scene-heading">
        <h2 id="scene-heading" className={styles.sectionTitle}>
          拖拽反应实验台
        </h2>
        <ReactionScene />
      </section>

      <section className={styles.section} aria-labelledby="steps-heading">
        <h2 id="steps-heading" className={styles.sectionTitle}>
          7 步双分支演示（成功 / 失败，文案取自 exp09 definition）
        </h2>
        <StepDemo />
      </section>

      <section className={styles.section} aria-labelledby="fx-heading">
        <h2 id="fx-heading" className={styles.sectionTitle}>
          事故特效（8 种）
        </h2>
        <div className={styles.fxLayout}>
          <div className={styles.fxButtons}>
            {FX_LIST.map((fx) => (
              <button
                key={fx.key}
                type="button"
                className={`ix ${styles.fxButton}`}
                data-fx-trigger={fx.key}
                data-demo-id={`${fx.demoId}-trigger`}
                aria-pressed={active?.key === fx.key}
                onClick={() => play(fx.key)}
              >
                <span className={styles.fxLabel}>{fx.label}</span>
                <span className={styles.fxComponent}>{fx.component}</span>
              </button>
            ))}
          </div>

          <div className={`ix ${styles.fxStage}`} data-demo-id="demo-fx-stage" data-fx-active={active?.key ?? "none"}>
            {active ? (
              <FxByKey
                key={active.seq}
                fx={active.key}
                level={active.key === "explosion" || active.key === "glassBreak" ? "L4" : "L3"}
                active
                onDone={handleDone}
                scale="full"
              />
            ) : (
              <p className={styles.fxEmpty}>选一种事故，看它发生。</p>
            )}
            <span className={styles.fxStatus} aria-live="polite">
              {meta ? `${meta.label} · ${meta.loop ? "循环播放" : `${meta.durationMs / 1000}s`}${done ? " · 已播完，停在终态" : ""}` : ""}
            </span>
          </div>
        </div>
        <p className={styles.fxHint}>{meta ? meta.hint : "每张特效都用 SVG + CSS 绘制，不引库；开启「减少动态效果」时只显示静态终态一帧。"}</p>
      </section>
    </main>
  );
}
