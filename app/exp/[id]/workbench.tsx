"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getDefinition } from "@/lib/engine";
import { TOOLS_BY_EXPERIMENT, getSceneTool, type SceneToolId } from "@/lib/scene/tools";
import { getSceneVessel, SCENE_VESSELS } from "@/lib/scene/palette";
import { getSceneReagent } from "@/lib/scene/reagents";
import type { Action, FxKey as EngineFxKey, IncidentLevel } from "@/lib/engine.types";
import { FxByKey } from "@/components/exp/scene/fx";
import { ScoreOdometer, StreakPill } from "@/components/exp/feedback";
import { TrapPanel } from "@/components/exp/guide/trap-panel";
import { ResultBar } from "@/components/exp/guide/ResultBar";
import { DemoCoach } from "@/components/exp/guide/demo-coach";
import { buildCoachPlan, type CoachPlan } from "@/components/exp/guide/coach-plan";
import {
  clip,
  guideName,
  nextLine,
  resultText,
} from "@/components/exp/guide/copy";
import { canPourAction, nextReagentId, resolveDrop, type DropReject } from "@/components/exp/guide/drop-resolve";

/**
 * 这一步的建议动作是不是「把试剂加进去」（拖一瓶试剂过来就能完成的那种）。
 * 称量/调平/读数这类步骤不在这里 —— 否则倒一瓶 Na₂CO₃ 过去就把天平校准做完了。
 * 拖拽要播倒液动画（scene-stage 的 reagentDrop）与 onUseReagent 的判定共用这一份。
 */
const REAGENT_TYPES: ReadonlySet<string> = new Set(["dilute", "dissolve", "addDrops", "titrate", "heat", "evaporate", "transfer"]);
import type { SceneAction, SceneActionApi } from "@/components/exp/scene/actions/action-layer";
import { planIncident, type IncidentPlan } from "@/components/exp/scene/actions/incident-plan";
import { actionForChoice } from "@/components/exp/scene/actions/for-choice";
import {
  HINT_DEDUCT,
  MAX_HINTS_PER_STEP,
  HINT_TIER_LABEL,
  hintTierFor,
} from "@/components/exp/guide/hint-ladder";
// 新手教学（Lead 交付）：不传 open = 没看过就自动弹，看过不再打扰。
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
import { exp01StepHow } from "@/experiments/exp01/step-how";
import { rackIdsFor } from "./rack-ids";
import { SceneStage } from "./scene-stage";
import { teacherNote } from "./teacher-notes";
import { expectedVesselId } from "./vessel-targets";
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
  "对着亮起的那台器皿再拖一次",
] as const;

/**
 * 落库失败必须能被看见。
 *
 * 教训（2026-10-22 扣子 dev 环境）：sendAction 里只 `await fetch(...)`，
 * 而 HTTP 500 是**正常 resolve** 的 —— catch 不触发、界面照常推进，
 * 于是动作被静默丢掉，交卷时时间线是空的，报告显示 0 分。
 * 这里把非 2xx 变成带 status 的错误，交给 errorMessage() 映射成人话。
 */
class PersistFailure extends Error {
  status: number;

  constructor(status: number, what: string) {
    super(`${what}（HTTP ${status}）`);
    this.name = "PersistFailure";
    this.status = status;
  }
}

async function requireOk(response: Response, what: string): Promise<void> {
  if (response.ok) return;
  throw new PersistFailure(response.status, what);
}

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

/** 只在覆盖层上成立的事故：仪器损坏（天平/仪器本体）与重金属废液（流进洗涤槽）。 */
const OVERLAY_FX: ReadonlySet<SceneFxKey> = new Set<SceneFxKey>(["deviceAccident", "heavyMetal"]);

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

/**
 * 「这个动作怎么执行」—— 建议卡第二行优先给操作方式，而不是重复判据
 * （用户 2026-10-22：只说要读数/观察，没说点哪里、怎么点，等于不能用）。
 * 教学必需，属于 AGENTS 9.9 的例外；每条 ≤18 字，别写成说明书。
 */
const ACTION_HOW: Partial<Record<string, string>> = {
  // 建议动作卡已删除，动作改在场景里完成 —— 说明必须是「手上怎么动」，
  // 写「点这张卡」等于指向一个不存在的按钮（2026-10-22）。
  observe: "点一下要观察的那台器皿",
  readInstrument: "点天平读数，等示数稳住",
  wash: "把器皿拖进洗涤槽冲洗",
  weigh: "点天平，把称量瓶放上秤盘",
  dissolve: "拿洗瓶对准烧杯，拿玻璃棒搅拌",
  transfer: "拿玻璃棒引流，把液体转入容量瓶",
  dilute: "拿洗瓶沿壁加水，快到位换滴管",
  heat: "点加热装置，把器皿放上去",
  evaporate: "点加热装置，边加热边看液面",
  filter: "拿漏斗与滤纸，把液体倒进去",
  centrifuge: "把器皿放进离心机",
  washPrecipitate: "拿洗瓶冲沉淀，滤液弃去",
  addDrops: "拿滴管逐滴加入",
  titrate: "拿滴定管，逐滴滴到变色",
  assemble: "把试剂拖到对应器皿上",
  calibrate: "点天平，按内校键",
};

/**
 * 主操作卡最后一行：点下去会发生什么（用户 2026-10-22「点了没反应，也不知道下一步做什么」）。
 * 纯阅读类动作给「看完了 → 继续」，其余给动词明确的收尾；一条都不许空着。
 */
const ACTION_CTA: Readonly<Record<string, string>> = {
  observe: "看完了 → 继续",
  readInstrument: "读完 → 继续",
  calibrate: "点这里校准",
  wash: "点这里完成洗涤",
  weigh: "点这里称量",
  dissolve: "点这里加液溶解",
  transfer: "点这里转移",
  dilute: "点这里定容",
  titrate: "点这里滴定",
  addDrops: "点这里加",
  heat: "点这里加热",
  evaporate: "点这里蒸发",
  filter: "点这里过滤",
  centrifuge: "点这里离心",
  washPrecipitate: "点这里洗涤",
  compute: "点这里计算",
  assemble: "点这里组装",
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


/* ------------------------------------------------------------------ *
 * 台面工具 ↔ 动作
 * ------------------------------------------------------------------ */

/**
 * 每件工具能执行哪些动作类型。工具对不上当前步要你做的事时，点了会说明「现在用不上」，
 * 而不是默默无反应（用户 2026-10-22：拿工具点器皿没反应等于不能操作）。
 */
const TOOL_TYPES: Readonly<Record<SceneToolId, readonly string[]>> = {
  faucet: ["wash"],
  // 软毛刷既能刷洗，也能「取放称量瓶」（第 2 步，observe 类）
  brush: ["wash", "observe"],
  // 洗瓶要能「加水溶解」：第 4 步的「加约 30 mL 蒸馏水」是 dissolve 类，
  // 原来洗瓶只认 wash/dilute，学生拿洗瓶加水会被判「用不上」→ 第 4 步死锁
  "wash-bottle": ["wash", "dilute", "dissolve"],
  rod: ["dissolve", "transfer"],
  dropper: ["dilute", "readInstrument"],
  // 器具 ↔ 动作对账（2026-10-22）：每件工具必须说清它能把哪类动作做完，
  // 对不上就回答「现在用不上」，而不是点了没反应。
  cloth: ["wash"],
  detergent: ["wash"],
  cylinder: ["dilute", "transfer", "readInstrument", "dissolve"],
  pipette: ["transfer", "readInstrument"],
  bulb: ["transfer", "readInstrument"],
};

/**
 * 拿错工具做错事 = 当场失败。
 * 这条是「失败要能随手触发」的关键：原来所有陷阱都藏在「其他做法」折叠里，
 * 学生只点建议动作就永远不会犯错，也就永远看不到事故反馈。
 */
const TOOL_VIOLATION: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // 拿刷子/抹布去擦度量器皿内壁 → 纤维残留（L1，扣 2）
  brush: { volumetric: "step1-wipe", flask: "step1-wipe" },
  cloth: { volumetric: "step1-wipe", flask: "step1-wipe" },
  // 凉的还没凉就抢着转移 → 容量瓶热应力炸裂（L3，扣 8 + 碎裂特效）
  rod: { volumetric: "step1-poke" },
};

/**
 * 动作播放期间底部那行字（用户 2026-10-22：动作过程不能没有回应）。
 * 播完由 choose() 清掉，再由调用方的成功文案接上 —— 先演，后说。
 */
const ACTION_CAPTION: Readonly<Record<SceneAction["kind"], string>> = {
  rinse: "自来水冲 → 刷洗 → 倒水 → 沥干…",
  dilute: "沿瓶壁加水，接近刻度改用滴管…",
  stir: "玻璃棒搅拌，固体逐渐溶解…",
  transfer: "液体转移中…",
  drops: "逐滴加入，盯住凹液面…",
  weigh: "托盘下沉，示数稳定中…",
  read: "读数中…",
  observe: "观察现象…",
  heat: "加热升温…",
  // 事故段的台词由 incident-plan 的 caption 给（这里只是兜底，正常不会用到）
  incident: "操作出错了…",
};

export function Workbench({
  expId,
  demoReagent,
  demoVessel,
  demoReadonly = false,
  coachAuto = false,
}: {
  expId: string;
  demoReagent?: string;
  demoVessel?: string;
  demoReadonly?: boolean;
  /** 演示引导自动开、并且替学生把每一步做掉（教师端「课堂演示」） */
  coachAuto?: boolean;
}) {
  const router = useRouter();
  const [ui, dispatch] = useReducer(workbenchReducer, expId, createWorkbenchState);
  const [sceneCaption, setSceneCaption] = useState<string | null>(null);
  /** 演示引导开关（学生端点「演示」，或 ?coach=1 / 教师端 ?teach=1 自动开） */
  const [coachOpen, setCoachOpen] = useState(coachAuto);
  /** 手上拿着的台面工具；非空时点器皿 = 使用它（水龙头冲、毛刷洗…） */
  const [activeTool, setActiveTool] = useState<SceneToolId | null>(null);
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
  /**
   * 空闲提示（30 秒没动手浮一条「内壁还挂水珠吗？」）已下线（用户 2026-10-22）：
   * 它隔 30 秒反复弹、盖住事故条和结果条，演示时比提示本身更打扰。
   * 卡住的学生走右侧灯泡（扣 1/3/5 分）或看板上的一句话指引。
   */
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
  /** 动作层控制器（由 SceneStage 挂载上来）：播完动作才推进这一步。 */
  const sceneApiRef = useRef<SceneActionApi | null>(null);
  /** 动作播放中：挡住重复触发（用户 2026-10-22：动作期间禁止重复触发）。 */
  const actionBusyRef = useRef(false);
  /** 本步该动的器皿（SceneStage 报上来）+ 上一次真正操作过的器皿（转移动作的源）。 */
  const cueVesselRef = useRef<string | null>(null);
  const lastVesselRef = useRef<string | null>(null);
  /** 演示引导当前这一步的路线（给「演示代做」读，避免闭包里拿到上一帧的 plan）。 */
  const coachPlanRef = useRef<CoachPlan | null>(null);

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
          const response = await fetch(`/api/runs/${runId}/events`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ events: [payload] }),
          });
          await requireOk(response, "这一步没存上");
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
          const response = await fetch(`/api/runs/${runId}/drops`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(drop),
          });
          // 投放审计是次要记录：失败不打断学生，但不能再假装成功
          if (!response.ok && typeof console !== "undefined") {
            console.warn(`[drop] 投放记录没存上：HTTP ${response.status}`);
          }
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
      if (!runRes.ok) {
        // 拿不到 runId = 之后每个动作都只在内存里排队，永远不会落库。
        // 原来这里静默 return null：学生照常做实验，交卷时时间线是空的（扣子 dev 实测）。
        setSystemError({
          message: "没连上记录服务：现在做的操作不会被保存",
          detail: `创建记录失败（HTTP ${runRes.status}）`,
          canRetry: true,
        });
        // 自引用会踩 TDZ（eslint: accessed before it is declared），重试直接刷新页面最稳
        retryRef.current = () => window.location.reload();
        return null;
      }
      const data = await runRes.json().catch(() => null);
      if (!data?.ok || typeof data.runId !== "string") return null;

      runIdRef.current = data.runId;
      const queued = queueRef.current.splice(0);
      queued.forEach((item) => sendAction(item.action, item.inputMode));
      const queuedDrops = dropQueueRef.current.splice(0);
      queuedDrops.forEach((drop) => sendDrop(drop));
      return data.runId;
    } catch (error) {
      // 网络层失败同样要出声：不然看起来只是「点了没反应」
      const detail = errorMessage(error);
      setSystemError({ message: "没连上记录服务：现在做的操作不会被保存", detail: detail.message, canRetry: true });
      retryRef.current = () => window.location.reload();
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

  /** 场景内流程指引：下一步该用哪瓶试剂 —— 试剂架微亮 + 锥形瓶脉冲。 */
  const nextReagent = nextReagentId(step, performed, rackIdsFor(expId));

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
        : // 什么都没发生时这一行就是「现在该做什么」：动作名 + 点下去会怎样，
          // 让第一次进来的人不用猜（用户 2026-10-22）。
          `现在该做：${clip(guideName(suggested.label), 14)}`);
  const resultLine2 = ui.event ? resultCopy.line2 : undefined;
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
   * 演示引导（唯一一套「下一步做什么」）：把建议动作翻译成一条路线，
   * 光带 + 指尖 + 气泡照着走一遍。旧任务看板已下线（用户 2026-10-22）。
   */
  const stepHow = expId === "exp01" ? exp01StepHow(step.index) : undefined;
  /** 场景高亮的器皿（纯函数算，不在渲染期读 ref —— React Compiler 的 rules/refs 会判错） */
  const cueVesselId = expectedVesselId(step, performed, SCENE_VESSELS);
  const coachPlan: CoachPlan | null =
    coachOpen && !ui.exp.done && suggested
      ? buildCoachPlan({
          key: `${expId}:${step.index}:${suggested.choiceId}:${performed.size}`,
          type: suggested.type,
          label: suggested.label,
          vessels: SCENE_VESSELS,
          reagentId: nextReagent,
          reagentName: nextReagent ? getSceneReagent(nextReagent)?.name : null,
          cueVesselId,
          stepHow,
          tools: (TOOLS_BY_EXPERIMENT[expId] ?? [])
            .map((id) => getSceneTool(id))
            .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
            .map((tool) => ({ id: tool.id, label: tool.label })),
        })
      : null;
  useEffect(() => {
    coachPlanRef.current = coachPlan;
  }, [coachPlan]);

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

  /**
   * 事故演出的两半（用户 2026-10-23：「事故在动画中途炸…炸完再出说明」）：
   * - `trapFx`：**不在器皿上**发生的事故（仪器损坏 / 重金属污染）仍用覆盖层特效；
   * - `incidentNote`：炸完之后才出现的那 1~2 行说明（原因 + 正确做法），不自动消失。
   *
   * 演示与真操作都不在这里分叉：两边都调 `runIncident()`，差别只有 commit。
   */
  type IncidentNote = {
    seq: number;
    level: IncidentLevel;
    deduction: number;
    title: string;
    why: string;
    correct: string;
  };
  const [incidentNote, setIncidentNote] = useState<IncidentNote | null>(null);
  const [trapFx, setTrapFx] = useState<{ seq: number; level: IncidentLevel; fx: SceneFxKey } | null>(null);
  /** 事故动画播放中：挡住重复触发（不触发 React 重渲染，只在回调里读） */
  const incidentBusyRef = useRef(false);

  /**
   * 覆盖层事故特效：只剩**不在器皿上**发生的那两种（仪器损坏 / 重金属污染）。
   * 器皿上的事故（裂 / 炸 / 暴沸 / 起火 / 灼伤 / 毒气）全部在台面 SVG 里演
   * （见 actions/incident.ts），同一件事绝不再叠一个覆盖层小场景。
   */
  const eventFxKey = ui.event?.incident && ui.event.fx ? FX_MAP[ui.event.fx] : null;
  const fx = trapFx ? (
    <FxByKey key={`trap-${trapFx.seq}`} fx={trapFx.fx} level={trapFx.level} active scale="inline" />
  ) : eventFxKey &&
    OVERLAY_FX.has(eventFxKey) &&
    (ui.event?.level === "L2" || ui.event?.level === "L3" || ui.event?.level === "L4") ? (
    <FxByKey
      key={`${ui.event?.fxSeq ?? 0}-${eventFxKey}`}
      fx={eventFxKey}
      level={ui.event?.level ?? "L2"}
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

  /**
   * 事故演出的**唯一入口**（用户 2026-10-23 第 4 条：两条路径合一）。
   *
   * 真操作与错误演示都走这里：
   *   1. 先在台面上播同一条事故时间线（起手错操作 → 中途炸 → 余波），画面先行；
   *   2. 播完再 `commit()` —— 真操作在这里才 dispatch（扣分/事故条/重做），
   *      演示不传 commit，所以实验状态一个字节都不动；
   *   3. 说明（`note`）也是播完才挂出来，绝不提前弹面板遮住画面。
   */
  const runIncident = useCallback(
    async (
      plan: IncidentPlan | null,
      opts: { commit?: () => void; note?: IncidentNote } = {},
    ) => {
      const api = sceneApiRef.current;
      if (plan && api && !incidentBusyRef.current) {
        incidentBusyRef.current = true;
        setIncidentNote(null);
        setTrapFx(null);
        setNotice(null);
        setSceneCaption(plan.caption);
        try {
          await api.playIncident(plan);
        } finally {
          incidentBusyRef.current = false;
          setSceneCaption(null);
        }
      }
      opts.commit?.();
      if (opts.note) setIncidentNote(opts.note);
    },
    // setState 函数是稳定引用；列出来是为了让 React Compiler 能保留这份 memoization
    [setIncidentNote, setSceneCaption, setTrapFx, setNotice],
  );

  /**
   * 带动作地做一步（用户 2026-10-22：操作过程必须有动画，不能只有文字）。
   * 顺序固定：播动作 → 播完（或用户跳过）→ choose() 推进并出分。
   * 动作播放期间 actionBusy 挡住重复触发，不会连点两次跳两步。
   */
  const withAction = useCallback((action: SceneAction | null, run: () => void) => {
    if (actionBusyRef.current) return;
    const api = sceneApiRef.current;
    if (!action || !api) {
      run();
      return;
    }
    actionBusyRef.current = true;
    // 动作一开始就把底部那行换成「正在做什么」，顺手清掉上一步残留的提示
    setSceneCaption(ACTION_CAPTION[action.kind] ?? null);
    void api.play(action).then((ok) => {
      actionBusyRef.current = false;
      if (ok) run();
    });
  }, []);

  /** 选定的动作器皿：优先用户刚点的那台，其次场景标出来的目标。 */
  const actionVessel = useCallback(
    (vesselId?: string | null) => vesselId ?? lastVesselRef.current ?? cueVesselRef.current,
    [],
  );

  /**
   * 播动作 → 播完 → choose() → 再写文案。
   * 文案必须落在动作之后（用户 2026-10-22：动作结束才出结果条和分数），
   * 先出字再播动画等于又回到「点一下 → 文字」的老样子。
   */
  const chooseWithAction = useCallback(
    (choiceId: string, action: SceneAction | null, after?: () => void) =>
      withAction(action, () => {
        choose(choiceId);
        after?.();
      }),
    [withAction, choose],
  );

  /**
   * 演示代做（教师端 / 自动引导）：用学生手动操作同一条链路把这一步做掉 ——
   * 先播场景动作（洗 / 搅拌 / 转移 / 倒液），播完再判分推进，不直接跳状态。
   */
  const performForCoach = useCallback(() => {
    if (ui.exp.done) return;
    if (!suggested || actionBusyRef.current) return;
    const vesselId = coachPlanRef.current?.vesselId ?? cueVesselRef.current ?? lastVesselRef.current;
    const tool = (coachPlanRef.current?.toolId ?? null) as SceneToolId | null;
    const from = lastVesselRef.current;
    if (vesselId) lastVesselRef.current = vesselId;
    chooseWithAction(
      suggested.choiceId,
      actionForChoice(suggested, { vesselId, tool, from }),
    );
  }, [chooseWithAction, suggested, ui.exp.done, demoReadonly]);

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
   * 取一条提示（唯一入口：灯泡 / 键盘 H / 24s 空闲自动）。
   * 三级阶梯与扣分由 use-workbench 的 revealHint 决定；用完时不再派发。
   * 学生主动取提示会上报 `{ kind: "hint" }`（报告记「提示 k 次 · −X 分」）：
   * 服务端 appendRunEvents 落审计行 → replay 收集 → 计分按 HINT_DEDUCT_BY_LEVEL 求和；
   * 演示只读模式（`?play=demo`）不落库。
   */
  const askHint = useCallback(() => {
    if (ui.exp.done || hintExhausted) return;
    // 学生主动取提示要落库（报告要记"提示 k 次 · −X 分"）：
    // UI 档次 1/2/3 → 引擎 HintLevel 0/1/2；演示只读模式不落库。
    const tier = hintTierFor(hintUsedInStep(ui, ui.exp.stepIndex));
    dispatch({ type: "hint" });
    // 提示是引导系统的一部分：取到提示就把引导打开，气泡第二行换成这条提示
    setCoachOpen(true);
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

  /**
   * 做完最后一步 → 自动进结算页（用户 2026-10-22：七步走完停在台面上，
   * 没有任何提示，"都不知道我做完没有"）。
   *
   * 留 1.4 秒给最后一条成功反馈被看见，然后直接交卷跳报告页；
   * 演示只读模式（?play=demo）不落库，走 finish() 里的 demo 分支。
   */
  useEffect(() => {
    if (!ui.exp.done || demoReadonly || finishingRef.current) return;
    const timer = window.setTimeout(() => {
      if (!finishingRef.current) void finish();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [ui.exp.done, demoReadonly, finish]);

  useEffect(() => {
    // 放进 setTimeout(0)：Next 16 的 react-hooks/set-state-in-effect 不允许在 effect 里同步 setState
    // 「跳过实验」只在演示 / 课堂里出现（学生正常流程看不到，AGENTS 9.4 的顾虑）。
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setSkipVisible(
        coachAuto ||
          params.get("demo") === "1" ||
          params.get("play") === "demo" ||
          params.get("teach") === "1",
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [coachAuto]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      // 事件目标是 window / document 时没有 closest（合成事件、扩展脚本都会这样），
      // 直接 .closest 会抛 "target.closest is not a function" 把 dev overlay 点红。
      const target = event.target instanceof Element ? event.target : null;
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
          {/*
            唯一一套引导：演示按钮 → 光带 + 虚拟手指 + 气泡（DemoCoach）。
            旧任务看板（mission-board.*）2026-10-22 下线，两套指引并存会互相打架。
          */}
          <div className={styles.coachSlot}>
            <button
              type="button"
              className={`${styles.coachButton} ix`}
              data-demo-id="demo-coach-open"
              data-open={coachOpen ? "true" : "false"}
              aria-pressed={coachOpen}
              onClick={() => setCoachOpen((open) => !open)}
              title="跟着光带走一遍：这一步该拿什么、拖到哪"
            >
              <span className={styles.coachDot} aria-hidden="true" />
              {coachOpen ? "关闭演示" : "演示"}
            </button>
          </div>

          {/*
            旧「第 1/4 步 · 开始前先看一眼」弹窗与新手教学卡都已删（用户 2026-10-22）：
            同一个页面只留一套「告诉我该干什么」的机制 —— 现在是演示引导 + 底部「现在该做」。
          */}
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
            step={step}
            performed={performed}
            suggestedName={guideName(suggested.label)}
            suggestedType={suggested.type}
            // 「这一步是不是在加试剂」：决定拖一瓶过去要不要播倒液动画（见 scene-stage dropAt）
            reagentDrop={Boolean(suggested && REAGENT_TYPES.has(suggested.type))}
            onCueVessel={(id) => {
              cueVesselRef.current = id;
            }}
            actionApiRef={sceneApiRef}
            onIncidentCue={(kind) => {
              // 事故在时间线中途「炸」的那一帧：只出声，不出字（说明等播完才出）
              if (kind === "impact") playSound("fail-incident");
            }}
            layoutKey={ui.exp.stepIndex}
            onQuickAction={(vesselId) => {
              // 点画面里的天平 / 器皿：和按 1 一样，直接用当前建议动作
              if (!suggested || ui.exp.done) return;
              // 先取源器皿，再更新「上一次碰过的器皿」（顺序反了，转移动作的 from 永远等于目标）
              const fromVessel = lastVesselRef.current;
              if (vesselId !== "balance" && vesselId !== "ph") lastVesselRef.current = vesselId;
              chooseWithAction(
                suggested.choiceId,
                actionForChoice(suggested, {
                  vesselId: actionVessel(vesselId),
                  tool: activeTool,
                  from: fromVessel,
                }),
              );
            }}
            onUseReagent={(reagentId, vesselId) => {
              // 试剂架上的东西必须真的能加进去（用户 2026-10-22：挂了三个试剂完全没用上）
              const reagentName = getSceneReagent(reagentId)?.name ?? "试剂";
              const vesselLabel = getSceneVessel(vesselId)?.label ?? "器皿";
              if (ui.exp.done) {
                setSceneCaption("实验已经结束，不用再加试剂了");
                return;
              }
              /**
               * 试剂落到器皿上 → 执行这一步。
               * 但只对「真的是加试剂」的步骤生效：称量/调平/读数这类步骤，倒一瓶 Na₂CO₃ 过去
               * 就把天平校准做完了，等于跳过操作（2026-10-22 实测：第 2 步被一瓶试剂顶过去）。
               */
              if (suggested && REAGENT_TYPES.has(suggested.type)) {
                choose(suggested.choiceId);
                setSceneCaption(`${reagentName}加入${vesselLabel}：这一步做完了`);
                return;
              }
              if (suggested) {
                setSceneCaption(
                  `${reagentName}这一步用不上：这一步要「${guideName(suggested.label)}」`,
                );
                return;
              }
              setSceneCaption(`${reagentName}已加入${vesselLabel}：看左侧下一步`);
            }}
            toolIds={TOOLS_BY_EXPERIMENT[expId] ?? []}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onUseTool={(tool, vesselId) => {
              // 1) 拿错工具做错事 → 当场失败（失败要能随手触发，不能只藏在「其他做法」里）
              const violation = TOOL_VIOLATION[tool]?.[vesselId];
              if (violation && !ui.exp.done) {
                setActiveTool(null);
                /**
                 * 真操作触发的事故与错误演示走**同一条**演出（用户 2026-10-23 第 4 条）：
                 * 先在台面上把这次错操作演到一半再炸，播完才 dispatch（扣分/事故条/重做）。
                 */
                const violationChoice = step.choices.find((item) => item.choiceId === violation);
                const plan = planIncident({
                  choice: violationChoice,
                  vessels: SCENE_VESSELS,
                  vesselId,
                  fromVesselId: lastVesselRef.current,
                });
                if (plan) {
                  void runIncident(plan, { commit: () => choose(violation) });
                  return;
                }
                choose(violation);
                return;
              }
              /**
               * 转移类动作的源器皿 = 动这次之前手上那台（上一次点过/拖过的）。
               * 必须先把 from 取出来再更新 lastVesselRef —— 先更新的话 from 永远等于目标器皿，
               * actionForChoice 判 from===vessel 返回 null，第 6 步「移液管转移」就没有动画（2026-10-22 实测）。
               */
              const fromVessel = lastVesselRef.current;
              lastVesselRef.current = vesselId;
              // 2) 工具对得上当前建议动作 → 先播动作，播完再判分
              if (suggested && !ui.exp.done && TOOL_TYPES[tool].includes(suggested.type)) {
                chooseWithAction(
                  suggested.choiceId,
                  actionForChoice(suggested, { vesselId, tool, from: fromVessel }),
                );
                return;
              }
              // 3) 类型没匹配上也照样让它有用：把当前这一步做掉（面板上的东西不能是死的）
              if (suggested && !ui.exp.done) {
                const usedLine = `${getSceneTool(tool)?.label ?? "这个工具"}用上了：${getSceneVessel(vesselId)?.label ?? "器皿"}这一步完成`;
                chooseWithAction(
                  suggested.choiceId,
                  actionForChoice(suggested, { vesselId, tool, from: fromVessel }),
                  () => setSceneCaption(usedLine),
                );
                return;
              }
              setSceneCaption(`${getSceneTool(tool)?.label ?? "这个工具"}已放到${getSceneVessel(vesselId)?.label ?? "器皿"}上`);
            }}
            onDropToNowhere={(vesselId) => {
              // 器皿已弹回原位；告诉学生能往哪拖，别以为操作丢了
              const label = getSceneVessel(vesselId)?.label ?? "器皿";
              setSceneCaption(`${label}已放回原位：在台面上松手＝换位置，拖进洗涤槽＝洗`);
            }}
            onSinkUse={() => {
              // 洗槽 = 水龙头：先拿起来，再点要洗的器皿
              setActiveTool((current) => (current === "faucet" ? null : "faucet"));
              setSceneCaption("水龙头已打开：点要冲洗的器皿");
            }}
            onDropToSink={(vesselId) => {
              // 洗涤的真实操作方式（用户 2026-10-22）：把器皿拖进洗涤槽。
              // 注意顺序 —— choose() 内部会 setSceneCaption(null)，正反馈必须写在它之后才对得起。
              const vesselLabel = getSceneVessel(vesselId)?.label ?? "器皿";
              if (ui.exp.done) {
                setSceneCaption("实验已经结束，不用再洗了");
                return;
              }
              /** 已做过 / 前置未满足的都不算「现在能做」。 */
              const locked = (item: { choiceId: string; requires?: readonly string[] }) =>
                performed.has(item.choiceId) ||
                (item.requires ?? []).some((id) => !performed.has(id));
              // 建议动作就是洗涤 → 直接做；否则退到本步还没做、前置已满足的那条洗涤动作。
              // （exp01 第 1 步的建议动作是「核对品名/规格/数量」，洗涤紧随其后 ——
              //   死盯 suggested.type 会输出「这一步不用洗」，跟整步主题自相矛盾。）
              const target =
                (suggested && suggested.type === "wash" && !locked(suggested) ? suggested : undefined) ??
                step.choices.find(
                  (item) => item.role === "correct" && item.type === "wash" && !locked(item),
                );
              if (!target) {
                // 绝不静默：这一步不该洗，也要当面说清该看哪儿
                setSceneCaption("这一步不用洗，先看左侧该做什么");
                return;
              }
              // 洗错器皿要有失败判定（用户 2026-10-22：拖什么进去都判对，等于没有规则）。
              // exp01 第 1 步认领洗涤的对象是容量瓶 —— 量器要求最高，烧杯/试管在后面步骤里洗。
              const sinkExpected = expId === "exp01" && step.index === 0 ? "volumetric" : null;
              if (sinkExpected && vesselId !== sinkExpected) {
                choose("step1-wash-wrong");
                setSceneCaption(
                  `${vesselLabel}不用现在洗：这一步洗的是${getSceneVessel(sinkExpected)?.label ?? "容量瓶"}`,
                );
                return;
              }
              // 洗涤动作：冲水 → 刷洗 → 倒水 → 沥干，播完才判分
              const rinseLine = target.completesStep
                  ? `${vesselLabel}已倒置晾干：内壁无水珠`
                  : `${vesselLabel}冲洗完成：内壁成均匀水膜`;
              chooseWithAction(
                target.choiceId,
                { kind: "rinse", vesselId, tool: "faucet" },
                () => setSceneCaption(rinseLine),
              );
            }}
          >
            {fx}
          </SceneStage>
          {/* E2 事故（L3/L4）：事故条 + 三行处置，贴在舞台上沿，不遮实验台中心 */}
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
          {/* 错误演示的说明：**炸完才出**，2 行（原因 + 正确做法），不自动消失（用户 2026-10-23） */}
          {incidentNote ? (
            <IncidentBanner
              open
              compact
              level={incidentNote.level}
              title={incidentNote.title}
              lines={[incidentNote.title, incidentNote.why, incidentNote.correct]}
              deduction={incidentNote.deduction}
              autoHideMs={0}
              onDismiss={() => setIncidentNote(null)}
              demoId="demo-trap-incident"
            />
          ) : null}
          {/*
            右上角「错误演示」：只是**触发器**。
            器皿上的事故在台面 SVG 里演（同一套器皿 / 液体 / token），说明等炸完才出；
            不在器皿上的事故（仪器损坏 / 重金属）仍用覆盖层特效。
          */}
          <TrapPanel
            traps={step.choices
              .filter((item) => item.role === "trap")
              .map((item) => ({ choiceId: item.choiceId, label: item.label, level: item.hazard?.level }))}
            disabled={ui.exp.done || finishing}
            onPick={(choiceId) => {
              // 演示：只演画面，不 dispatch、不扣分、不重做本步
              const choice = step.choices.find((item) => item.choiceId === choiceId);
              const hazard = choice?.hazard;
              if (!choice || !hazard) return;
              ensureAudio();
              playSound("error-system");
              const note: IncidentNote = {
                seq: Date.now(),
                level: hazard.level,
                deduction: 0, // 演示不扣分
                title: hazard.feedback.title,
                why: hazard.feedback.why ?? "这一步不该这么做。",
                correct: hazard.feedback.correct ?? "按场景里亮起的目标再来一遍。",
              };
              const plan = planIncident({
                choice,
                vessels: SCENE_VESSELS,
                cueVesselId: cueVesselRef.current ?? cueVesselId,
                fromVesselId: lastVesselRef.current,
              });
              if (plan) {
                void runIncident(plan, { note });
                return;
              }
              // 没有可演的台面动画：说明照出，仪器/废液类事故补上覆盖层特效
              const overlay = hazard.fx ? FX_MAP[hazard.fx] : null;
              setTrapFx(overlay && OVERLAY_FX.has(overlay) ? { seq: Date.now(), level: hazard.level, fx: overlay } : null);
              setIncidentNote(note);
            }}
          />

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

          {/*
            建议动作卡已删除（用户 2026-10-22）：
            「点这张卡即完成」等于答题，不是做实验。动作改为在场景里用工具/器皿完成，
            引导看左上任务看板（目标 + 判据 + 当前该干什么）。
          */}

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

      {/* 演示引导：光带 + 虚拟手指 + 气泡；教师端自动开并且替学生把这一步做掉 */}
      {coachOpen ? (
        <DemoCoach
          key={coachPlan?.key ?? "coach-off"}
          plan={coachPlan}
          auto={coachAuto}
          onPerform={performForCoach}
          onClose={() => setCoachOpen(false)}
          hint={ui.hint?.text ?? null}
        />
      ) : null}

      {/* 一键演示的虚拟光标：只在 auto 模式出现，pointer-events 永远 none */}
      {mode === "auto" ? <GhostCursor state={ghost} /> : null}
    </div>
  );
}
