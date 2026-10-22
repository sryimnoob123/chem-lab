"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { StepDefinition } from "@/lib/engine.types";
import type { SceneAction, SceneActionApi } from "@/components/exp/scene/actions/action-layer";
import { prefersReducedMotion } from "@/components/exp/scene/actions/timeline";
import { getSceneVessel } from "@/lib/scene/palette";
import { getSceneReagent } from "@/lib/scene/reagents";
import { DEFAULT_RACK_IDS, rackIdsFor } from "./rack-ids";
import { expectedVesselId, wrongVesselLine } from "./vessel-targets";
import { BenchScene, type SceneFeedback } from "@/components/exp/scene/bench-scene";
import { ReagentBottle } from "@/components/exp/scene/reagent-bottle";
import type { SceneToolId } from "@/lib/scene/tools";
import { ComputeBench } from "@/components/exp/scene/compute-bench";
import { PourFX } from "@/components/exp/scene/pour";
import { EndingFlash, SuccessBurst } from "@/components/exp/feedback";
import { pourCopy, type DropReject, type DropVerdict } from "@/components/exp/guide/drop-resolve";
import { LabApparatus } from "./lab-apparatus";
import { useDropFlow, type DropMode } from "./use-drop-flow";
import styles from "./workbench.module.css";

/**
 * 台面器皿白名单（2026-10-21 验收口径）：
 * - exp01 称量配制：天平（bench-scene 内固定）+ 烧杯 + 容量瓶 + 两支量器位
 * - exp03 醋酸电离常数：容量瓶 + 烧杯（水浴）+ 锥形瓶 + pH 计（bench-scene 内固定）
 * 不传 = 全量器皿（exp02/04/08 保持原样，不动它们的既有验收）。
 */
const EXP01_BENCH_VESSELS = ["beaker", "volumetric", "tube-a", "tube-b"];
/** exp03：flask（锥形瓶）在 SVG 里 x≈120，而 viewBox 从 370 起 → 中心落在画布外被裁（红队 2026-10-22 实测 cx=119）。
 *  这两步用不到锥形瓶，直接不给它。 */
const EXP03_BENCH_VESSELS = ["beaker", "volumetric", "tube-a", "tube-b"];
/** exp09 前两步（配 500 mL 溶液）也走台面：只留烧杯 + 容量瓶（称 NaOH / 定容用），
 *  试管和锥形瓶这两步根本用不到，摆着只会多出可点热区（红队 2026-10-21 报 635×136 大热区）。 */
const EXP09_BENCH_VESSELS = ["beaker", "volumetric"];

/**
 * 「这一步怎么动手」——只说操作方式，不重复判据（用户 2026-10-22：光说动作名不算指引）。
 * 点空白时的提示按动作类型换说法，别再一律「拖工具到器皿上」（称量步这么说是错的）。
 */
function howToFor(type?: string | null): string {
  switch (type) {
    case "weigh":
    case "readInstrument":
      return "点台面上的天平";
    case "wash":
      return "把器皿拖进洗涤槽";
    case "dissolve":
      return "拿洗瓶或玻璃棒，点要用的器皿";
    case "transfer":
      return "拿移液管或玻璃棒，点目标器皿";
    case "dilute":
      return "拿量筒或洗瓶，点容量瓶";
    case "heat":
    case "evaporate":
      return "把器皿放到电热套上";
    default:
      return "看左上角任务看板给的操作方式";
  }
}

/**
 * 3D 试点（?scene=3d）：three.js 场景只在客户端加载，ssr:false；
 * 加载失败/不支持 WebGL 时组件内部给降级提示，去掉参数即回 2D，2D 路径零改动。
 */
const TitrationScene = dynamic(
  () => import("@/components/scene3d/titration-scene").then((mod) => mod.TitrationScene),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", color: "#c9d6e4", fontSize: 12 }}
        data-demo-id="demo-scene-3d-loading"
      >
        3D 场景加载中…
      </div>
    ),
  },
);

/** 读地址栏 `?scene=3d`；只在挂载后读，避免 SSR/水合不一致，也不改 2D 首屏。 */
function useScene3d(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.search).get("scene");
      setEnabled(value === "3d" || value === "3D");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  return enabled;
}

const RACK_IDS = DEFAULT_RACK_IDS;

/** exp02 / exp03 / exp04 / exp08 暂时复用实验台 SVG：分析天平 + 烧杯 + 试管 + 容量瓶。 */
const BENCH_CONTENTS: Readonly<Record<string, readonly string[]>> = {
  burette: [],
  flask: ["nacl"],
  beaker: ["na2co3"],
  "tube-a": [],
  "tube-b": [],
  volumetric: [],
};

const EXP03_BENCH_CONTENTS: Readonly<Record<string, readonly string[]>> = {
  burette: [],
  flask: [],
  beaker: ["water"],
  "tube-a": [],
  "tube-b": [],
  volumetric: ["water"],
};

/** exp09 前两步：烧杯装 NaOH（配标准溶液），容量瓶待定容；标签不能再写 Na₂CO₃。 */
const EXP09_BENCH_CONTENTS: Readonly<Record<string, readonly string[]>> = {
  burette: [],
  flask: [],
  beaker: ["naoh"],
  "tube-a": [],
  "tube-b": [],
  volumetric: [],
};

const EXP04_BENCH_CONTENTS: Readonly<Record<string, readonly string[]>> = {
  burette: [],
  flask: [],
  beaker: ["na2co3"],
  "tube-a": ["nacl"],
  "tube-b": ["ki"],
  volumetric: ["water"],
};

/** 没有"已完成动作"时的空集合（避免每次渲染新建 Set 让下游 useMemo 失效）。 */
const EMPTY_PERFORMED: ReadonlySet<string> = new Set<string>();

/** 拖拽三段式的兜底判定：没有接线时只提示，不改状态。 */
const NO_RESOLVE: (reagentId: string) => DropVerdict = () => ({
  kind: "reject",
  line: "先按上方步骤操作",
  lines: ["这一步还没接上判定", "投放只在当前步骤有对应动作时才生效", "按上方「建议动作」做这一步"],
});

export function SceneStage({
  expId,
  onCaption,
  onInput,
  autoDrop,
  feedbackTone,
  feedbackSeq,
  resolveDrop,
  onDropAccepted,
  onDropRejected,
  stepDoneKey,
  nextReagent,
  hintHighlight = false,
  onQuickAction,
  onCueVessel,
  actionApiRef,
  layoutKey,
  toolIds,
  activeTool = null,
  onSelectTool,
  onUseTool,
  onUseReagent,
  onDropToNowhere,
  onSinkUse,
  /** 把台面上的器皿拖进洗涤槽 = 洗这台器皿（用户 2026-10-22：洗涤是拖过去洗，不是点水龙头）。 */
  onDropToSink,
  forceBench,
  benchInstrument,
  computeMode,
  observations,
  step,
  performed,
  suggestedName,
  suggestedType,
  reagentDrop = true,
  children,
}: {
  expId?: string;
  onCaption: (text: string | null) => void;
  onInput?: (mode: DropMode) => void;
  autoDrop?: { reagentId: string; vesselId: string };
  feedbackTone: "success" | "failure" | null;
  feedbackSeq: number;
  /** 同步判定"这投算不算"；由工作台用当前步 + 已做动作算。 */
  resolveDrop?: (reagentId: string) => DropVerdict;
  /** 倒入动画播完后工作台才 dispatch（用户要的"先动画、再下一步"）。 */
  onDropAccepted?: (choiceId: string, mode: DropMode) => void;
  /** 拒收：一句为什么，本步不动、允许原地重试。 */
  onDropRejected?: (reject: DropReject, point?: { x: number; y: number }) => void;
  /** 本步刚完成（L2）：器皿一次性高光。 */
  stepDoneKey?: number;
  /** 场景内流程指引：下一步该用哪瓶 → 试剂架微亮 + 锥形瓶脉冲（和看板指向同一动作）。 */
  nextReagent?: string | null;
  /** L3 提示：直接在目标元素（锥形瓶热区）上描边 + 箭头。 */
  hintHighlight?: boolean;
  /** 点台面上的仪器（如天平）＝按 1，直接使用当前建议动作。 */
  onQuickAction?: (vesselId: string) => void;
  /** 把「本步该动哪台器皿」告诉工作台：动作动画要知道落在谁身上。 */
  onCueVessel?: (vesselId: string | null) => void;
  /** 工作台通过它播动作（洗涤/搅拌/转移/称量…），播完才 dispatch。 */
  actionApiRef?: { current: SceneActionApi | null };
  /** 步骤/重置变化：器皿回位 */
  layoutKey?: number;
  /** 当前建议动作的 type（observe/weigh/dissolve…）；决定「点器皿」算不算完成 */
  suggestedType?: string;
  /** 台面工具：水龙头/毛刷/洗瓶/玻璃棒（用户 2026-10-22 要求每个操作都有对应工具） */
  toolIds?: readonly SceneToolId[];
  activeTool?: SceneToolId | null;
  onSelectTool?: (id: SceneToolId | null) => void;
  onUseTool?: (tool: SceneToolId, vesselId: string) => void;
  /** 把试剂拖/点到器皿上（→ 执行当前步的加液动作，试剂架不能是摆设） */
  onUseReagent?: (reagentId: string, vesselId: string) => void;
  /** 器皿被拖到没有去处的地方（要说一句，不能静默） */
  onDropToNowhere?: (vesselId: string) => void;
  /** 点洗涤槽：把当前拿着的器皿放进去冲 */
  onSinkUse?: () => void;
  /** 器皿被拖进洗涤槽（落点命中 sink 区域时会带器皿 id 回调）。 */
  onDropToSink?: (vesselId: string) => void;
  /** 强制走台面场景（exp09 前两步是配溶液，不该显示滴定台）。 */
  forceBench?: boolean;
  /** 台面场景摆哪台仪器：balance / ph / none（不传按 expId 走默认）。 */
  benchInstrument?: "balance" | "ph" | "none";
  /** 数据处理步（exp09 第 7 步）：场景换成数据台，不再显示滴定管/锥形瓶。 */
  computeMode?: boolean;
  /** 本步已完成的观察文本，数据台据此点亮读数表 / 极差 / 浓度比。 */
  observations?: readonly string[];
  /** 当前步骤 + 本步已做动作：用来算「这一步的试剂该落进哪台器皿」。 */
  step?: StepDefinition;
  performed?: ReadonlySet<string>;
  /** 当前建议动作的名字（点错地方时用它说「这一步是 XXX」）。 */
  suggestedName?: string;
  /**
   * 这一步的建议动作是不是「把试剂加进去」（workbench 按 REAGENT_TYPES 判）。
   * 只有 true 才播倒液动画 —— 否则倒一瓶硫酸进去也会演得跟成功一样，
   * 然后才说「这一步用不上」，自相矛盾。
   */
  reagentDrop?: boolean;
  children?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  /**
   * 动作层控制器（用户 2026-10-22：操作必须有可见的动作过程）。
   * 工作台通过 actionApiRef.play(action) 播一条动作，Promise 在「播完 / 跳过」后 resolve，
   * 工作台拿到 true 才 dispatch —— 保证「动作结束才出结果和分数」。
   */
  const [sceneAction, setSceneAction] = useState<SceneAction | null>(null);
  const pendingActionRef = useRef<((ok: boolean) => void) | null>(null);

  const finishAction = useCallback(() => {
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    setSceneAction(null);
    pending?.(true);
  }, []);

  const playAction = useCallback(
    (next: SceneAction) =>
      new Promise<boolean>((resolve) => {
        if (pendingActionRef.current) {
          resolve(false);
          return;
        }
        if (prefersReducedMotion()) {
          resolve(true);
          return;
        }
        pendingActionRef.current = resolve;
        setSceneAction(next);
      }),
    [],
  );

  useEffect(() => {
    if (!actionApiRef) return undefined;
    actionApiRef.current = { play: playAction, skip: finishAction, busy: Boolean(sceneAction) };
    return () => {
      actionApiRef.current = null;
    };
  }, [actionApiRef, playAction, finishAction, sceneAction]);
  /**
   * 指针当前压着的那台器皿（拖拽中 / 选好试剂后悬停时）。
   * 每台器皿自己亮自己报名字，代替以前那个盖住整排器皿的大方块热区。
   */
  const [overVesselId, setOverVesselId] = useState<string | null>(null);
  const use3d = useScene3d();
  const flow = useDropFlow({
    stageRef,
    resolve: resolveDrop ?? NO_RESOLVE,
    onPour: (reagentId, _verdict, mode) => {
      onInput?.(mode);
      const copy = pourCopy(reagentId);
      if (copy) onCaption(copy);
    },
    onAccept: (verdict, mode) => onDropAccepted?.(verdict.choiceId, mode),
    onReject: (verdict, _reagentId, mode, point) => {
      onInput?.(mode);
      onCaption(null);
      // 拒收也只抖「松手时压着的那一台」，不再抖整块台面（2026-10-22 用户口径）
      const hit = point ? vesselAt(point) : null;
      if (hit) setRejectFx((prev) => ({ id: hit, key: (prev?.key ?? 0) + 1 }));
      onDropRejected?.(verdict, point);
    },
  });

  /**
   * 台面场景（analysis 天平 + 玻璃器皿）而非滴定场景。
   * exp01 是「仪器认领 / 天平使用 / 溶液配制」，之前没列进来 → 落到滴定默认场景，
   * 打开是滴定管+锥形瓶，跟"称量配制"完全对不上（用户 2026-10-21 报的硬伤①）。
   */
  const isBenchScene =
    forceBench === true ||
    expId === "exp01" ||
    expId === "exp08" ||
    expId === "exp02" ||
    expId === "exp03" ||
    expId === "exp04";

  // 3D 只覆盖 exp09（滴定管 + 锥形瓶）；其它实验继续走 2D，避免"半 3D 半 2D"的夹生场景
  const show3d = use3d && !isBenchScene && (expId === undefined || expId === "exp09");
  // 试点参数：随操作进度（feedbackSeq）推进——滴定管液面下降、锥形瓶液面上升
  const sceneProgress = Math.min(1, feedbackSeq / 9);
  const sceneBuretteLevel = 1 - 0.52 * sceneProgress;
  const sceneFlaskLevel = 0.1 + 0.42 * sceneProgress;
  const rackIds: readonly string[] = rackIdsFor(expId);
  const reagents = rackIds.map((id) => getSceneReagent(id)).filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );

  /**
   * 指针拖拽的临时状态（用户 2026-10-22 口径：演示与手操都走 pointerdown/move/up）。
   * 只有移动超过阈值才算"拖"，原地按下松手仍按普通点击处理（点选模式）。
   */
  const pointerDragRef = useRef<{ id: string; pointerId: number; moved: boolean } | null>(null);
  /**
   * 跟手的拖动影子（性能版，2026-10-22）：
   * 旧实现每个 pointermove 都 setDragGhost(x, y) —— 一次拖拽能把这块 800 行的组件
   * 重渲染上百次，手感就是「有延迟、不跟手」。现在 state 只在「影子出现/消失」时变一次，
   * 位置在 rAF 里直接写 transform（一帧最多一次），全程不触发 React 渲染。
   */
  const [ghostReagent, setGhostReagent] = useState<string | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const ghostPos = useRef({ x: 0, y: 0 });
  const ghostFrame = useRef(0);

  const moveGhost = (x: number, y: number) => {
    ghostPos.current = { x, y };
    if (ghostFrame.current) return;
    ghostFrame.current = window.requestAnimationFrame(() => {
      ghostFrame.current = 0;
      const node = dragGhostRef.current;
      if (node) {
        node.style.transform = `translate3d(${ghostPos.current.x - 14}px, ${ghostPos.current.y - 18}px, 0)`;
      }
    });
  };

  const clearGhost = () => {
    if (ghostFrame.current) window.cancelAnimationFrame(ghostFrame.current);
    ghostFrame.current = 0;
    setGhostReagent(null);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const id = flow.draggingId ?? event.dataTransfer.getData("text/plain");
    if (id) dropAt(id, { x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!autoDrop || autoDrop.vesselId !== "flask") return;
    if (!RACK_IDS.includes(autoDrop.reagentId as (typeof RACK_IDS)[number])) return;
    const timer = window.setTimeout(() => flow.fireEvent(autoDrop.reagentId), 0);
    return () => window.clearTimeout(timer);
    // 只在 URL 事件参数变化时重放一次；flow 的方法每次渲染都是新引用。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDrop?.reagentId, autoDrop?.vesselId]);

  const selected = reagents.find((item) => item.id === selectedId) ?? null;
  const targetActive = Boolean(selectedId || flow.draggingId);

  /**
   * 最近一次投放落到的器皿（用户 2026-10-22：只跟被操作的那一台互动）。
   * 反馈只传给这一个器皿；整块台面不再播吸附/抖动。
   */
  const [targetVesselId, setTargetVesselId] = useState<string | null>(null);
  /** 拒收时抖的那一台（落点器皿），带 key 让抖动可重播。 */
  const [rejectFx, setRejectFx] = useState<{ id: string; key: number } | null>(null);

  /** 松手点下面压着的器皿 id：大热区按钮盖在 SVG 上，必须逐层穿透才拿得到器皿。 */
  const vesselAt = (point: { x: number; y: number }): string | null => {
    if (typeof document === "undefined") return null;
    for (const el of document.elementsFromPoint(point.x, point.y)) {
      const hit = el.closest<HTMLElement>('[data-demo-id^="demo-scene-vessel"]');
      const id = hit?.dataset.demoId?.replace("demo-scene-vessel-", "");
      if (id) return id;
    }
    return null;
  };

  /**
   * 拖拽中的落点高亮：直接改 SVG 属性（data-drop），不 setState。
   * 台上每台器皿的环与气泡都由属性驱动，命中哪台亮哪台 —— 一次拖拽 React 一次都不重渲染。
   */
  const paintDropHover = (hitId: string | null) => {
    if (typeof document === "undefined") return;
    const painted = document.querySelectorAll<HTMLElement>('[data-drop-kind="vessel"][data-drop]');
    painted.forEach((el) => {
      delete el.dataset.drop;
    });
    if (!hitId) return;
    const el = Array.from(document.querySelectorAll<HTMLElement>('[data-drop-kind="vessel"]')).find(
      (node) => node.dataset.vesselId === hitId || node.dataset.demoId === `demo-scene-vessel-${hitId}`,
    );
    if (!el) return;
    el.dataset.drop = !cueVesselId || cueVesselId === hitId ? "ok" : "bad";
  };

  /** 落位：先记下落点器皿（反馈只给它），再交给 flow 播倾倒。 */
  /** 这一步该落进哪台器皿（算不出来就是 null = 不限定，任何可倒器皿都接受）。
   *  判定只看定义里的文案（见 vessel-targets.ts），拿不准就放宽 —— 演示现场被自己的
   *  判定挡住，比"倒错没提醒"严重得多。 */
  const sceneVessels = isBenchScene
    ? ((expId === "exp01" || expId === "exp08"
        ? EXP01_BENCH_VESSELS
        : expId === "exp03"
          ? EXP03_BENCH_VESSELS
          : expId === "exp09"
            ? EXP09_BENCH_VESSELS
            : null) ?? [])
    : ["flask", "burette"];
  const vesselLabels = sceneVessels.map((id) => ({ id, label: getSceneVessel(id)?.label ?? id }));
  /**
   * 本步该动的那台器皿：**常驻**呼吸描边 + 「点这里」。
   * 用户口径「我不知道下一步该做什么」—— 场景里必须有一个肉眼可见的目标，
   * 而不是只有右侧一张卡。算不出来（本步不是倒试剂）就不亮，绝不瞎指。
   */
  const cueVesselId = step ? expectedVesselId(step, performed ?? EMPTY_PERFORMED, vesselLabels) : null;

  /** 把目标器皿报给工作台：动作动画要落在这一台上 */
  useEffect(() => {
    onCueVessel?.(cueVesselId);
  }, [cueVesselId, onCueVessel]);
  const dropHoverValid = !cueVesselId || !overVesselId || overVesselId === cueVesselId;

  /** 一句"这里不是要动的地方"——任何落空/落错都必须出声，绝不静默。 */
  const nudge = (text: string) => {
    onCaption(text);
  };

  const dropAt = (id: string, point: { x: number; y: number }) => {
    const hit = vesselAt(point);
    setOverVesselId(null);
    if (!hit) {
      nudge(`松手的地方没有器皿：把${getSceneReagent(id)?.name ?? "试剂"}拖到台面上的器皿上`);
      return;
    }
    setTargetVesselId(hit);
    if (cueVesselId && hit !== cueVesselId) {
      const droppedLabel = getSceneVessel(hit)?.label ?? hit;
      const expectedLabel = getSceneVessel(cueVesselId)?.label ?? cueVesselId;
      const verdict = {
        kind: "reject" as const,
        ...wrongVesselLine(droppedLabel, expectedLabel, getSceneReagent(id)?.name ?? "这瓶试剂"),
      };
      onInput?.("drag");
      onCaption(null);
      setRejectFx((prev) => ({ id: hit, key: (prev?.key ?? 0) + 1 }));
      onDropRejected?.(verdict, point);
      return;
    }
    // 试剂落到器皿上 = 真的加进去（原来只发一条 info，什么也没发生 —— 用户 2026-10-22）
    // 先演完「瓶子飞过去 → 倾斜 → 液柱落进器皿 → 液面上升」，再让工作台 dispatch。
    if (onUseReagent) {
      // 这一步确实是"加试剂" → 先演倒液再判分；否则直接交给工作台说一句为什么
      if (reagentDrop) flow.pourThen(id, hit, point, () => onUseReagent(id, hit));
      else onUseReagent(id, hit);
      return;
    }
    flow.drop(id, point);
  };

  /** 器皿在屏幕上的落点（命中框中心偏上 = 瓶口位置）。 */
  const pointOfVessel = (id: string): { x: number; y: number } => {
    if (typeof document === "undefined") return { x: 0, y: 0 };
    const el = document.querySelector<HTMLElement>(`[data-demo-id="demo-scene-vessel-${id}"]`);
    const rect = el?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 };
  };

  /**
   * 点了台面上的某台器皿：
   * - 手里拿着试剂 → 倒进这一台（点选模式＝拖拽同一条链路）；
   * - 是本步该动的器皿 → 直接执行建议动作（点哪儿都有结果）；
   * - 不是 → 抖一下 + 一句话说清这一步该动哪台（绝不静默）。
   */
  const activateVessel = (id: string) => {
    if (selectedId) {
      dropAt(selectedId, pointOfVessel(id));
      setSelectedId(null);
      return;
    }
    // 天平 / pH 计：只有「称量 / 校准 / 读数」这类动作才算点它做完。
    // 原来无条件 onQuickAction —— review 实测连点天平 21 次就能拿 100 分收卷（2026-10-22）。
    if (id === "balance" || id === "ph") {
      setTargetVesselId(id);
      // observe 也算：exp01 第 2 步的「看水平泡」「用毛刷取放称量瓶」都挂在仪器上观察，
      // 把 observe 排除会让第二步死锁（实测点 8 次天平都不动）。
      // 仍然挡掉 wash / dissolve / transfer / dilute —— 那些必须用工具或拖器皿。
      // compute 也要算：第 3 步的完成动作「按 m₁ − m₂ 记差减质量」就是天平读数，
      // 不接的话第 3 步永远过不去（7 步里唯一没有场景入口的动作）。
      const deviceAct = ["weigh", "calibrate", "readInstrument", "observe", "compute"];
      if (suggestedType && deviceAct.includes(suggestedType)) {
        onQuickAction?.(id);
        return;
      }
      nudge(`${id === "balance" ? "天平" : "pH 计"}这里现在不用动，这一步要做的是「${suggestedName ?? "别的操作"}」`);
      return;
    }
    if (cueVesselId && id !== cueVesselId) {
      setRejectFx((prev) => ({ id, key: (prev?.key ?? 0) + 1 }));
      nudge(
        `这一步要动的是${getSceneVessel(cueVesselId)?.label ?? cueVesselId}，不是${getSceneVessel(id)?.label ?? id}`,
      );
      return;
    }
    setTargetVesselId(id);
    // 关键：只有「观察 / 读数」这类动作可以直接点器皿完成。
    // 原来这里无条件 onQuickAction()，结果点到本步那台器皿就等于做对一步 ——
    // 用户 2026-10-22 实测：连点容量瓶/试管/烧杯一路「连对 11」直达第 7 步。
    // 洗、称、溶、转移、定容、移液必须走场景里的工具或拖试剂。
    if (suggestedType === "observe" || suggestedType === "readInstrument") {
      onQuickAction?.(id);
      return;
    }
    nudge(
      `${getSceneVessel(id)?.label ?? id}已经选中：这一步要${
        suggestedType === "wash" ? "把器皿拖进洗涤槽" : "用台面上的工具或拖试剂来完成"
      }`,
    );
  };

  const vesselFeedback: SceneFeedback | null = rejectFx
    ? { vesselId: rejectFx.id, kind: "reject", key: rejectFx.key }
    : feedbackTone && targetVesselId
      ? {
          vesselId: targetVesselId,
          kind: feedbackTone === "success" ? "success" : "reject",
          key: feedbackSeq,
        }
      : null;

  // 一次成功的动作把上一条拒收抖动画清掉，避免它还挂在器皿上
  useEffect(() => {
    if (feedbackTone === "success") setRejectFx(null);
  }, [feedbackTone, feedbackSeq]);

  return (
    <div
      ref={stageRef}
      className={styles.sceneStage}
      data-scene={show3d ? "3d" : "2d"}
      onClick={(event) => {
        // 点空白取消选中；按钮/器皿自己的 click 不在这里处理
        const target = event.target as Element;
        if (target.closest("button")) return;
        if (target.closest('[data-demo-id^="demo-scene-vessel"]')) return;
        if (selectedId || flow.draggingId) {
          // 手里还拿着试剂时点空白 = 放弃这次操作，不唠叨
          setSelectedId(null);
          flow.endDrag();
          onCaption(null);
          return;
        }
        // 其余情况（点在台面空白/插图上）必须有回应，绝不静默：
        // 告诉学生这一步该点哪里，而不是让他自己猜。
        // 建议动作卡已删除，不能再指向「右侧那张卡」（指向不存在的东西，
        // 而且这条提示会覆盖掉真正的成功文案，7 步全程可见 —— review 报的 blocker）
        nudge(
          expId && isBenchScene
            ? `这一步要「${suggestedName ?? "按看板提示操作"}」：${howToFor(suggestedType)}`
            : `这一步要「${suggestedName ?? "按看板提示操作"}」：看左上角任务看板给的操作方式`,
        );
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelectedId(null);
          flow.endDrag();
          onCaption(null);
        }
      }}
    >
      <aside className={styles.rack} aria-label="试剂架">
        <div className={styles.rackHead}>
          <span>试剂架</span>
          <span className={styles.rackHint}>
            {/* 只在"下一步确实要投加某瓶试剂"时给拖拽提示。
                否则数据处理/计算类步骤（如 exp09 第 7 步）还会挂着"拖到锥形瓶"，
                和当前该做的事完全对不上（红队 2026-10-22 实测）。 */}
            {nextReagent ? (isBenchScene ? "拖到烧杯 / 容量瓶" : "拖到锥形瓶") : null}
          </span>
        </div>
        <ul className={styles.rackList}>
          {reagents.map((reagent) => (
            <li key={reagent.id}>
              <button
                type="button"
                className={`${styles.reagent} ix`}
                data-demo-id={reagent.demoId}
                data-selected={selectedId === reagent.id ? "true" : "false"}
                data-dragging={flow.draggingId === reagent.id ? "true" : "false"}
                data-next={reagent.id === nextReagent ? "true" : "false"}
                aria-pressed={selectedId === reagent.id}
                aria-label={`${reagent.name} ${reagent.formula}，${selectedId === reagent.id ? "已选中" : "可拖动"}`}
                onPointerDown={(event) => {
                  // 真实指针拖拽（段 1 抓取）：左键按下即进入抓取态并接管后续 move/up。
                  if (event.button !== 0) return;
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    /* 合成事件（演示脚本）没有真实指针，捕获失败不影响后续 dispatch */
                  }
                  pointerDragRef.current = { id: reagent.id, pointerId: event.pointerId, moved: false };
                  flow.beginDrag(reagent.id);
                  setSelectedId(reagent.id);
                  onCaption(null);
                }}
                onPointerMove={(event) => {
                  // 段 2 移动：超过阈值才算出拖。全程只写 DOM，不 setState（性能硬指标）。
                  const drag = pointerDragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  if (!drag.moved) {
                    if (Math.abs(event.movementX) + Math.abs(event.movementY) < 3) return;
                    drag.moved = true;
                    setGhostReagent(drag.id);
                  }
                  moveGhost(event.clientX, event.clientY);
                  if (isBenchScene) {
                    // 台面场景：落点高亮直接改属性，命中哪台亮哪台
                    paintDropHover(vesselAt({ x: event.clientX, y: event.clientY }));
                  } else {
                    const hit = document.elementFromPoint(event.clientX, event.clientY);
                    flow.setOverFlask(Boolean(hit?.closest('[data-demo-id="demo-scene-drop-flask"]')));
                    setOverVesselId(vesselAt({ x: event.clientX, y: event.clientY }));
                  }
                }}
                onPointerUp={(event) => {
                  // 段 3 落位：用松手坐标提交，吸附/倾倒/回弹都由 useDropFlow 播。
                  const drag = pointerDragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  pointerDragRef.current = null;
                  clearGhost();
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                  flow.setOverFlask(false);
                  paintDropHover(null);
                  if (!drag.moved) {
                    flow.endDrag();
                    return;
                  }
                  dropAt(drag.id, { x: event.clientX, y: event.clientY });
                }}
                onPointerCancel={() => {
                  pointerDragRef.current = null;
                  clearGhost();
                  paintDropHover(null);
                  flow.endDrag();
                }}
                onClick={() => {
                  setSelectedId((current) => (current === reagent.id ? null : reagent.id));
                  onCaption(null);
                }}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible")) {
                    setSelectedId(reagent.id);
                    onCaption(null);
                  }
                }}
              >
                <ReagentBottle
                  className={styles.reagentBottle}
                  color={reagent.colorHex}
                  width={22}
                  height={32}
                />
                <span className={styles.reagentText}>
                  <span className={styles.reagentName}>{reagent.name}</span>
                  <span className={styles.reagentFormula}>{reagent.formula}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.rackNote}>
          {expId === "exp01"
            ? "台上：分析天平 200 g / 0.1 mg · 称量瓶 · 烧杯 · 容量瓶 100 mL · Na₂CO₃"
            : expId === "exp02"
            ? "台上：分析天平 200 g / 0.1 mg · 烧杯 · 容量瓶 · Na₂CO₃ / 蒸馏水"
            : expId === "exp03"
              ? "台上：pH 计 · 烧杯 · 容量瓶 · 蒸馏水"
              : expId === "exp04"
                ? "台上：离心管 · 烧杯 · 试管 · 容量瓶 · Na₂CO₃ / 蒸馏水"
                : expId === "exp08"
                  ? "台上：分析天平 200 g / 0.1 mg · 烧杯 · Na₂CO₃ 试样"
                  : isBenchScene
                    ? "台上：分析天平 · 烧杯 · 容量瓶 · 试剂"
                    : "台上：酸式滴定管 50 mL / 锥形瓶 250 mL"}
        </p>
      </aside>

      {selected && !flow.draggingId ? (
        <div className={styles.pickHint} role="status" aria-live="polite" data-demo-id="demo-pick-hint">
          已选中 {selected.name} · 再点目标器皿
          <span className={styles.pickHintKey}>Esc 取消</span>
        </div>
      ) : null}

      <div className={styles.benchArea}>
        {/* 不再用 key={feedbackSeq}：那会让整块台面每做一步就重建、所有器皿动画一起重播
            （用户 2026-10-22 说的「整场一起动」）。反馈只传给被操作的那一个器皿。 */}
        <div
          className={styles.apparatusWrap}
          data-bench={isBenchScene ? "true" : undefined}
          data-feedback={feedbackTone ?? undefined}
        >
          {feedbackTone === "success" ? (
            <SuccessBurst
              level={stepDoneKey ? "L2" : "L1"}
              replayKey={feedbackSeq}
              className={styles.burstSlot}
              demoId="demo-feedback-burst"
            />
          ) : null}
          {stepDoneKey ? (
            <EndingFlash
              key={stepDoneKey}
              tone="ok"
              className={styles.endingFlashSlot}
              demoId="demo-feedback-ending"
            >
              <span />
            </EndingFlash>
          ) : null}
          {show3d ? (
            <div
              className={styles.apparatus}
              style={{ position: "relative", width: "100%", height: "100%" }}
              data-demo-id="demo-scene-3d-wrap"
            >
              <TitrationScene
                buretteLevel={sceneBuretteLevel}
                flaskLevel={sceneFlaskLevel}
                label="三维滴定场景：滴定管内液面下降，锥形瓶内液面上升；拖动或用方向键旋转视角"
              />
            </div>
          ) : isBenchScene ? (
            <div className={styles.benchReuse} data-demo-id={`${expId}-bench-scene`}>
              <BenchScene
                vesselIds={
                  expId === "exp01" || expId === "exp08"
                    ? EXP01_BENCH_VESSELS
                    : expId === "exp03"
                      ? EXP03_BENCH_VESSELS
                      : expId === "exp09"
                        ? EXP09_BENCH_VESSELS
                        : undefined
                }
                instrument={benchInstrument ?? (expId === "exp03" ? "ph" : "balance")}
                contents={
                  expId === "exp03"
                    ? EXP03_BENCH_CONTENTS
                    : expId === "exp04"
                      ? EXP04_BENCH_CONTENTS
                      : expId === "exp09"
                        ? EXP09_BENCH_CONTENTS
                        : BENCH_CONTENTS
                }
                reaction={null}
                selectedReagentId={selectedId}
                draggingReagentId={flow.draggingId}
                dropHoverId={overVesselId}
                dropHoverValid={dropHoverValid}
                cueVesselId={cueVesselId}
                feedback={isBenchScene ? vesselFeedback : null}
                onFeedbackEnd={() => undefined}
                onDropReagent={(id) => {
                  if (selectedId) dropAt(selectedId, pointOfVessel(id));
                }}
                onActivateVessel={(id) => activateVessel(id)}
                toolIds={toolIds}
                activeTool={activeTool}
                onSelectTool={onSelectTool}
                onUseTool={onUseTool}
                onDropToNowhere={onDropToNowhere}
                sink={expId === "exp01" ? { x: 392, y: 424, onUse: onSinkUse } : undefined}
                onDropToSink={onDropToSink}
                onClearSelection={() => undefined}
                onReveal={() => undefined}
                action={sceneAction}
                onActionDone={finishAction}
                pour={flow.pour}
                layoutKey={layoutKey}
              />
            </div>
          ) : computeMode ? (
            <div className={styles.apparatus} data-demo-id="demo-compute-wrap">
              <ComputeBench observations={observations ?? []} />
            </div>
          ) : (
            <LabApparatus
              className={styles.apparatus}
              cue={cueVesselId}
              hover={overVesselId}
              hoverValid={dropHoverValid}
              onPick={activateVessel}
            />
          )}
          {/* 数据处理步没有可投加的容器，别留一个"锥形瓶"热区误导 */}
          {computeMode ? null : (
          <button
            type="button"
            className={`${styles.flaskTarget} ix`}
            data-active={targetActive ? "true" : "false"}
            data-drop-target={targetActive ? "true" : "false"}
            data-over={flow.overFlask ? "true" : "false"}
            data-next={nextReagent ? "true" : "false"}
            data-dragging={flow.draggingId ? "true" : "false"}
            data-hint-highlight={hintHighlight ? "true" : "false"}
            data-demo-id="demo-scene-drop-flask"
            aria-label={isBenchScene ? "实验台：把选中的试剂放进来" : "锥形瓶：把选中的试剂放进来"}
            onClick={(event) => {
              if (!selectedId) return;
              // 台面场景：点热区 = 让手里那瓶倒进指针位置下压着的那台器皿（和拖拽同一条链路）
              if (isBenchScene) {
                dropAt(selectedId, { x: event.clientX, y: event.clientY });
                setSelectedId(null);
                return;
              }
              flow.tapTarget(selectedId);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              flow.setOverFlask(true);
            }}
            onDragLeave={() => flow.setOverFlask(false)}
            onDrop={handleDrop}
          >
            <span className={styles.dropLabel}>
              {flow.overFlask ? "松手加入" : selectedId ? "放到锥形瓶" : "锥形瓶"}
            </span>
          </button>
          )}
        </div>
        <div className={styles.benchSurface} aria-hidden="true" />
      </div>

      <div className={styles.fxSlot} data-feedback={feedbackTone ?? undefined}>
        {children}
      </div>

      {/* 台面场景的倾倒画在 SVG 里（bench-scene → bench-pour）：坐标是器皿几何算出来的，
          瓶口对准容器的口。滴定场景（exp09）仍用 HTML 层的 PourFX。 */}
      {isBenchScene ? null : <PourFX pour={flow.pour} onDone={flow.clearPour} />}

      {/* 动作播放中：给一个明确的「跳过」（默认必须播完，但用户可以催） */}
      {sceneAction ? (
        <button
          type="button"
          className={styles.skipAction}
          data-demo-id="demo-action-skip"
          onClick={finishAction}
        >
          跳过动作
        </button>
      ) : null}

      {/* 跟手的拖动影子：只在拖出阈值后出现，位置由 rAF 写 transform（不重渲染） */}
      {ghostReagent ? (
        <div
          ref={(node) => {
            dragGhostRef.current = node;
            if (!node) return;
            // 首帧就放到指针处（用 ref 回调写，避免渲染期读 ref）
            node.style.transform = `translate3d(${ghostPos.current.x - 14}px, ${ghostPos.current.y - 18}px, 0)`;
          }}
          className={styles.dragGhost}
          aria-hidden="true"
          data-demo-id="demo-drag-ghost"
        >
          <ReagentBottle
            className={styles.dragGhostBottle}
            color={getSceneReagent(ghostReagent)?.colorHex ?? "#DCE9F2"}
            width={28}
            height={40}
          />
          <span className={styles.dragGhostName}>
            {getSceneReagent(ghostReagent)?.name ?? ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
