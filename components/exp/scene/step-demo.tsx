"use client";

import { useCallback, useState } from "react";
import { DEMO_STEPS, type DemoChoice, type DemoStep } from "@/lib/scene/steps";
import { tapFeedback } from "@/lib/scene/haptics";
import { FxByKey } from "./fx";
import styles from "./step-demo.module.css";

type Phase = "idle" | "ok" | "fail";

type DemoState = {
  stepIndex: number;
  phase: Phase;
  pickedId: string | null;
  attempt: number;
};

function makeState(stepIndex: number): DemoState {
  return { stepIndex, phase: "idle", pickedId: null, attempt: 0 };
}

/** 示意器皿：形状/液面/粉末只做视觉，不参与化学判定。 */
function DemoVessel({ step, filled }: { step: DemoStep; filled: boolean }) {
  const cls = `${styles.vessel} ${filled ? styles.filled : styles.unfilled}`;
  const liquidStyle = { fill: step.liquid };
  if (step.shape === "burette") {
    return (
      <svg className={cls} viewBox="0 0 160 220" width="150" height="206" aria-hidden="true">
        <rect x="62" y="12" width="36" height="168" fill="#fff" fillOpacity="0.5" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
        <rect className={styles.liquid} x="65" y="15" width="30" height="150" style={liquidStyle} fillOpacity="0.85" />
        <rect x="52" y="180" width="56" height="16" rx="3" fill="#fff" fillOpacity="0.5" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
        <path d="M74 196 H86 V200 L84 216 H76 L74 200 Z" fill="#fff" fillOpacity="0.5" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
        <line x1="66" y1="20" x2="66" y2="172" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        <g stroke="#16202C" strokeOpacity="0.6" strokeWidth="0.9">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1="82" y1={24 + i * 16} x2={i % 2 === 0 ? 94 : 90} y2={24 + i * 16} />
          ))}
        </g>
      </svg>
    );
  }
  if (step.shape === "flask") {
    return (
      <svg className={cls} viewBox="0 0 160 220" width="176" height="242" aria-hidden="true">
        <path d="M64 22 H96 V78 L134 196 Q136 202 129 202 H31 Q24 202 26 196 L64 78 Z" fill="#fff" fillOpacity="0.5" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
        <line x1="61" y1="22" x2="99" y2="22" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
        <path className={styles.liquid} d="M40 196 L56 130 H104 L120 196 Z" style={liquidStyle} fillOpacity="0.75" />
        <line x1="70" y1="34" x2="40" y2="150" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        {step.powder ? (
          <path className={styles.powder} d="M56 196 q24 -12 48 0 z" fill="#F4F1E8" stroke="#16202C" strokeOpacity="0.22" strokeWidth="0.8" />
        ) : null}
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 160 220" width="176" height="242" aria-hidden="true">
      <path
        d="M30 34 H130 V188 Q130 198 120 198 H40 Q30 198 30 188 Z"
        fill="#fff"
        fillOpacity="0.55"
        stroke="#16202C"
        strokeOpacity="0.7"
        strokeWidth="1.4"
      />
      <ellipse cx="80" cy="34" rx="50" ry="6" fill="none" stroke="#16202C" strokeOpacity="0.6" strokeWidth="1.4" />
      <rect
        className={styles.liquid}
        x="34"
        y={196 - Math.round(step.fill * 150)}
        width="92"
        height={Math.round(step.fill * 150)}
        style={{ ...liquidStyle, transformOrigin: "bottom" }}
        fillOpacity="0.65"
      />
      <line x1="36" y1="46" x2="36" y2="186" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      {step.powder ? (
        <path className={styles.powder} d="M52 194 q28 -16 56 0 z" fill="#F4F1E8" stroke="#16202C" strokeOpacity="0.22" strokeWidth="0.8" />
      ) : null}
    </svg>
  );
}

export function StepDemo() {
  const [state, setState] = useState<DemoState>(() => makeState(1));
  /** 进入本步时的快照：重做 = 还原到这里（后续接真实步骤时同样用 structuredClone）。 */
  const [snapshot, setSnapshot] = useState<DemoState>(() => makeState(1));

  const step = DEMO_STEPS.find((s) => s.index === state.stepIndex) ?? DEMO_STEPS[0];
  const picked = step.choices.find((c) => c.id === state.pickedId) ?? null;
  const terminated = state.phase === "fail" && picked?.terminate === true;
  const isLast = step.index === DEMO_STEPS.length;

  const pick = useCallback((choice: DemoChoice) => {
    tapFeedback(choice.ok ? 8 : 12);
    setState((prev) => ({
      ...prev,
      phase: choice.ok ? "ok" : "fail",
      pickedId: choice.id,
      attempt: prev.attempt + 1,
    }));
  }, []);

  const advance = useCallback(() => {
    const next = makeState(Math.min(state.stepIndex + 1, DEMO_STEPS.length));
    setSnapshot(next);
    setState(next);
  }, [state.stepIndex]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...structuredClone(snapshot), attempt: prev.attempt + 1 }));
  }, [snapshot]);

  const restart = useCallback(() => {
    const init = makeState(1);
    setState(init);
    setSnapshot(init);
  }, []);

  const showPulse = state.phase === "ok";
  const showFail = state.phase === "fail";

  return (
    <section className={styles.card} data-demo-id="demo-step-card" data-step-state={state.phase} data-step-index={step.index}>
      <div className={styles.visual}>
        {showFail && picked?.fx ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <FxByKey fx={picked.fx} active scale="inline" onDone={() => undefined} />
            <span className={styles.badge}>✕ 操作错误</span>
          </div>
        ) : (
          <svg viewBox="0 0 220 230" width="220" height="230" aria-hidden="true">
            <g key={`v-${step.index}-${state.attempt}`} className={showFail ? styles.shake : styles.vessel}>
              <g transform="translate(30 8)">
                <DemoVessel step={step} filled={showPulse} />
              </g>
            </g>
            {showPulse ? <rect key={`p-${state.attempt}`} className={styles.pulse} x="16" y="6" width="188" height="216" rx="12" /> : null}
            {showFail ? <rect key={`f-${state.attempt}`} className={styles.failFlash} x="16" y="6" width="188" height="216" rx="12" /> : null}
          </svg>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.stepTitle}>
          第 {step.index} / {DEMO_STEPS.length} 步 · {step.title}
        </h3>
        <p className={styles.prompt}>{step.prompt}</p>

        <div className={styles.reading} aria-live="polite">
          <span className={styles.readingLabel}>本步读数</span>
          <span
            className={`ix ${styles.readingValue} ${showPulse ? "ix-pop" : ""}`}
            key={`r-${state.attempt}-${state.phase}`}
            tabIndex={0}
            role="status"
            data-demo-id="demo-step-reading"
          >
            {state.phase === "ok" && picked?.value ? picked.value : "—"}
          </span>
        </div>

        <ul className={styles.options}>
          {step.choices.map((choice) => (
            <li key={choice.id}>
              <button
                type="button"
                className={`ix ${styles.option}`}
                data-option-id={choice.id}
                data-option-ok={choice.ok ? "true" : "false"}
                data-picked={state.pickedId === choice.id ? "true" : "false"}
                disabled={state.phase !== "idle"}
                onClick={() => pick(choice)}
              >
                {choice.ok ? "规范操作 · " : "风险操作 · "}
                {choice.label}
              </button>
            </li>
          ))}
        </ul>

        {state.phase === "ok" && picked ? (
          <div className={`ix-enter ${styles.branch} ${styles.branchOk}`} data-demo-id={`demo-feedback-ok-${step.index}`}>
            <span className={styles.branchLine1}>✓ 操作正确 · {picked.title}</span>
            <span className={styles.branchLine2}>{picked.detail}</span>
          </div>
        ) : null}

        {showFail && picked ? (
          <div
            className={`ix-enter ${styles.branch} ${styles.branchFail}`}
            data-demo-id={`demo-feedback-fail-${step.index}`}
            data-fx={picked.fx ?? "none"}
            data-level={picked.level ?? ""}
          >
            <span className={styles.branchLine1}>
              ✕ {picked.level ? `${picked.level} · ` : ""}
              {picked.title}
            </span>
            <span className={styles.branchLine2}>为什么：{picked.detail}</span>
          </div>
        ) : null}

        {terminated ? (
          <div className={`${styles.branch} ${styles.branchFail}`} data-demo-id={`demo-feedback-terminate-${step.index}`}>
            <span className={styles.branchLine1}>✕ L4 危险操作 · 实验终止</span>
            <span className={styles.branchLine2}>本步触发终止条件，不能重做这一步；点「重新演示」从头开始。</span>
          </div>
        ) : null}

        <div className={styles.actions}>
          {state.phase === "ok" ? (
            <button type="button" className={`ix ${styles.button}`} data-primary="true" data-demo-id="demo-step-next" onClick={isLast ? restart : advance}>
              {isLast ? "重新演示" : "下一步"}
            </button>
          ) : null}
          {showFail && !terminated ? (
            <button type="button" className={`ix ${styles.button}`} data-demo-id={`demo-retry-${step.index}`} onClick={retry}>
              重做本步
            </button>
          ) : null}
          {terminated ? (
            <button type="button" className={`ix ${styles.button}`} data-primary="true" data-demo-id={`demo-restart-${step.index}`} onClick={restart}>
              重新演示
            </button>
          ) : null}
          {state.phase === "idle" && step.index > 1 ? (
            <button type="button" className={`ix ${styles.button}`} data-demo-id="demo-step-back" onClick={restart}>
              从头再演示
            </button>
          ) : null}
        </div>

        <p className={styles.hint}>
          文案全部取自 `experiments/exp09/definition.ts`；失败不锁死（L4 除外）：点「重做本步」回到本步开始状态，再选正确项即可通过。
        </p>
      </div>
    </section>
  );
}
