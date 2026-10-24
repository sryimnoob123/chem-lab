"use client";

/**
 * 三种结果对照（2026-10-24）
 *
 * 三个按钮 = 可行 / 故障 / 危险。点一个就按那套方案演一遍（复用 PlanReplay 与它那 7 种动作），
 * 演完在播放器上方给一句结论 + 一句「为什么」。
 *
 * 为什么单独一块、不塞进评分卡：评分卡回答「你这份方案多少分」，
 * 这一块回答「同一道题，做对/做错/乱做分别长什么样」—— 两种问题，混在一起学生只会看分数。
 *
 * 2026-10-24 二轮：① 三枚按钮改成三列等分 + 未选态就带绿/黄/红分类色（原来灰得一模一样）；
 * ② 去掉 role="tablist" —— 这三枚不是标签页，是「播哪条路线」，aria-pressed 更诚实；
 * ③ 方案为空时直接出结论，不再永远停在「正在演…」。
 */

import { useState } from "react";
import { PLAN_SCENARIOS } from "@/lib/plan/scenarios";
import { PlanReplay } from "./plan-replay";
import s from "./result-theater.module.css";

/** 按钮副标题：说清「这三种结果」各是什么，但不剧透结论（结论文案演完才给）。 */
const TONE_SUB: Record<string, string> = {
  ok: "能做，且数据站得住",
  warn: "做得完，但读数会偏",
  danger: "根本不能这么做",
};

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

  /* 空方案（理论上不会出现，但别让 UI 卡在「正在演」）：没有步骤就直接给结论 */
  const playable = Boolean(scenario && scenario.plan.pieces.length > 0);
  const showVerdict = Boolean(scenario) && (done || !playable);

  return (
    <section className={s.theater} data-demo-id="demo-result-theater" aria-label="三种结果对照">
      <div className={s.head}>
        <h2 className={s.title}>同一道题，三种结果</h2>
        <span className={s.hint}>点一个，演一遍</span>
      </div>

      <div className={s.tabs} role="group" aria-label="选择要演的路线">
        {PLAN_SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={active === item.id}
            className={s.tab}
            data-tone={item.tone}
            data-active={active === item.id}
            data-demo-id={`demo-scenario-${item.id}`}
            onClick={() => play(item.id)}
          >
            <span className={s.tabLabel}>{item.label}</span>
            <span className={s.tabSub}>{TONE_SUB[item.tone] ?? ""}</span>
          </button>
        ))}
      </div>

      {scenario ? (
        <div className={s.stage} data-tone={scenario.tone} data-demo-id="demo-scenario-verdict">
          {showVerdict ? (
            <p className={s.verdict} aria-live="polite">
              <strong>{scenario.line}</strong>
              <span>{scenario.why}</span>
            </p>
          ) : (
            <p className={s.running}>正在演「{scenario.label}」这条路线…</p>
          )}
          {playable ? <PlanReplay key={runKey} pieces={scenario.plan.pieces} onDone={() => setDone(true)} /> : null}
        </div>
      ) : (
        <p className={s.empty}>上面三个按钮各演一遍：学生看完就知道「能做完」「做得完但错」「根本不能做」差在哪。</p>
      )}
    </section>
  );
}
