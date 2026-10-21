"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getDefinition } from "@/lib/engine";
import type { Action, FxKey as EngineFxKey } from "@/lib/engine.types";
import { FxByKey } from "@/components/exp/scene/fx";
import type { FxKey as SceneFxKey } from "@/lib/scene/fx";
import { ExperimentDock } from "./experiment-dock";
import { SceneStage } from "./scene-stage";
import {
  createWorkbenchState,
  currentStep,
  operationScore,
  workbenchReducer,
} from "./use-workbench";
import styles from "./workbench.module.css";

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

const TEACHER_NOTES: Record<number, string> = {
  0: "称 NaOH 要快：它吸潮，称完立刻盖紧，别在秤盘上久放。",
  1: "只能酸入水，不能水入酸——顺序错了会局部沸腾、酸雾喷溅。",
  2: "碱式滴定管不能装酸；检漏之后再润洗，别省这一步。",
  3: "调零后先记初读数，视线与凹液面最低点相平，估读到 0.01 mL。",
  4: "移液管自然流尽后停 15 s，绝不把残液吹进锥形瓶。",
  5: "终点是浅粉红 30 s 不褪，不是颜色越深越好。",
  6: "先写公式再代数：c(碱)/c(酸) = V(酸)/V(碱)，别取倒。",
};

const TEACHER_NOTES_EXP01: Record<number, string> = {
  0: "洗干净的判据是内壁水膜均匀、不挂水珠；容量瓶和量筒不能擦内壁，也不能烘。",
  1: "先调水平再开机预热；空载回零、示数稳定后才是可信的称量起点。",
  2: "差减法两次读数都要等稳定；热称量瓶先放干燥器冷却，别直接上秤盘。",
  3: "热溶液不能直接进容量瓶；转移后烧杯和玻璃棒要洗 3 次，洗液全部并入。",
  4: "定容接近刻度改用胶头滴管；视线与刻度线水平，凹液面最低点相切，盖塞摇匀。",
  5: "移液管先用待移取液润洗 3 次；自然流下停 15 s，不吹残液。",
  6: "稀释浓硫酸只许酸入水：沿壁、缓慢、边加边搅拌，冷却后再贴标签。",
};

const TEACHER_NOTES_EXP08: Record<number, string> = {
  0: "认领即责任移交：件数、规格、配套三项逐项打勾再签字；缺盖/裂口当场换。",
  1: "天平最怕碰刀口与吊耳；只能碰底座、侧门把手和加码旋钮，构造认知只看不动。",
  2: "先调水平，再预热 ≥30 min，内校后回零，最后用 100 g 砝码回测。",
  3: "上秤前先看铭牌 Max 200 g；整瓶约 500 g，严禁上秤。称量纸折角、药匙取样。",
  4: "瓶与盖分持，垂直放入秤盘中央；开侧门取放，关侧门读数；洒落试样弃回收瓶。",
  5: "原始记录用不溶性墨水笔；错处划单横线保留原值，旁边写正确值并签名。",
  6: "软毛刷由内向外清扫；关机、罩罩、断电，试剂归位、台面擦净。",
};

const TEACHER_NOTES_EXP02: Record<number, string> = {
  0: "加水量按 8 mL/g 粗盐取 40 mL；BaCl₂ 加至不再沉淀后再过量约 1 mL，取上清液复检才算除尽。",
  1: "先 NaOH 调 pH≈11 沉 Mg²⁺，再 Na₂CO₃ 沉 Ca²⁺ 与过量 Ba²⁺；两项都要取上清液复检。",
  2: "滤纸双层朝外、润湿贴紧；玻璃棒引流、三靠，液面低于滤纸边缘；破了重滤。",
  3: "HCl 逐滴加到 pH 4~5，再煮沸 2~3 min 赶尽 CO₂，冷却后复测；不要加到 pH<2。",
  4: "出现晶膜立即停火，利用余热；关火后室温自然冷却，绝不用冷水冲热容器。",
  5: "用 2 mL 饱和 NaCl 冰溶液洗 2 次；105 ℃ 干燥至恒重，两次差 ≤0.0005 g；产率分母是 m(粗盐)×w。",
};

const TEACHER_NOTES_EXP03: Record<number, string> = {
  0: "冰醋酸有腐蚀、易燃两个 GHS 图示：通风橱内、酸入水、沿壁搅拌；系列浓度必须用移液管+容量瓶。",
  1: "移液管用待移液润洗 3 次；容量瓶只定容不盛放；凹液面与刻度相切，标签写 c 与配制人。",
  2: "Kₐ 随温度变：25 ℃ 水浴恒温 10 min，4 份同温，温度计读数记入表格。",
  3: "两点校准求零点与斜率：每点前冲洗吸干；斜率 95%~105%，回测 4.00 偏差 ≤0.05。",
  4: "由稀到浓、每份冲洗吸干；球泡悬于液面下约 1 cm，30 s 内变化 ≤0.01 再读。",
  5: "[H⁺]=10⁻ᵖᴴ，α=[H⁺]/c，Kₐ=cα²/(1−α)；电极冲净吸干浸 3 mol/L KCl，废液入桶断电。",
};

const TEACHER_NOTES_EXP04: Record<number, string> = {
  0: "离心管逐支对光看管壁与管底；有裂纹一律弃用，不能“先用着看”。",
  1: "AgCl 按计算量 1.2 倍加 NaCl，加后取上清液回检；KI 瓶别拿错。",
  2: "对称孔等量配平（液面差 ≤0.1 mL）；盖盖启动，完全停转后再开盖；蒸馏水洗 2~3 次。",
  3: "6 mol/L 氨水逐滴加至 AgCl 刚溶；通风橱内操作，不俯身闻；KI 转化白→黄。",
  4: "分步沉淀逐滴加、先黄后白；Mg(OH)₂ 用 NH₄Cl 溶；含银废液全部入重金属桶。",
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
  const [mode, setMode] = useState<InputMode>("drag");
  const [lastInputMode, setLastInputMode] = useState<InputMode | null>(null);
  const [autoTick, setAutoTick] = useState(0);
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
        .catch(() => undefined);
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
        .catch(() => undefined);
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
    ui.exp.stepIndex < 3 ? "滴定管尚未装液" : reading === 0 ? "已调零，待滴定" : "凹液面读数";
  const hasAbnormality = ui.exp.incidents.length + ui.exp.violations.length > 0;

  const eventState = notice
    ? "warn"
    : sceneCaption
      ? "info"
      : ui.event
        ? ui.event.outcome === "success"
          ? "success"
          : ui.event.severity
        : "info";
  const eventLine1 =
    notice ??
    sceneCaption ??
    (ui.event
      ? ui.event.outcome === "success"
        ? "操作正确"
        : ui.event.shortTitle
      : `第 ${pad2(stepNo)} 步 · ${step.title}`);
  const eventLine2 = ui.event
    ? ui.event.outcome === "success"
      ? `为什么对：${ui.event.why ?? step.judge.criterion}`
      : `为什么：${ui.event.why ?? "看右侧事故卡与规范条目。"}`
    : notice
      ? "点已开放实验切换"
      : sceneCaption
        ? "拖拽/点选试剂"
        : "从右侧可选动作开始，或把试剂拖到锥形瓶。";
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
    },
    [mode, sendAction],
  );

  const retry = useCallback(() => {
    setSceneCaption(null);
    setNotice(null);
    dispatch({ type: "retry" });
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
      router.push(
        runId && finishedOk
          ? `/exp/${expId}/report?runId=${runId}`
          : `/exp/${expId}/report`,
      );
    }
  }, [demoReadonly, expId, router]);

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
    const target = autoTargetRef.current ?? ui.exp.stepIndex;
    autoTargetRef.current = target;
    if (ui.exp.stepIndex !== target) return;

    const choice = step.choices.find(
      (item) =>
        item.role === "correct" &&
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
  }, [autoTick, choose, mode, performed, step, ui.exp.done, ui.exp.stepIndex]);

  return (
    <div className={styles.app} data-input-mode={lastInputMode ?? undefined}>
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
          >
            {fx}
          </SceneStage>
          {!isExp09 ? (
            <p className={styles.sceneTodo} data-demo-id="exp01-scene-todo">
              {expId === "exp02"
                ? "场景复用现有分析天平 / 烧杯 / 容量瓶 / Na₂CO₃·水（蒸发皿待替换 · TODO）"
                : expId === "exp03"
                  ? "场景复用现有烧杯 / 容量瓶 / 分析天平 / 蒸馏水（pH 计电极待替换 · TODO）"
                  : expId === "exp04"
                    ? "场景复用现有烧杯 / 试管 / 容量瓶 / Na₂CO₃·水（离心机待替换 · TODO）"
                    : expId === "exp08"
                    ? "场景复用现有分析天平 / 烧杯 / Na₂CO₃ 试剂（称量瓶用烧杯替代 · TODO）"
                    : "场景复用 exp09 器皿（称量 / 容量瓶 / 通风橱待替换 · TODO）"}
            </p>
          ) : null}
          <span className={styles.coordTl} aria-hidden="true">
            00 / 00
          </span>
          <span className={styles.coordTr} aria-hidden="true">
            720 / 00
          </span>
          <span className={styles.coordBl} aria-hidden="true">
            00 / 420
          </span>
          <span className={styles.coordBr} aria-hidden="true">
            720 / 420
          </span>
        </section>

        <aside className={styles.rail} aria-label="操作面板">
          <div className={`${styles.railHead} ix-enter`} key={`head-${step.index}`}>
            <span className={styles.railKicker}>当前步骤</span>
            <h2 className={styles.railTitle}>{step.title}</h2>
            <p className={styles.railJudge}>
              <span>本步判据</span>
              {step.judge.criterion}
            </p>
          </div>

          <ol className={styles.ledger} aria-label="步骤台账">
            {definition.steps.map((item, index) => (
              <li
                key={item.demoId}
                className="ix ix-step"
                data-state={stepStates[index]}
                data-current={index === ui.exp.stepIndex ? "true" : "false"}
                title={item.title}
                role="button"
                tabIndex={0}
                aria-label={`第 ${index + 1} 步 ${item.title}`}
                onClick={() => setSceneCaption(`第 ${index + 1} 步：${item.title}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSceneCaption(`第 ${index + 1} 步：${item.title}`);
                  }
                }}
              >
                <span className={styles.ledgerNo}>{pad2(index + 1)}</span>
                <span className={styles.ledgerName}>{item.title}</span>
                <span className={styles.ledgerDot} aria-hidden="true" />
              </li>
            ))}
          </ol>

          {isExp09 ? (
          <div className={styles.params} aria-label="实时参数">
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
            <div
              className={`${styles.param} ix`}
              role="button"
              tabIndex={0}
              onClick={() => setSceneCaption("已用体积 V：从初读数 0.00 mL 起算。")}
            >
              <span className={styles.paramLabel}>已用体积 V</span>
              <span
                key={`used-${ui.feedbackSeq}`}
                className={`${styles.paramValue}${numberPop ? " ix-pop" : ""}`}
                data-pop={numberPop}
              >
                {reading.toFixed(2)}
                <em>mL</em>
              </span>
              <span className={styles.paramNote}>初读数 0.00 起算</span>
            </div>
            <div
              className={`${styles.param} ix`}
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
            <div
              className={`${styles.param} ix`}
              role="button"
              tabIndex={0}
              onClick={() =>
                setSceneCaption(
                  indicatorAdded
                    ? `指示剂颜色：酚酞已加入，当前${indicator}；终点为浅粉红 30 s 不褪。`
                    : "指示剂颜色：本步尚未加入酚酞。",
                )
              }
            >
              <span className={styles.paramLabel}>指示剂颜色</span>
              <span className={styles.paramValue}>
                {indicatorAdded ? (
                  <span
                    className={styles.swatch}
                    style={{ background: endpointReached ? "#f6d7de" : "#dce9f2" }}
                    aria-hidden="true"
                  />
                ) : null}
                {indicator}
              </span>
              <span className={styles.paramNote}>酚酞 2 滴 / 第 05 步加入</span>
            </div>
          </div>
          ) : (
            <div className={styles.params} aria-label="实时参数">
              <div
                className={`${styles.param} ix`}
                role="button"
                tabIndex={0}
                onClick={() => setSceneCaption(`本步观察记录：${ui.exp.observations.length} 条。`)}
              >
                <span className={styles.paramLabel}>观察记录</span>
                <span className={styles.paramValue}>
                  {ui.exp.observations.length}
                  <em>条</em>
                </span>
                <span className={styles.paramNote}>按 doc 记录</span>
              </div>
              <div
                className={`${styles.param} ix`}
                data-tone={hasAbnormality ? "warn" : "normal"}
                role="button"
                tabIndex={0}
                onClick={() => setSceneCaption("违规与事故会进入报告时间线和事故复盘。")}
              >
                <span className={styles.paramLabel}>违规 / 事故</span>
                <span className={styles.paramValue}>
                  {ui.exp.violations.length + ui.exp.incidents.length}
                  <em>条</em>
                </span>
                <span className={styles.paramNote}>已记录</span>
              </div>
              <div
                className={`${styles.param} ix`}
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
                  {tolerance ? `${toleranceName}判据` : "本步无读数判据"}
                </span>
              </div>
              <div
                className={`${styles.param} ix`}
                role="button"
                tabIndex={0}
                onClick={() => setSceneCaption(`实验进度：第 ${stepNo} 步 / 共 ${total} 步。`)}
              >
                <span className={styles.paramLabel}>实验进度</span>
                <span className={styles.paramValue}>
                  {stepNo}
                  <em>/ {total}</em>
                </span>
                <span className={styles.paramNote}>{step.title}</span>
              </div>
            </div>
          )}

          <div className={styles.hintBox}>
            <div className={styles.hintHead}>
              <span className={styles.hintTitle}>要提示吗？</span>
              <span className={styles.hintLevel}>
                {ui.hint ? `H${ui.hint.level}` : "H0–H3"}
              </span>
              <span className={styles.hintMeter} aria-hidden="true">
                {[0, 1, 2, 3].map((level) => (
                  <span
                    key={level}
                    className={styles.hintTick}
                    data-active={ui.hint ? ui.hint.level >= level : false}
                    data-warn={level >= 2}
                  />
                ))}
              </span>
              <button
                type="button"
                className={`${styles.hintButton} ix`}
                onClick={() => dispatch({ type: "hint" })}
              >
                取一条提示
              </button>
            </div>
            {ui.hint ? (
              <p className={styles.hintText}>{ui.hint.text}</p>
            ) : (
              <p className={styles.hintLead}>连续出错会升级提示；H2 起扣独立完成分。</p>
            )}
            {ui.hint?.shouldDeduct ? (
              <p className={styles.hintWarn}>使用提示将扣独立完成分</p>
            ) : null}
          </div>

          {ui.event ? (
            <aside
              className={styles.feedback}
              data-severity={ui.event.severity}
              role="status"
              aria-live="polite"
            >
              <div className={styles.feedbackHead}>
                <span className={styles.feedbackLevel}>
                  {ui.event.incident
                    ? (ui.event.level ?? "事故")
                    : ui.event.severity === "info"
                      ? "记录"
                      : "违规"}
                </span>
                <strong className={styles.feedbackTitle}>{ui.event.title}</strong>
                {ui.event.deduction > 0 ? (
                  <span className={styles.deduct}>−{ui.event.deduction} 分</span>
                ) : null}
              </div>
              {ui.event.why ? (
                <p className={styles.feedbackText}>
                  <span>为什么：</span>
                  {ui.event.why}
                </p>
              ) : null}
              {ui.event.correct ? (
                <p className={styles.feedbackText}>
                  <span>正确做法：</span>
                  {ui.event.correct}
                </p>
              ) : null}
              {ui.event.terminate ? (
                <p className={styles.terminate}>L4 危险事故：本次实验已终止，操作分记 0 分。</p>
              ) : null}
            </aside>
          ) : null}

          {!ui.exp.done ? (
            <section
              ref={actionsRef}
              className={styles.actions}
              aria-labelledby="actions-title"
              tabIndex={-1}
            >
            <div className={styles.actionsHead}>
              <h3 id="actions-title">可选动作</h3>
              <span>每步只记一次</span>
            </div>
            <div className={styles.actionList}>
              {step.choices.map((choice) => {
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
                    className={`${styles.action} ix ${feedbackClass}`}
                    data-feedback={isLast ? ui.event?.outcome : undefined}
                    data-demo-id={choice.demoId}
                    disabled={ui.exp.done || needs || done}
                    onClick={() => choose(choice.choiceId)}
                  >
                    <span className={styles.actionText}>{choice.label}</span>
                    {needs ? <span className={styles.actionMeta}>需先完成前置动作</span> : null}
                  </button>
                );
              })}
            </div>
            </section>
          ) : null}

          {ui.exp.done ? (
            <section className={styles.finish} aria-label="本次操作结果">
              <p className={styles.finishKicker}>{terminated ? "实验终止" : "实验完成"}</p>
              <p className={styles.finishScore}>
                {terminated ? "0" : score.score}
                <span> 操作分</span>
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

          <p className={styles.note}>
            <span>老师会说：</span>
            {(isExp09
              ? TEACHER_NOTES
              : expId === "exp08"
                ? TEACHER_NOTES_EXP08
                : expId === "exp02"
                  ? TEACHER_NOTES_EXP02
                  : expId === "exp03"
                    ? TEACHER_NOTES_EXP03
                    : expId === "exp04"
                      ? TEACHER_NOTES_EXP04
                      : TEACHER_NOTES_EXP01)[step.index] ?? "按判据做，别抢在读数前记录。"}
          </p>
        </aside>
      </div>

      <div
        className={styles.eventBar}
        data-state={eventState}
        data-demo-id={feedbackDemoId}
        role="status"
        aria-live="polite"
      >
        <span className={styles.eventMark} aria-hidden="true" />
        <span className={styles.eventIcon} aria-hidden="true">
          {eventState === "success" ? "✓" : eventState === "danger" || eventState === "warn" ? "!" : "i"}
        </span>
        <p className={styles.eventText} data-demo-id="demo-scene-event">
          <span className={styles.eventLine1}>{eventLine1}</span>
          <span className={styles.eventLine2}>{eventLine2}</span>
        </p>
        {ui.event && (ui.event.level || ui.event.deduction > 0) ? (
          <span className={styles.eventBadge}>
            {ui.event.level ? `${ui.event.level} · ` : ""}−{ui.event.deduction} 分
          </span>
        ) : null}
        {showRetry ? (
          <button
            type="button"
            className={`${styles.retryButton} ix ix-shake`}
            data-demo-id={`demo-retry-${ui.event?.stepNumber ?? stepNo}`}
            onClick={retry}
          >
            重做本步
          </button>
        ) : (
          <span className={styles.eventHint}>
            {ui.event?.terminate ? "实验已终止" : "每步只记一次"}
          </span>
        )}
      </div>

      <p className={styles.keyFooter} data-demo-id="demo-key-hint">
        按 1~9 选择动作 · H 提示 · R 重做 · Enter 交卷
      </p>

      <ExperimentDock currentId={expId} onNotice={setNotice} />
    </div>
  );
}
