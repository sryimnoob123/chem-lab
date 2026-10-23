"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import s from "./plan-replay.module.css";
import { ReplayStage } from "./replay-stage";
import { MOTION_CAPTION, MOTION_MS, motionOf } from "@/lib/plan/piece-motion";
import { PIECES } from "@/lib/plan/pieces";

const TITLE = new Map(PIECES.map((p) => [p.id, p.title]));

/**
 * 方案回放：按学生排的顺序，一块一块演出来。
 *
 * 为什么加这一步（用户 2026-10-23）：拼完直接跳分数「没有互动感」，
 * 学生看不出自己搭的流程长什么样。回放让他先「看见实验」，再看分。
 *
 * 交互口径：
 *   - 默认自动播放，每步时长按动作复杂度给（1.2~1.9 s）
 *   - 可以暂停/继续，也可以「直接看结果」跳过（不阻塞，意愿优先）
 *   - 播完自动进评分
 */
export function PlanReplay({
  pieces,
  onDone,
}: {
  pieces: readonly string[];
  onDone: () => void;
}) {
  /**
   * 相邻同动作合并成一拍：参考方案 28 块逐块演要 40 秒，学生等不完。
   * 合并后通常 8~14 拍，每拍说清「这一类动作做了几次」，节奏才像回放而不是逐帧刷。
   */
  const steps = useMemo(() => {
    const beats: { ids: string[]; title: string; motion: ReturnType<typeof motionOf> }[] = [];
    for (const id of pieces) {
      const motion = motionOf(PIECES.find((p) => p.id === id), id);
      const last = beats[beats.length - 1];
      if (last && last.motion === motion) {
        last.ids.push(id);
      } else {
        beats.push({ ids: [id], title: TITLE.get(id) ?? id, motion });
      }
    }
    return beats;
  }, [pieces]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  /* 自动推进：按当前动作的时长排队，暂停时不排 */
  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const current = steps[step];
    if (!current) return;
    const timer = setTimeout(() => {
      if (step + 1 < steps.length) setStep(step + 1);
      else finish();
    }, MOTION_MS[current.motion]);
    return () => clearTimeout(timer);
  }, [step, playing, steps, finish]);

  /* 空格暂停 / 回车跳过：键盘用户不用去抓小按钮 */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((v) => !v);
      } else if (event.key === "Enter") {
        event.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  if (steps.length === 0) {
    return (
      <div className={s.empty} data-demo-id="demo-replay-empty">
        方案里还没有步骤，先回设计区放几块。
        <button type="button" className={s.primary} onClick={finish}>
          回到设计
        </button>
      </div>
    );
  }

  const current = steps[Math.min(step, steps.length - 1)];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <section className={s.wrap} data-demo-id="demo-replay" aria-label="方案流程回放">
      {/* 进度刻度：一条尺，节点逐个点亮 */}
      <div className={s.rail} role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
        <div className={s.railFill} style={{ transform: `scaleX(${progress / 100})` }} />
        {steps.map((item, index) => (
          <button
            key={`${item.ids[0]}-${index}`}
            type="button"
            className={s.node}
            data-on={index <= step ? "1" : "0"}
            data-now={index === step ? "1" : "0"}
            style={{ left: `${((index + 0.5) / steps.length) * 100}%` }}
            onClick={() => setStep(index)}
            aria-label={`跳到第 ${index + 1} 拍：${item.title}`}
          />
        ))}
      </div>

      <div className={s.stageBox}>
        <ReplayStage key={step} motion={current.motion} />
      </div>

      <div className={s.caption}>
        <span className={s.counter}>
          {step + 1}/{steps.length}
        </span>
        <strong className={s.name} data-demo-id="demo-replay-name">
          {current.title}
        </strong>
        {current.ids.length > 1 ? <span className={s.more}>等 {current.ids.length} 块</span> : null}
        <span className={s.note}>{MOTION_CAPTION[current.motion]}</span>
      </div>

      <div className={s.actions}>
        <button type="button" className={s.ghost} onClick={() => setPlaying((v) => !v)} data-demo-id="demo-replay-toggle">
          {playing ? "暂停" : "继续"}
        </button>
        <button type="button" className={s.ghost} onClick={finish} data-demo-id="demo-replay-skip">
          直接看结果
        </button>
      </div>
    </section>
  );
}
