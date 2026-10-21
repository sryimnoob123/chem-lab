"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getDefinition } from "@/lib/engine";
import type { Action, FxKey as EngineFxKey } from "@/lib/engine.types";
import { FxByKey } from "@/components/exp/scene/fx";
import { ScoreOdometer, StreakPill } from "@/components/exp/feedback";
import { MissionBoard, type MissionParam } from "@/components/exp/guide/mission-board";
import { stepVerb } from "@/components/exp/guide/step-verb";
import { NextActionCard } from "@/components/exp/guide/NextActionCard";
import { ResultBar } from "@/components/exp/guide/ResultBar";
import {
  ACTION_VERB,
  guideName,
  nextLine,
  resultText,
  whyLine,
  type StepDotState,
} from "@/components/exp/guide/copy";
import { missionGoal, missionGuide, missionProgress } from "@/components/exp/guide/mission-copy";
import { nextReagentId, resolveDrop, type DropReject } from "@/components/exp/guide/drop-resolve";
// 新手教学（Lead 交付）：不传 open = 没看过就自动弹，看过不再打扰。
import { ExperimentOnboarding } from "@/components/exp/onboarding";
import {
  ErrorToast,
  IncidentBanner,
  RejectHint,
  errorMessage,
} from "@/components/exp/incident";
import guide from "@/components/exp/guide/guide.module.css";
import { SoundToggle } from "@/components/audio/sound-toggle";
import { ensureAudio, playSound } from "@/lib/audio/engine";
import type { FxKey as SceneFxKey } from "@/lib/scene/fx";
import { ExperimentDock } from "./experiment-dock";
import { rackIdsFor } from "./rack-ids";
import { SceneStage } from "./scene-stage";
import { teacherNote } from "./teacher-notes";
import {
  createWorkbenchState,
  currentStep,
  operationScore,
  workbenchReducer,
} from "./use-workbench";
import styles from "./workbench.module.css";

/** RejectHint 的兜底三行（拒收永远给完整的三段信息，不留空）。 */
const REJECT_FALLBACK = [
  "这一步投不进去",
  "当前步骤不接受这个试剂",
  "按上方「建议动作」再试一次",
] as const;

const FX_MAP: Record<EngineFxKey, SceneFxKey> = {
  "boil-over": "boilOver",
  explosion: "explosion",
  "toxic-gas": "toxicGas",
  burn: "burn",
  "glass-break": "glassBreak",
  fire: "fire",
  "heavy-metal": "heavyMetal",
  "device-accident": "deviceAccident",
};

const PARAM_NAMES: Record<string, string> = {
  volume: "体积",
  initialReading: "初读数",
  finalReading: "终读数",
  relativeRange: "相对极差",
  drops: "滴数",
  mass: "质量",
  relativeDeviation: "相对平均偏差",
  maxLoad: "最大载荷",
  resolution: "分度值",
  count: "件数",
  yield: "产率",
  excess: "过量体积",
  ph: "pH",
  washes: "洗涤次数",
};

const INPUT_MODES = [
  { id: "drag", label: "拖拽" },
  { id: "click", label: "点选" },
  { id: "key", label: "键盘" },
  { id: "event", label: "事件" },
  { id: "auto", label: "自动" },
] as const;

type InputMode = (typeof INPUT_MODES)[number]["id"];

type DropAudit = {
  kind: "drop";
  reagentId: string;
  vesselId: string;
  inputMode: InputMode;
  outcome: "info" | "success" | "failure";
  reactionText: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function Workbench({
  expId,
  demoReagent,
  demoVessel,
  demoReadonly = false,
}: {
  expId: string;
  demoReagent?: string;
  demoVessel?: string;
  demoReadonly?: boolean;
}) {
  const router = useRouter();
  const [ui, dispatch] = useReducer(workbenchReducer, expId, createWorkbenchState);
  const [sceneCaption, setSceneCaption] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [studentNo, setStudentNo] = useState("—");
  const [finishing, setFinishing] = useState(false);
  /**
   * 「跳过实验」只在演示模式出现（?demo=1 或 ?play=demo）。
   * 学生正常流程看不到 —— 否则等于教人逃课（用户 2026-10-21 的顾虑）。
   */
  const [skipVisible, setSkipVisible] = useState(false);
  const [mode, setMode] = useState<InputMode>("drag");
  const [lastInputMode, setLastInputMode] = useState<InputMode | null>(null);
  const [autoTick, setAutoTick] = useState(0);
  /** 拖拽被拒（E1）：+1 让底部结果条重播一次 ✗ 抖动，本步不动。 */
  const [reject, setReject] = useState<{
    seq: number;
    lines: readonly [string, string, string];
    point?: { x: number; y: number };
  } | null>(null);
  /** E3 系统错误：人话一句 + 可选重试（技术原文不上面）。 */
  const [systemError, setSystemError] = useState<{
    message: string;
    detail?: string;
    canRetry: boolean;
  } | null>(null);
  const actionsRef = useRef<HTMLElement | null>(null);
  const runIdRef = useRef<string | null>(null);
  const queueRef = useRef<Array<{ action: Action; inputMode: InputMode }>>([]);
  const inflightRef = useRef<Promise<unknown>[]>([]);
  /** 串行发送链：同一 run 的动作必须按点击顺序落库，避免并发 POST 乱序被判 invalid。 */
  const sendChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const bootstrapRef = useRef<Promise<string | null> | null>(null);
  const dropQueueRef = useRef<DropAudit[]>([]);
  const lastSceneRef = useRef<{
    reagentId?: string;
    vesselId?: string;
    mode?: InputMode;
  }>({});
  const pendingReagentRef = useRef<string | null>(null);
  const autoTargetRef = useRef<number | null>(null);
  const autoBusyRef = useRef(false);
  const stepRef = useRef<ReturnType<typeof currentStep> | null>(null);
  const finishingRef = useRef(false);
  const modeReadyRef = useRef(false);

  const sendAction = useCallback(
    (
      action: Action,
      inputMode: InputMode = "click",
    ) => {
      if (demoReadonly || finishingRef.current) return;
      const payload: Action = {
        ...action,
        params: { ...action.params, inputMode },
      };
      const runId = runIdRef.current;
      if (!runId) {
        queueRef.current.push({ action: payload, inputMode });
        return;
      }
      const task = sendChainRef.current
        .then(async () => {
          await fetch(`/api/runs/${runId}/events`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ events: [payload] }),
          });
        })
        .catch((error: unknown) => {
          // E3 系统错误：接口没落库；音效只提示，不承载信息。
          playSound("error-system");
          const detail = errorMessage(error);
          setSystemError({ message: detail.message, canRetry: detail.retryable });
        });
      sendChainRef.current = task;
      inflightRef.current.push(task);
    },
    [demoReadonly],
  );

  const sendDrop = useCallback(
    (drop: DropAudit) => {
      if (demoReadonly || finishingRef.current) return;
      const runId = runIdRef.current;
      if (!runId) {
        dropQueueRef.current.push(drop);
        return;
      }
      const task = sendChainRef.current
        .then(async () => {
          await fetch(`/api/runs/${runId}/drops`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(drop),
          });
        })
        .catch(() => {
          playSound("error-system");
        });
      sendChainRef.current = task;
      inflightRef.current.push(task);
    },
    [demoReadonly],
  );

  const bootstrap = useCallback(async (): Promise<string | null> => {
    try {
      const sessionRes = await fetch("/api/session");
      const session = await sessionRes.json().catch(() => null);
      if (session?.ok && session.student?.studentNo) {
        setStudentNo(String(session.student.studentNo));
      }

      if (demoReadonly) return null;

      const runRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experimentId: expId }),
      });
      if (!runRes.ok) return null;
      const data = await runRes.json().catch(() => null);
      if (!data?.ok || typeof data.runId !== "string") return null;

      runIdRef.current = data.runId;
      const queued = queueRef.current.splice(0);
      queued.forEach((item) => sendAction(item.action, item.inputMode));
      const queuedDrops = dropQueueRef.current.splice(0);
      queuedDrops.forEach((drop) => sendDrop(drop));
      return data.runId;
    } catch {
      return null;
    }
  }, [demoReadonly, expId, sendAction, sendDrop]);

  useEffect(() => {
    if (!bootstrapRef.current) bootstrapRef.current = bootstrap();
    void bootstrapRef.current;
  }, [bootstrap]);

  useEffect(() => {
    router.prefetch(`/exp/${expId}/report`);
  }, [router, expId]);

  useEffect(() => {
    if (!modeReadyRef.current) return;
    window.localStorage.setItem("chem-lab:input-mode", mode);
  }, [mode]);

  useEffect(() => {
    const saved = window.localStorage.getItem("chem-lab:input-mode");
    if (saved !== "drag" && saved !== "click" && saved !== "key" && saved !== "event" && saved !== "auto") {
      modeReadyRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      setMode(saved);
      setLastInputMode(saved);
      modeReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!demoReagent || !demoVessel) return;
    const timer = window.setTimeout(() => {
      setMode("event");
      setLastInputMode("event");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoReagent, demoVessel]);

  const handleSceneInput = useCallback(
    (inputMode: "drag" | "click" | "event") => {
      setLastInputMode(inputMode);
      if (inputMode === "event" && demoReagent && demoVessel) {
        lastSceneRef.current = {
          reagentId: demoReagent,
          vesselId: demoVessel,
          mode: "event",
        };
      } else if (lastSceneRef.current.reagentId) {
        lastSceneRef.current.mode = inputMode;
      }
    },
    [demoReagent, demoVessel],
  );

  const handleSceneCaption = useCallback(
    (text: string | null) => {
      setSceneCaption(text);
      if (!text) return;
      const scene = lastSceneRef.current;
      if (!scene.reagentId || !scene.vesselId) return;
      if (demoReadonly) return;
      sendDrop({
        kind: "drop",
        reagentId: scene.reagentId,
        vesselId: scene.vesselId,
        inputMode: scene.mode ?? "click",
        outcome: "info",
        reactionText: text,
      });
    },
    [demoReadonly, sendDrop],
  );

  useEffect(() => {
    const onDrop = (event: DragEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[data-demo-id="demo-scene-drop-flask"]')) return;
      const reagentId =
        event.dataTransfer?.getData("text/plain") || pendingReagentRef.current || "";
      if (!reagentId) return;
      lastSceneRef.current = { reagentId, vesselId: "flask", mode: "drag" };
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const hit = target?.closest("[data-demo-id]");
      const demoId = hit?.getAttribute("data-demo-id") ?? "";
      if (demoId.startsWith("demo-scene-reagent-")) {
        pendingReagentRef.current = demoId.slice("demo-scene-reagent-".length);
        return;
      }
      if (demoId === "demo-scene-drop-flask" && pendingReagentRef.current) {
        lastSceneRef.current = {
          reagentId: pendingReagentRef.current,
          vesselId: "flask",
          mode: "click",
        };
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const demoId = target?.closest("[data-demo-id]")?.getAttribute("data-demo-id") ?? "";
      if (demoId.startsWith("demo-scene-reagent-")) {
        pendingReagentRef.current = demoId.slice("demo-scene-reagent-".length);
      }
    };

    document.addEventListener("drop", onDrop, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, []);

  useEffect(() => {
    if (ui.retrySeq > 0) actionsRef.current?.focus();
  }, [ui.retrySeq]);

  const definition = getDefinition(expId);

  if (!definition) throw new Error(`unknown experiment: ${expId}`);

  const step = currentStep(ui.exp) ?? definition.steps[0];

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const total = definition.steps.length;
  const stepNo = step.index + 1;
  /** 刚走完上一步（L2）：器皿一次性高光，只在推进那一帧给。 */
  const stepDoneKey =
    ui.event?.outcome === "success" && ui.event.stepNumber < stepNo ? ui.event.stepNumber : undefined;
  const expNo = expId.startsWith("exp") ? expId.slice(3) : definition.id;
  const isExp09 = expId === "exp09";
  const terminated = ui.exp.incidents.some((record) => record.terminate);
  const score = operationScore(ui);

  const stepStates = definition.steps.map((item, index) => {
    if (ui.exp.done) return "done";
    if (index < ui.exp.stepIndex) return "done";
    if (index === ui.exp.stepIndex) return "current";
    return "todo";
  });

  const performed = useMemo(
    () =>
      new Set(
        (ui.exp.stepLog ?? [])
          .filter((entry) => entry.stepIndex === ui.exp.stepIndex)
          .map((entry) => entry.choiceId),
      ),
    [ui.exp.stepLog, ui.exp.stepIndex],
  );

  // 引导：建议动作 = 第一个没做过、前置已满足的正确动作；其余收进「其他做法」
  const availableChoice = step.choices.find(
    (item) =>
      item.role === "correct" &&
      !performed.has(item.choiceId) &&
      !(item.requires ?? []).some((id) => !performed.has(id)),
  );
  const suggested =
    availableChoice ??
    step.choices.find((item) => item.role === "correct") ??
    step.choices[0];
  const suggestedKey = suggested ? step.choices.indexOf(suggested) + 1 : undefined;
  const otherChoices = step.choices.filter((item) => item.choiceId !== suggested?.choiceId);

  /** 场景内流程指引：下一步该用哪瓶试剂 —— 试剂架微亮 + 锥形瓶脉冲，和看板指向同一动作。 */
  const nextReagent = nextReagentId(step, performed, rackIdsFor(expId));

  // 每步用时：时间线显示 "✓ 第 1 步 · 洗涤 12s"。时间只在 effect/事件里读，渲染期不调 Date.now()
  const stepClockRef = useRef<{ index: number; start: number } | null>(null);
  const [stepSeconds, setStepSeconds] = useState<Record<number, number>>({});
  useEffect(() => {
    const index = ui.exp.stepIndex;
    const clock = stepClockRef.current;
    if (!clock) {
      stepClockRef.current = { index, start: Date.now() };
      return;
    }
    if (clock.index === index) return;
    const finished = clock.index;
    const spent = Math.max(1, Math.round((Date.now() - clock.start) / 1000));
    stepClockRef.current = { index, start: Date.now() };
    const timer = window.setTimeout(() => {
      setStepSeconds((previous) => ({ ...previous, [finished]: spent }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ui.exp.stepIndex]);

  // 两段式反馈：先出结果（0~600ms），再把「下一步」滑出来；phase 由点击事件驱动
  const [guidePhase, setGuidePhase] = useState<"result" | "next">("next");
  const nextPhaseTimerRef = useRef<number | null>(null);
  const armNextPhase = useCallback(() => {
    if (nextPhaseTimerRef.current !== null) window.clearTimeout(nextPhaseTimerRef.current);
    setGuidePhase("result");
    nextPhaseTimerRef.current = window.setTimeout(() => {
      nextPhaseTimerRef.current = null;
      setGuidePhase("next");
    }, 600);
  }, []);
  useEffect(
    () => () => {
      if (nextPhaseTimerRef.current !== null) window.clearTimeout(nextPhaseTimerRef.current);
    },
    [],
  );

  const lastChoice = (() => {
    if (!ui.lastChoiceId) return undefined;
    for (const item of definition.steps) {
      const found = item.choices.find((choice) => choice.choiceId === ui.lastChoiceId);
      if (found) return found;
    }
    return undefined;
  })();

  const resultCopy = resultText({
    outcome: ui.event?.outcome ?? "success",
    type: lastChoice?.type,
    params: lastChoice?.params,
    observationText: lastChoice?.observation?.text,
    observationValue: lastChoice?.observation?.value,
    shortTitle: ui.event?.shortTitle ?? "",
    correct: ui.event?.correct,
    deduction: ui.event?.deduction ?? 0,
  });
  // stepDoneKey = 结果条上那条事件属于"上一步"（步骤刚推进）。
  // 这时再显示上一步的文案，会和看板上的"第 N 步"打架（红队 2026-10-21 报：第 2 步校准，
  // 底部还写"容量瓶、量筒自然晾干"）。改成一句进入当前步的说明。
  const resultLine =
    notice ??
    sceneCaption ??
    (stepDoneKey
      ? `进入第 ${stepNo} 步 · ${step.title}`
      : ui.event
        ? resultCopy.line
        : "点建议动作或拖试剂");
  const resultLine2 = ui.event ? resultCopy.line2 : undefined;
  const dots: StepDotState[] = stepStates.map((state) =>
    state === "done" ? "done" : state === "current" ? "current" : "todo",
  );
  const nextText =
    ui.event && !ui.exp.done && guidePhase === "next" && suggested
      ? nextLine(suggested.type, suggested.label)
      : null;

  const burette = ui.exp.entities["burette-base"];
  const reading = typeof burette?.reading === "number" ? burette.reading : 0;
  const flask = ui.exp.entities["flask-1"];
  const indicatorAdded = Boolean(flask?.note?.includes("酚酞"));
  const endpointReached = ui.exp.observations.some((item) => item.text.includes("终点"));
  const indicator = indicatorAdded ? (endpointReached ? "浅粉红" : "无色") : "未加";
  const tolerance = step.judge.tolerance;
  const toleranceValue = tolerance ? `±${tolerance.tolerance}` : "—";
  const toleranceUnit = tolerance?.unit ?? "";
  const toleranceName = tolerance ? PARAM_NAMES[tolerance.paramKey] ?? tolerance.paramKey : "";
  const readingNote =
    ui.exp.stepIndex < 4 ? "滴定管尚未装液" : reading === 0 ? "已调零，待滴定" : "凹液面读数";
  const hasAbnormality = ui.exp.incidents.length + ui.exp.violations.length > 0;

  /**
   * 看板折叠抽屉里的参数格（减法）：右栏只留大字读数 + 允许误差，
   * 其余（已用体积 / 指示剂 / 观察记录 / 违规事故）都收进看板折叠区。
   */
  const boardParams: MissionParam[] = isExp09
    ? [
        { label: "已用体积 V", value: reading.toFixed(2), unit: "mL", note: "初读数 0.00 起算" },
        { label: "指示剂颜色", value: indicator, note: "酚酞 2 滴 / 第 05 步加入" },
      ]
    : [
        {
          label: "观察记录",
          value: String(ui.exp.observations.length),
          unit: "条",
          note: "按 doc 记录",
        },
        {
          label: "违规 / 事故",
          value: String(ui.exp.violations.length + ui.exp.incidents.length),
          unit: "条",
          note: "已记录",
          tone: hasAbnormality ? "warn" : "normal",
        },
      ];
  /** 第四行：本步指引；取过提示就换成那条提示（同屏只留一条）。 */
  const boardGuide = missionGuide(ui.hint?.text, step.title);

  const eventState = notice
    ? "warn"
    : sceneCaption
      ? "info"
      : ui.event
        ? ui.event.outcome === "success"
          ? "success"
          : ui.event.severity
        : "info";
  const showRetry =
    Boolean(ui.event) &&
    ui.event?.outcome === "failure" &&
    !ui.event.terminate &&
    !ui.exp.done;
  const numberPop = ui.event?.outcome === "success" ? "true" : undefined;
  const feedbackDemoId = ui.event
    ? ui.event.outcome === "success"
      ? `demo-feedback-ok-${ui.event.stepNumber}`
      : `demo-feedback-fail-${ui.event.stepNumber}`
    : undefined;

  const fx =
    ui.event?.incident && ui.event.fx && (ui.event.level === "L3" || ui.event.level === "L4") ? (
      <FxByKey
        key={`${ui.event.fxSeq ?? 0}-${ui.event.fx}`}
        fx={FX_MAP[ui.event.fx]}
        level={ui.event.level}
        active
        scale="inline"
      />
    ) : null;

  const choose = useCallback(
    (choiceId: string, inputMode?: InputMode) => {
      const resolved = inputMode ?? mode;
      const current = stepRef.current;
      const choice = current?.choices.find((item) => item.choiceId === choiceId);
      if (choice) {
        setLastInputMode(resolved);
        // 音效要在用户手势里把 AudioContext 建起来；之后 effect 里的反馈音才发得出来。
        ensureAudio();
        if (choice.type === "readInstrument" || choice.type === "titrate") playSound("tick");
        sendAction(
          {
            type: choice.type,
            choiceId: choice.choiceId,
            competency: choice.competency,
          },
          resolved,
        );
      }
      setSceneCaption(null);
      setNotice(null);
      dispatch({ type: "choose", choiceId, label: "" });
      armNextPhase();
    },
    [armNextPhase, mode, sendAction],
  );

  /** 拖拽三段式 · 段 3a：倒入动画播完后才走到这里 —— 这时才推进步骤。 */
  const handleDropAccepted = useCallback(
    (choiceId: string, inputMode: "drag" | "click" | "event") => choose(choiceId, inputMode),
    [choose],
  );

  /** 拖拽三段式 · 段 3b：拒收只给一句为什么，本步不动，允许原地再投。 */
  const handleDropRejected = useCallback((verdict: DropReject, point?: { x: number; y: number }) => {
    setSceneCaption(null);
    setNotice(verdict.line);
    setReject((previous) => ({ seq: (previous?.seq ?? 0) + 1, lines: verdict.lines, point }));
    playSound("fail-reject");
  }, []);

  /** 这一投算不算：用当前步 + 本步已做的动作同步判定（纯函数，见 guide/drop-resolve）。 */
  const resolveCurrentDrop = (reagentId: string) => resolveDrop(step, reagentId, performed);

  /** 音效与结果条同步：同一次反馈只响一次（ok-l1 单动作 / ok-l2 一步完成 / 事故 / 拒收）。 */
  const sfxSeqRef = useRef(ui.feedbackSeq);
  useEffect(() => {
    if (ui.feedbackSeq === sfxSeqRef.current) return;
    sfxSeqRef.current = ui.feedbackSeq;
    const event = ui.event;
    if (!event) return;
    if (event.incident && (event.level === "L3" || event.level === "L4")) {
      playSound("fail-incident");
      return;
    }
    if (event.outcome === "success") {
      playSound(event.stepNumber < stepNo ? "ok-l2" : "ok-l1");
      return;
    }
    if (!event.incident) playSound("fail-reject");
  }, [stepNo, ui.event, ui.feedbackSeq]);

  const retry = useCallback(() => {
    setSceneCaption(null);
    setNotice(null);
    dispatch({ type: "retry" });
    if (nextPhaseTimerRef.current !== null) window.clearTimeout(nextPhaseTimerRef.current);
    nextPhaseTimerRef.current = null;
    setGuidePhase("next");
  }, []);

  const switchMode = (next: InputMode) => {
    setMode(next);
    setLastInputMode(next);
    if (next === "auto") {
      autoTargetRef.current = ui.exp.stepIndex;
      setAutoTick((tick) => tick + 1);
    }
  };

  const finish = useCallback(async () => {
    if (demoReadonly) {
      router.push(`/exp/${expId}/report?demo=1`);
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    let runId = runIdRef.current;
    let finishedOk = false;
    try {
      if (!runId) runId = await (bootstrapRef.current ?? Promise.resolve(null));
      if (runId) {
        await Promise.allSettled(inflightRef.current);
        const res = await fetch(`/api/runs/${runId}/finish`, { method: "POST" }).catch(() => null);
        finishedOk = Boolean(res?.ok);
      }
    } finally {
      finishingRef.current = false;
      setFinishing(false);
      // 一键演示结束要把交互方式复位，否则下一场手动打开还是"自动"，
      // 会在没人操作时自己往下跑（用户 2026-10-21 要求）。
      try {
        window.localStorage.removeItem("chem-lab:input-mode");
      } catch {
        /* 隐私模式下 setItem/removeItem 会抛，忽略 */
      }
      router.push(
        runId && finishedOk
          ? `/exp/${expId}/report?runId=${runId}${mode === "auto" ? "&auto=1" : ""}`
          : `/exp/${expId}/report${mode === "auto" ? "?auto=1" : ""}`,
      );
    }
  }, [demoReadonly, expId, mode, router]);

  // 一键演示：auto 模式下最后一步做完就自动交卷并落到报告页，
  // 不再停在"交卷并查看报告"让评委多点一下（用户 2026-10-21 要求）。
  useEffect(() => {
    if (mode !== "auto" || demoReadonly || finishingRef.current) return;
    if (ui.exp.stepIndex < total - 1) return;
    const stillActionable = step.choices.some(
      (item) =>
        item.role !== "trap" &&
        !performed.has(item.choiceId) &&
        !(item.requires ?? []).some((id) => !performed.has(id)),
    );
    if (!stillActionable) {
      void finish();
      return;
    }
    // 最后一步常挂着"观察/读数"这类可选动作，auto 不会去点它们（没有推进效果）。
    // 等 8 秒还没往下走就直接交卷，否则一键演示会停在台面上。
    const timer = window.setTimeout(() => {
      if (!finishingRef.current) void finish();
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [mode, demoReadonly, finish, performed, step, total, ui.exp.stepIndex]);

  useEffect(() => {
    // 放进 setTimeout(0)：Next 16 的 react-hooks/set-state-in-effect 不允许在 effect 里同步 setState
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setSkipVisible(params.get("demo") === "1" || params.get("play") === "demo");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [contenteditable='']",
        )
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "h") {
        event.preventDefault();
        if (!ui.exp.done) dispatch({ type: "hint" });
        return;
      }
      if (key === "r") {
        event.preventDefault();
        if (!ui.exp.done) retry();
        return;
      }
      if (event.key === "Enter") {
        if (ui.exp.done) {
          event.preventDefault();
          void finish();
        }
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        const choice = step.choices[Number(event.key) - 1];
        if (!choice) return;
        event.preventDefault();
        const needs = (choice.requires ?? []).some((id) => !performed.has(id));
        const done = performed.has(choice.choiceId);
        if (ui.exp.done || needs || done) {
          setNotice("这个动作现在不可选，先按顺序完成前置动作。");
          return;
        }
        choose(choice.choiceId, "key");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choose, finish, performed, retry, step, ui.exp.done]);

  useEffect(() => {
    if (mode !== "auto" || ui.exp.done || autoBusyRef.current || finishingRef.current) return;
    // target 必须跟着当前步骤走：原来只在切换模式时设一次，
    // 步骤推进后 stepIndex !== target 直接 return，auto 就永远停在第 2 步（红队 2026-10-21 实测）。
    autoTargetRef.current = ui.exp.stepIndex;

    // 先在"明确正确"的动作里找；观察类步骤（如"看水平泡是否居中"）没有 role=correct，
    // 这里会退化到看板推荐动作（＝按 1），否则 auto 会静默卡死在该步，
    // 学生此时交卷 → 报告出现"步骤有遗漏 50 分"（红队 2026-10-21 实测停在 2/7）。
    // 一键演示要稳定拿高分：优先跟看板"按 1"的建议动作（那是系统认定的正确路径），
    // 再看 role=correct，最后才退到"任意非 trap"。原来先找 correct，观察类步骤会退到
    // 非最优动作，同一实验有时 80 有时 86，分数不稳定（用户 2026-10-21 验收线 85）。
    const choice =
      (suggested && !performed.has(suggested.choiceId) ? suggested : undefined) ??
      step.choices.find(
        (item) =>
          item.role === "correct" &&
          !performed.has(item.choiceId) &&
          !(item.requires ?? []).some((id) => !performed.has(id)),
      ) ??
      // 第三层兜底：任意"非 trap、未执行、前置已满足"的动作。
      step.choices.find(
        (item) =>
          item.role !== "trap" &&
          !performed.has(item.choiceId) &&
          !(item.requires ?? []).some((id) => !performed.has(id)),
      );
    if (!choice) return;

    autoBusyRef.current = true;
    const timer = window.setTimeout(() => {
      autoBusyRef.current = false;
      choose(choice.choiceId, "auto");
    }, 320);
    return () => window.clearTimeout(timer);
  }, [autoTick, choose, mode, performed, step, suggested, ui.exp.done, ui.exp.stepIndex]);

  return (
    <div className={`${styles.app} ix-fade-in`} data-input-mode={lastInputMode ?? undefined}>
      <header className={styles.topbar}>
        <Link className={`${styles.back} ix`} href="/experiments">
          <span aria-hidden="true">←</span> 返回
        </Link>
        <div className={styles.topName}>
          <span className={styles.topNo}>实验 {expNo}</span>
          <strong className={styles.topTitle}>{definition.title}</strong>
        </div>
        <div className={styles.topCenter}>
          <span className={styles.topStep}>
            第 {pad2(stepNo)} 步 / 共 {pad2(total)} 步
          </span>
          <span className={styles.topTicks} aria-hidden="true">
            {definition.steps.map((item, index) => (
              <span
                key={item.demoId}
                className={styles.topTick}
                data-state={stepStates[index]}
              />
            ))}
          </span>
          <StreakPill count={ui.streak} demoId="demo-streak" />
        </div>
        <div className={styles.topRight}>
          <span className={styles.student}>学号 {studentNo}</span>
          <div className={styles.modeSwitch} role="group" aria-label="交互方式">
            <span className={styles.modeLabel}>交互方式</span>
            {INPUT_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.modeButton} ix`}
                data-demo-id={`demo-mode-${item.id}`}
                data-current={mode === item.id ? "true" : "false"}
                aria-pressed={mode === item.id}
                onClick={() => switchMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {demoReadonly ? (
            <span className={styles.readonlyBadge} data-demo-id="demo-readonly-badge">
              演示模式 · 不记录
            </span>
          ) : null}
          <SoundToggle />
          {skipVisible ? (
            <button
              type="button"
              className={`${styles.finishTop} ix`}
              data-kind="skip"
              data-demo-id="demo-skip"
              onClick={() => void finish()}
              disabled={finishing}
              title="演示用：不再逐步操作，直接交卷看结果"
            >
              跳过实验
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.finishTop} ix`}
            data-demo-id="demo-finish"
            onClick={() => void finish()}
            disabled={finishing}
          >
            {finishing ? "交卷中…" : "交卷"}
          </button>
          <Link className={`${styles.exit} ix`} href="/">
            退出
          </Link>
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.stage} aria-labelledby="stage-title">
          <h1 className={styles.srOnly} id="stage-title">
            实验 {pad2(Number(expNo) || 0)} 操作台，第 {stepNo} 步 {step.title}
          </h1>
          {/* 左上角任务看板：一句话目标 + 进度点 + 当前一步一句指引；细则全在折叠区 */}
          <div className={styles.missionSlot}>
            <MissionBoard
              expNo={expNo.padStart(2, "0")}
              title={definition.title}
              goal={missionGoal(expId, definition.title, total)}
              progress={missionProgress(stepNo, total, stepVerb(step.title, suggested.type, ACTION_VERB))}
              guide={boardGuide}
              dots={dots}
              steps={definition.steps.map((item) => ({ index: item.index, title: item.title }))}
              seconds={stepSeconds}
              onPeek={(index) =>
                setSceneCaption(`第 ${index + 1} 步：${definition.steps[index]?.title ?? ""}`)
              }
              params={boardParams}
              hint={{
                level: ui.hint?.level ?? 0,
                active: Boolean(ui.hint),
                deduct: Boolean(ui.hint?.shouldDeduct),
                onAsk: () => dispatch({ type: "hint" }),
              }}
              note={{ label: "老师会说", text: teacherNote(expId, step.index) }}
              done={ui.exp.done}
            />
          </div>

          {/* 新手教学：首次进任一实验自动弹 4 步（localStorage 记"看过"），看完即可上手 */}
          <ExperimentOnboarding expId={expId} />
          <SceneStage
            expId={expId}
            onCaption={handleSceneCaption}
            onInput={handleSceneInput}
            autoDrop={
              demoReagent && demoVessel
                ? { reagentId: demoReagent, vesselId: demoVessel }
                : undefined
            }
            feedbackTone={ui.event?.outcome ?? null}
            feedbackSeq={ui.feedbackSeq}
            resolveDrop={resolveCurrentDrop}
            onDropAccepted={handleDropAccepted}
            onDropRejected={handleDropRejected}
            stepDoneKey={stepDoneKey}
            nextReagent={nextReagent}
            // exp09 前两步是"配 500 mL 溶液"，按步骤切到台面（用户 2026-10-21 报：满管蓝液却显示 0.00）
            forceBench={isExp09 && ui.exp.stepIndex < 2}
            // 第 1 步称 NaOH 要天平；第 2 步配盐酸不需要，别让台面凭空摆一台
            benchInstrument={isExp09 ? (ui.exp.stepIndex === 0 ? "balance" : "none") : undefined}
            onQuickAction={() => {
              // 点画面里的天平：和按 1 一样，直接用当前建议动作
              if (suggested && !ui.exp.done) choose(suggested.choiceId);
            }}
          >
            {fx}
          </SceneStage>
        </section>

        <aside className={styles.rail} aria-label="操作面板">
          {/* 大字读数（HUD 灵魂）：exp09 = 滴定管读数；其余实验只在本步有判据时报允许误差
              （没有读数就不摆一张空卡 —— 减法：不给"—"占地方） */}
          {isExp09 || tolerance ? (
          <div className={styles.params} aria-label="实时读数">
            {isExp09 ? (
              <div
                className={`${styles.param} ix`}
                data-tone={hasAbnormality ? "warn" : "normal"}
                role="button"
                tabIndex={0}
                onClick={() => setSceneCaption(`滴定管读数：${readingNote}`)}
              >
                <span className={styles.paramLabel}>滴定管读数</span>
                <span
                  key={`read-${ui.feedbackSeq}`}
                  className={`${styles.paramValue}${numberPop ? " ix-pop" : ""}`}
                  data-pop={numberPop}
                >
                  {reading.toFixed(2)}
                  <em>mL</em>
                </span>
                <span className={styles.paramNote}>{readingNote}</span>
              </div>
            ) : null}
            <div
              className={`${styles.param} ix`}
              style={isExp09 ? undefined : { gridColumn: "1 / -1" }}
              role="button"
              tabIndex={0}
              onClick={() =>
                setSceneCaption(
                  tolerance
                    ? `允许误差：${toleranceName}判据，期望 ${tolerance.expected} ${tolerance.unit}，容差 ±${tolerance.tolerance} ${tolerance.unit}。`
                    : "允许误差：本步不做读数判定。",
                )
              }
            >
              <span className={styles.paramLabel}>允许误差</span>
              <span className={styles.paramValue}>
                {toleranceValue}
                <em>{toleranceUnit}</em>
              </span>
              <span className={styles.paramNote}>
                {tolerance ? `${toleranceName}判据 · 期望 ${tolerance.expected} ${tolerance.unit}` : "本步无读数判据"}
              </span>
            </div>
          </div>
          ) : null}

          <section ref={actionsRef} className={guide.railLead} tabIndex={-1} aria-label="建议动作">
            <NextActionCard
              name={guideName(suggested.label)}
              why={whyLine(step.judge.criterion)}
              keyHint={suggestedKey ? String(suggestedKey) : undefined}
              demoId={suggested.demoId}
              disabled={ui.exp.done}
              phase={guidePhase}
              onChoose={() => choose(suggested.choiceId)}
            />
          </section>

          {ui.event && ui.event.outcome === "failure" ? (
            <details
              className={guide.why}
              data-demo-id="demo-feedback-detail"
              data-severity={ui.event.severity}
            >
              <summary className={guide.whySummary}>
                <span className={guide.whyLevel}>{ui.event.level ?? "违规"}</span>
                看原因 · {ui.event.deduction > 0 ? `−${ui.event.deduction} 分` : "未扣分"}
              </summary>
              <p className={guide.whyTitle}>{ui.event.title}</p>
              {ui.event.why ? <p className={guide.whyText}>{ui.event.why}</p> : null}
              {ui.event.correct ? (
                <p className={guide.whyText}>
                  <span>正确：</span>
                  {ui.event.correct}
                </p>
              ) : null}
              {ui.event.terminate ? (
                <p className={guide.whyWarn}>L4 危险事故：本次实验已终止，操作分记 0 分。</p>
              ) : null}
            </details>
          ) : null}

          {!ui.exp.done ? (
            <details className={guide.other} data-demo-id="demo-other-ways">
              <summary className={guide.otherSummary}>
                其他做法
                <span className={guide.otherCount}>{otherChoices.length} 项</span>
              </summary>
              <div className={guide.otherList}>
                {otherChoices.map((choice) => {
                  const needs = (choice.requires ?? []).some((id) => !performed.has(id));
                  const done = performed.has(choice.choiceId);
                  const isLast = ui.lastChoiceId === choice.choiceId;
                  const feedbackClass =
                    isLast && ui.event
                      ? ui.event.outcome === "success"
                        ? `ix-pulse-ok ${styles.actionOk}`
                        : `ix-shake ix-pulse-fail ${styles.actionFail}`
                      : "";
                  return (
                    <button
                      key={choice.choiceId}
                      type="button"
                      className={`${guide.otherButton} ix ${feedbackClass}`}
                      data-feedback={isLast ? ui.event?.outcome : undefined}
                      data-demo-id={choice.demoId}
                      disabled={ui.exp.done || needs || done}
                      onClick={() => choose(choice.choiceId)}
                    >
                      {choice.label}
                      {needs ? <span className={guide.otherMeta}>需先完成前置动作</span> : null}
                    </button>
                  );
                })}
              </div>
            </details>
          ) : null}

          {ui.exp.done ? (
            <section className={styles.finish} aria-label="本次操作结果">
              <p className={styles.finishKicker}>{terminated ? "实验终止" : "实验完成"}</p>
              <p className={styles.finishScore}>
                <ScoreOdometer
                  value={terminated ? 0 : score.score}
                  suffix=" 操作分"
                  demoId="demo-finish-score"
                  className={styles.finishOdometer}
                />
              </p>
              <p className={styles.finishMeta}>
                违规 −{score.violationDeduct} · 事故 −{score.incidentDeduct} · 提示 −
                {score.independentDeduct}
              </p>
              <div className={styles.finishActions}>
                <button
                  type="button"
                  className={`${styles.resetButton} ix`}
                  data-demo-id="demo-restart"
                  onClick={() => dispatch({ type: "reset" })}
                >
                  {terminated ? "重新演示" : "重做一次"}
                </button>
                <Link className={`${styles.reportLink} ix`} href={`/exp/${expId}/report`}>
                  交卷并查看报告
                </Link>
              </div>
            </section>
          ) : null}

        </aside>
      </div>

      <ResultBar
        key={`${ui.feedbackSeq}-${reject?.seq ?? 0}`}
        tone={eventState}
        line={resultLine}
        line2={resultLine2}
        badge={
          ui.event && (ui.event.level || ui.event.deduction > 0)
            ? `${ui.event.level ? `${ui.event.level} · ` : ""}−${ui.event.deduction} 分`
            : undefined
        }
        // 失败时只留「重做本步」：不再同时滑出"下一步"，同屏只有一条该做的事。
        next={showRetry ? null : nextText}
        demoId={feedbackDemoId}
        retry={
          showRetry
            ? {
                demoId: `demo-retry-${ui.event?.stepNumber ?? stepNo}`,
                onClick: retry,
              }
            : undefined
        }
        hint={ui.event?.terminate ? "实验已终止" : undefined}
      />

      <p className={styles.keyFooter} data-demo-id="demo-key-hint">
        按 1~9 选择动作 · H 提示 · R 重做 · Enter 交卷
      </p>

      <ExperimentDock currentId={expId} onNotice={setNotice} />

      {/* E1 拒收：三行（错在哪 / 为什么 / 怎么改），180ms 淡入 + 目标抖动一次 */}
      <RejectHint
        open={Boolean(reject)}
        lines={reject?.lines ?? REJECT_FALLBACK}
        point={reject?.point}
        onDismiss={() => setReject(null)}
        demoId="demo-reject-hint"
      />

      {/* E3 系统错误：人话一句 + 重试，不把技术错误码抛给学生 */}
      <ErrorToast
        open={Boolean(systemError)}
        message={systemError?.message ?? ""}
        detail={systemError?.detail}
        onDismiss={() => setSystemError(null)}
        demoId="demo-error-toast"
      />
    </div>
  );
}
