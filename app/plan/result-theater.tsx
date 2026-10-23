"use client";

/**
 * 三种结果对照（2026-10-24）
 *
 * 三个按钮 = 可行 / 故障 / 危险。点一个就按那套方案演一遍（复用 PlanReplay 与它那 7 种动作），
 * 演完在播放器上方给一句结论 + 一句「为什么」。
 *
 * 为什么单独一块、不塞进评分卡：评分卡回答「你这份方案多少分」，
 * 这一块回答「同一道题，做对/做错/乱做分别长什么样」—— 两种问题，混在一起学生只会看分数。
 */

import { useState } from "react";
import { PLAN_SCENARIOS } from "@/lib/plan/scenarios";
import { PlanReplay } from "./plan-replay";
import s from "./result-theater.module.css";

export function ResultTheater() {
  /** null = 还没选；选了就播；done = 播完给结论 */
  const [active, setActive] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const scenario = PLAN_SCENARIOS.find((item) => item.id === active) ?? null;

  const play = (id: string) => {
    setActive(id);
    setDone(false);
    setRunKey((key) => key + 1);
  };

  return (
    <section className={s.theater} data-demo-id="demo-result-theater" aria-label="三种结果对照">
      <div className={s.head}>
        <h2 className={s.title}>同一道题，三种结果</h2>
        <span className={s.hint}>点一个，演一遍</span>
      </div>

      <div className={s.tabs} role="tablist">
        {PLAN_SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            className={s.tab}
            data-tone={item.tone}
            data-active={active === item.id}
            data-demo-id={`demo-scenario-${item.id}`}
            onClick={() => play(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {scenario ? (
        <div className={s.stage} data-tone={scenario.tone} data-demo-id="demo-scenario-verdict">
          {done ? (
            <p className={s.verdict}>
              <strong>{scenario.line}</strong>
              <span>{scenario.why}</span>
            </p>
          ) : (
            <p className={s.running}>正在演「{scenario.label}」这条路线…</p>
          )}
          <PlanReplay key={runKey} pieces={scenario.plan.pieces} onDone={() => setDone(true)} />
        </div>
      ) : (
        <p className={s.empty}>上面三个按钮各演一遍：学生看完就知道「能做完」「做得完但错」「根本不能做」差在哪。</p>
      )}
    </section>
  );
}
