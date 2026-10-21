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
import { canPourAction, nextReagentId, resolveDrop, type DropReject } from "@/components/exp/guide/drop-resolve";
import {
  HINT_DEDUCT,
  MAX_HINTS_PER_STEP,
  HINT_TIER_LABEL,
  hintTierFor,
} from "@/components/exp/guide/hint-ladder";
// 新手教学（Lead 交付）：不传 open = 没看过就自动弹，看过不再打扰。
import { ExperimentOnboarding } from "@/components/exp/onboarding";
import { GhostCursor, GHOST_HIDDEN, type GhostState } from "@/components/demo/ghost-cursor";
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
  hintUsedInStep,
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

/** 主工具栏只保留三种正常交互（红队 2026-10-22：「自动」属于 Dev Dock，不该和它们并排）。 */
/** 第 7 步（数据处理）建议卡上的"一句为什么"：
 *  原来直接把判据首句（"三次平行相对极差 �?.2%"）塞�?why 位置�?
 *  读起来像验收标准而不是理由（红队 2026-10-22 报"文案跟实际操作对不上"）。 */
const COMPUTE_WHY: Partial<Record<string, string>> = {
  titrate: "单次有偶然误差，平行 3 次才看得出",
  readInstrument: "如实记三次读数，才敢算极差",
  compute: "c 与 V 成反比，别拿体积比当浓度比",
};

const INPUT_MODES = [
  { id: "drag", label: "拖拽" },
  { id: "click", label: "点选" },
  { id: "key", label: "键盘" },
] as const;

/** auto 不进主栏，但仍要能作为模式值存在（Dev Dock 一键演示 / ?autodemo=1）。 */
type InputMode = (typeof INPUT_MODES)[number]["id"] | "event" | "auto";

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
  /** 一键演示（?autodemo=1）：跳过新手教学，直接开跑（演示时不该弹教学卡片）。 */
  const [autoDemo, setAutoDemo] = useState(false);
  const [lastInputMode, setLastInputMode] = useState<InputMode | null>(null);
  const [autoTick, setAutoTick] = useState(0);
  /** 一键演示的虚拟光标（真人化点击）�?*/
  const [ghost, setGhost] = useState<GhostState>(GHOST_HIDDEN);
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
  /** E2 事故条的"已读"标记：按 feedbackSeq 记住，下一次事故重新弹出�?*/
  const [bannerDismissed, setBannerDismissed] = useState(-1);
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
  /** E3 的「重试」：最后一次失败请求的重放函数（只在点击回调里取用）�?*/
  const retryRef = useRef<(() => void) | null>(null);

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
          // 「重试」＝把同一批动作原样再发一次（只在点击回调里读 ref，不在渲染期读）�?
          retryRef.current = () => {
            void fetch(`/api/runs/${runId}/events`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ events: [payload] }),
            }).catch(() => undefined);
          };
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
      // 演示只读模式既不落库也不需要会话：提前返回，避免匿名 fetch /api/session 在控制台打 401
      if (demoReadonly) return null;

      const sessionRes = await fetch("/api/session");
      const session = await sessionRes.json().catch(() => null);
      if (session?.ok && session.student?.studentNo) {
        setStudentNo(String(session.student.studentNo));
      }

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
    // Dev Dock 的一键演示：?autodemo=1 直接进 auto 模式，跑完自动交卷并落报告页。
    const params = new URLSearchParams(window.location.search);
    if (params.get("autodemo") === "1") {
      const timer = window.setTimeout(() => {
        setAutoDemo(true);
        setMode("auto");
        setAutoTick((tick) => tick + 1);
        modeReadyRef.current = true;
      }, 0);
      return () => window.clearTimeout(timer);
    }
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

  // 两段式反馈：先出结果�?~600ms），再把「下一步」滑出来；phase 由点击事件驱�?
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
        // 失败时只留「重做本步」：不再同时滑出"下一步"，同屏只有一条该做的事。
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
  /** exp09 第 7 步：数据处理，读数已定稿，右栏改报相对极差 / 浓度比。 */
  const isComputeStep = isExp09 && ui.exp.stepIndex === 6;
  const observedTexts = ui.exp.observations.map((item) => item.text).join(" ");
  const observedRange = /相对极差\s*([\d.]+)%/.exec(observedTexts)?.[1] ?? null;
  const observedRatio = /浓度比[^=]*=\s*([\d.]+)/.exec(observedTexts)?.[1] ?? null;

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
          unit: "次",
          note: "按 doc 记录",
        },
        {
          label: "违规 / 事故",
          value: String(ui.exp.violations.length + ui.exp.incidents.length),
          unit: "次",
          note: "已记录",
          tone: hasAbnormality ? "warn" : "normal",
        },
      ];
  /** 第四行：本步指引；取过提示就换成那条提示（同屏只留一条）�?*/
  const boardGuide = missionGuide(ui.hint?.text, step.title);

  /**
   * 提示三级阶梯（用�?2026-10-22 口径）：
   * L1 方向 �?L2 具体 �?L3 高亮目标；每步最�?3 次，�?4 次灯泡置灰�?
   * 次数�?hintUsages 计（重做本步会清零），扣�?1/3/5（hint-ladder 唯一口径）�?
   */
  const hintUsed = hintUsedInStep(ui, ui.exp.stepIndex);
  const hintExhausted = hintUsed >= MAX_HINTS_PER_STEP;
  const hintLevel = ui.hint?.level ?? 0;
  const hintNextTier = hintTierFor(hintUsed);
  const hintDeductPoints = hintNextTier ? HINT_DEDUCT[hintNextTier] : 0;
  /** L3 高亮：能倒试�?�?高亮锥形瓶；否则高亮右侧主按钮。只亮一个目标�?*/
  const hintOnFlask = hintLevel === 3 && canPourAction(suggested.type);
  const hintOnAction = hintLevel === 3 && !hintOnFlask;

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

  /** E2：违规/事故都出事故条；级别由 level 决定视觉（L1 提醒 / L2 扣分 / L3 严重 / L4 终止） */
  const incidentEvent = ui.event?.level ? ui.event : null;

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

  /**
   * 取一条提示（唯一入口：灯�?/ 键盘 H / 24s 空闲自动）�?
   * 三级阶梯与扣分由 use-workbench �?revealHint 决定；用完时不再派发�?
   *
   * TODO(结算�?· Lead)：提示使用上报。服务端 replay 目前只从「动作引发的 hint 事件」统计，
   * 拿不�?学生主动点了几次灯泡"。建议加一条入口后在这里调用：
   *   void fetch(`/api/runs/${runId}/events`, { method: "POST", headers: { "content-type": "application/json" },
   *     body: JSON.stringify({ hint: { stepIndex: ui.exp.stepIndex, level: hintNextTier, deduct: hintDeductPoints,
   *       competency: step.judge.competency[0] ?? "S1" } }) });
   * 服务�?appendRunEvents 兼容 body.hint �?落一�?hint 记录（不�?state / 不推�?stepIndex），
   * replay.collectHints 收进 hints，score.ts �?hint-ladder �?1/3/5 求和�?
   */
  const askHint = useCallback(() => {
    if (ui.exp.done || hintExhausted) return;
    // 学生主动取提示要落库（报告要记"提示 k 次 · −X 分"）：
    // UI 档次 1/2/3 → 引擎 HintLevel 0/1/2；演示只读模式不落库。
    const tier = hintTierFor(hintUsedInStep(ui, ui.exp.stepIndex));
    dispatch({ type: "hint" });
    const activeRunId = runIdRef.current;
    if (!tier || !activeRunId || demoReadonly) return;
    void fetch(`/api/runs/${activeRunId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "hint",
        hint: { stepIndex: ui.exp.stepIndex, level: tier - 1 },
      }),
    }).catch(() => {
      /* 提示上报失败不该打断操作，静默忽略 */
    });
  }, [demoReadonly, hintExhausted, ui]);
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
        // 一键演示交卷带 auto=1：服务端用它给预�?100 分并�?10/40/50 重算总分�?
        // 否则报告页比演示脚本�?10 分（Lead 2026-10-22 收尾口径）�?
        const finishUrl = `/api/runs/${runId}/finish${mode === "auto" ? "?auto=1" : ""}`;
        const res = await fetch(finishUrl, { method: "POST" }).catch(() => null);
        finishedOk = Boolean(res?.ok);
      }
    } finally {
      finishingRef.current = false;
      setFinishing(false);
        // 失败时只留「重做本步」：不再同时滑出"下一步"，同屏只有一条该做的事。
      // 会在没人操作时自己往下跑（用�?2026-10-21 要求）�?
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
  // 不再停在"交卷并查看报�?让评委多点一下（用户 2026-10-21 要求）�?
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
        if (!ui.exp.done) askHint();
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
    // 20~30s 没有操作就自动浮出一次提示（用户 2026-10-22 要求"提示三级阶梯"的自动入口）�?
    // 最后一步常挂着"观察/读数"这类可选动作，auto 不会去点它们（没有推进效果）。
    if (ui.exp.done || mode === "auto") return;
    const timer = window.setTimeout(() => {
      if (!ui.exp.done) askHint();
    }, 24000);
    return () => window.clearTimeout(timer);
  }, [ui.feedbackSeq, ui.exp.stepIndex, ui.exp.done, mode]);

  useEffect(() => {
    if (mode !== "auto" || ui.exp.done || autoBusyRef.current || finishingRef.current) return;
    // target 必须跟着当前步骤走：原来只在切换模式时设一次，
    // 步骤推进后 stepIndex !== target 直接 return，auto 就永远停在第 2 步（红队 2026-10-21 实测）。
    autoTargetRef.current = ui.exp.stepIndex;

    // 先在"明确正确"的动作里找；观察类步骤（如"看水平泡是否居中"）没有 role=correct，
    // 这里会退化到看板推荐动作（＝按 1），否则 auto 会静默卡死在该步，
    // 学生此时交卷 → 报告出现"步骤有遗漏 50 分"（红队 2026-10-21 实测停在 2/7）。
    // 一键演示要稳定拿高分：优先跟看�?�?1"的建议动作（那是系统认定的正确路径）�?
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
    const timers: number[] = [];
        // 失败时只留「重做本步」：不再同时滑出"下一步"，同屏只有一条该做的事。
    // 节奏�?stepIndex / 选项数做确定性微差（不再 Math.random：React Compiler �?purity 规则
    // 会把渲染路径可达的随机调用判�?error）�?
    const btn = document.querySelector<HTMLElement>(`[data-demo-id="${choice.demoId}"]`);
    const rect = btn?.getBoundingClientRect();
    const tx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const ty = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const moveMs = 420 + (ui.exp.stepIndex % 4) * 90;
    const hoverMs = 220 + (step.choices.length % 3) * 60;
    // 每步之间�?0.8~1.1s，让评委看清上一步的结果再走下一�?
    const pauseMs = 820 + ((ui.exp.stepIndex + step.choices.length) % 3) * 120;

    timers.push(
      window.setTimeout(() => {
        setGhost((g) => ({ ...g, visible: true, x: tx, y: ty, moveMs, pressed: false }));
      }, pauseMs),
    );
    timers.push(
      window.setTimeout(() => {
        setGhost((g) => ({ ...g, pressed: true, rippleKey: g.rippleKey + 1 }));
      }, pauseMs + moveMs + hoverMs),
    );
    timers.push(
      window.setTimeout(() => {
        setGhost((g) => ({ ...g, pressed: false }));
        // 真实 UI 事件：在目标元素上派发 pointerdown / pointerup 再 click，
        // 和真人点一下走同一条 React 合成事件链（不是直接调业务回调）。
        if (btn && btn.isConnected) {
          const shared = {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: tx,
            clientY: ty,
            pointerId: 1,
            pointerType: "mouse",
            button: 0,
            buttons: 0,
          };
          btn.dispatchEvent(new PointerEvent("pointerdown", { ...shared, buttons: 1 }));
          btn.dispatchEvent(new PointerEvent("pointerup", shared));
          btn.click();
          autoBusyRef.current = false;
        } else {
          autoBusyRef.current = false;
          choose(choice.choiceId, "auto");
        }
      }, pauseMs + moveMs + hoverMs + 200),
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
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
                level: hintLevel,
                active: Boolean(ui.hint),
                deduct: Boolean(ui.hint?.shouldDeduct),
                used: hintUsed,
                max: MAX_HINTS_PER_STEP,
                exhausted: hintExhausted,
                nextDeduct: hintDeductPoints,
                onAsk: askHint,
              }}
              note={{ label: "老师会说", text: teacherNote(expId, step.index) }}
              done={ui.exp.done}
            />
          </div>

          {/* 新手教学：首次进任一实验自动弹 4 步（localStorage 记"看过"），看完即可上手 */}
          {autoDemo ? null : <ExperimentOnboarding expId={expId} />}
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
            hintHighlight={hintOnFlask}
            // exp09 前两步是"配 500 mL 溶液"，按步骤切到台面（用户 2026-10-21 报：满管蓝液却显示 0.00）
            forceBench={isExp09 && ui.exp.stepIndex < 2}
            // 第 1 步称 NaOH 要天平；第 2 步配盐酸不需要，别让台面凭空摆一台
            benchInstrument={isExp09 ? (ui.exp.stepIndex === 0 ? "balance" : "none") : undefined}
            // 第 7 步是数据处理：场景换成数据台（读数表 / 极差 / 浓度比），不再挂着滴定管
            computeMode={isExp09 && ui.exp.stepIndex === 6}
            observations={ui.exp.observations.map((item) => item.text)}
            onQuickAction={() => {
              // 点画面里的天平：和按 1 一样，直接用当前建议动�?
              if (suggested && !ui.exp.done) choose(suggested.choiceId);
            }}
          >
            {fx}
          </SceneStage>
          {/* E2 事故（L3/L4）：事故�?+ 三行处置，贴在舞台上沿，不遮实验台中�?*/}
          {incidentEvent ? (
            <IncidentBanner
              open={bannerDismissed !== ui.feedbackSeq}
              level={incidentEvent.level}
              deduction={incidentEvent.deduction}
              title={incidentEvent.title}
              lines={[
                incidentEvent.shortTitle,
                incidentEvent.why ?? "这一步有后果，先停下来按处置做",
                incidentEvent.correct ?? "按「重做本步」回到这一步开头",
              ]}
              placement="bottom"
              onDismiss={() => setBannerDismissed(ui.feedbackSeq)}
              onRetry={incidentEvent.terminate ? retry : undefined}
              demoId="demo-incident-banner"
            />
          ) : null}
        </section>

        <aside className={styles.rail} aria-label="操作面板">
          {/* 大字读数（HUD 灵魂）：exp09 = 滴定管读数；其余实验只在本步有判据时报允许误差
              （没有读数就不摆一张空卡 —— 减法：不给"—"占地方） */}
          {isComputeStep ? (
            // 第 7 步是数据处理：读数已经定稿在数据台上，这里改报"算到了哪一步"
            <div className={styles.params} aria-label="实时读数">
              <div className={styles.param} role="button" tabIndex={0}>
                <span className={styles.paramLabel}>相对极差</span>
                <span className={styles.paramValue}>
                  {observedRange ?? "—"}
                  <em>%</em>
                </span>
                <span className={styles.paramNote}>判据 ≤ 0.2%（三次平行）</span>
              </div>
              <div className={styles.param} role="button" tabIndex={0}>
                <span className={styles.paramLabel}>浓度比</span>
                <span className={styles.paramValue}>
                  {observedRatio ?? "—"}
                  <em>c₁/c₂</em>
                </span>
                <span className={styles.paramNote}>参考值 1.000 · 偏差 ≤ 0.5%</span>
              </div>
            </div>
          ) : isExp09 || tolerance ? (
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
              why={
                (isComputeStep ? COMPUTE_WHY[suggested.type] : undefined) ??
                whyLine(step.judge.criterion)
              }
              keyHint={suggestedKey ? String(suggestedKey) : undefined}
              demoId={suggested.demoId}
              disabled={ui.exp.done}
              phase={guidePhase}
              highlight={hintOnAction}
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
                看原因 · {ui.event.deduction > 0 ? `扣 ${ui.event.deduction} 分` : "未扣分"}
              </summary>
              <p className={guide.whyTitle}>{ui.event.title}</p>
              {ui.event.why ? <p className={guide.whyText}>{ui.event.why}</p> : null}
              {ui.event.correct ? (
                <p className={guide.whyText}>
                  <span>正确做法</span>
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
        <button
          type="button"
          className={styles.hintButton}
          onClick={askHint}
          disabled={ui.exp.done || hintExhausted}
          data-demo-id="demo-hint-button"
          data-level={ui.hint?.level ?? 0}
          data-exhausted={hintExhausted ? "true" : "false"}
          title={
            hintExhausted
              ? "本步提示已用完（每步最多 3 次）"
              : hintNextTier
                ? `${HINT_TIER_LABEL[hintNextTier]} · 本次扣 ${hintDeductPoints} 分`
                : "要一个提示"
          }
          aria-label={
            hintExhausted
              ? "本步提示已用完"
              : `要一个提示，${hintNextTier ? HINT_TIER_LABEL[hintNextTier] : ""}，扣 ${hintDeductPoints} 分`
          }
        >
          <span aria-hidden="true">💡</span>
          {hintExhausted ? "已用完" : "提示"}
          {ui.hint ? <em>H{ui.hint.level}</em> : null}
          {!hintExhausted && hintNextTier ? <em>{`${hintUsed}/${MAX_HINTS_PER_STEP}`}</em> : null}
        </button>
        按 1~9 选择动作 · H 提示 · R 重做 · Enter 交卷
      </p>

      <ExperimentDock currentId={expId} onNotice={setNotice} />

      {/* E1 拒收：三行（错在�?/ 为什�?/ 怎么改）�?80ms 淡入 + 目标抖动一�?*/}
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
        action={
          systemError?.canRetry
            ? {
                label: "重试",
                demoId: "demo-error-retry",
                onClick: () => {
                  const replay = retryRef.current;
                  setSystemError(null);
                  replay?.();
                },
              }
            : undefined
        }
        onDismiss={() => setSystemError(null)}
        demoId="demo-error-toast"
      />

      {/* 一键演示的虚拟光标：只在 auto 模式出现，pointer-events 永远 none */}
      {mode === "auto" ? <GhostCursor state={ghost} /> : null}
    </div>
  );
}
