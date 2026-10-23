"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { DROPPABLE_KINDS, SCENE_VESSELS } from "@/lib/scene/palette";
import { describeContents } from "@/lib/scene/reagents";
import type { SceneFx, SceneOutcome } from "@/lib/scene/types";
import { DropHint } from "./drop-hint";
import styles from "./scene.module.css";
import { VesselArt } from "./vessel-art";
import { ToolTray } from "./tool-tray";
import { Sink } from "./sink";
import { BenchPour, type BenchPourIntent } from "./bench-pour";
import { hasLiquidContent } from "./vessels/glass-vessel";
import { ActionLayer, type SceneAction } from "./actions/action-layer";

import type { SceneToolId } from "@/lib/scene/tools";
import { BENCH } from "./bench-layout";
import { LabBackdrop } from "./lab-backdrop";
import {
  useBenchDrag,
  ZERO_OFFSET,
  type BenchBounds,
  type BenchOffset,
  type BenchTarget,
} from "./use-bench-drag";

/** 现象动画时长（与 CSS keyframes 对齐）。 */
const FX_MS: Record<SceneFx, number> = {
  none: 0,
  precipitate: 1200,
  bubbles: 1500,
  color: 600,
  heat: 1800,
  smoke: 2000,
};


export type BenchReaction = { vesselId: string; outcome: SceneOutcome; key: number };

const LABEL_POSITION: Readonly<Record<string, { y: number; contentY: number }>> = {
  /* 名称 16px + 内容 14px。svg 改成填满容器后纵向被拉伸，原来 358/384 会让"空"
     贴到瓶底上；整体上移到 350/378 留出视觉间隙。 */
  burette: { y: 350, contentY: 378 },
  flask: { y: 350, contentY: 378 },
  beaker: { y: 350, contentY: 378 },
  "tube-a": { y: 350, contentY: 378 },
  "tube-b": { y: 350, contentY: 378 },
};

/** 一次投放的即时手感：成功弹一下（+ 光环）/ 拒收抖一下。 */
export type SceneFeedback = { vesselId: string; kind: "success" | "reject"; key: number };

type BenchSceneProps = {
  contents: Readonly<Record<string, readonly string[]>>;
  /**
   * 只显示这些器皿（按 SCENE_VESSELS 的 id）。
   * 不传 = 全显示（默认实验台）；exp01「称量配制」和 exp03「pH 滴定」各自只留自己用得上的，
   * 避免"打开是滴定台、其实是称量实验"的错位（用户 2026-10-21 报的问题）。
   */
  vesselIds?: readonly string[];
  /**
   * 台面上的常驻仪器：天平（称量类实验）或 pH 计（exp03 电离常数测定）。
   * 都不用时传 "none"，避免摆一台当前实验根本用不上的仪器。
   */
  instrument?: "balance" | "ph" | "none";
  reaction: BenchReaction | null;
  selectedReagentId: string | null;
  draggingReagentId: string | null;
  /**
   * 拖拽/点选时指针压着的那台器皿 + 它到底接不接这瓶试剂。
   * 用户 2026-10-22：只有一个大方块时，倒进哪台都一样 —— 现在每台器皿自己亮、
   * 自己显示名字，学生看得出「松手会落进哪一台」。
   */
  dropHoverId?: string | null;
  dropHoverValid?: boolean;
  /** 本步该操作的那台器皿：常驻呼吸描边 + 「点这里」，让第一次进来的人知道点哪。 */
  cueVesselId?: string | null;
  feedback: SceneFeedback | null;
  onFeedbackEnd: () => void;
  onDropReagent: (vesselId: string) => void;
  onActivateVessel: (vesselId: string) => void;
  /** 台面工具（水龙头/毛刷/洗瓶/玻璃棒）。不传 = 不显示工具托盘。 */
  toolIds?: readonly SceneToolId[];
  /** 当前「拿在手上」的工具：非空时点器皿 = 对这台器皿使用该工具。 */
  activeTool?: SceneToolId | null;
  onSelectTool?: (id: SceneToolId | null) => void;
  /** 拿着工具点了某台器皿。 */
  onUseTool?: (tool: SceneToolId, vesselId: string) => void;
  /** 洗涤槽（有洗器皿的实验才摆）；坐标与器皿同一 viewBox。 */
  sink?: { x: number; y: number; onUse?: () => void };
  /** 器皿被拖进洗涤槽（洗涤的真实操作方式，用户 2026-10-22） */
  onDropToSink?: (vesselId: string) => void;
  /** 拖到了没有去处的空位（要说明「只能拖到洗涤槽/天平」，不能静默） */
  onDropToNowhere?: (vesselId: string) => void;
  /** 点空白/Esc 取消已选试剂。 */
  onClearSelection: () => void;
  onReveal: (outcome: SceneOutcome) => void;
  /** 正在播的动作（洗涤/搅拌/转移/称量…），由父组件的工作台驱动。 */
  action?: SceneAction | null;
  /** 动作播完（或跳过）后回调，工作台这时才 dispatch。 */
  onActionDone?: () => void;
  /** 动作时间线中途的回调（事故在「炸」的那一帧：出声 / 定格） */
  onActionCue?: (kind: "impact" | "settle") => void;
  /** 一次倾倒（画在本 SVG 里，坐标就是 viewBox 单位）。 */
  pour?: BenchPourIntent | null;

  /** 步骤/实验重置：器皿回到基准布局（用户 2026-10-22：拖完要能回去）。 */
  layoutKey?: number;
  /** 事故特效层（父组件绝对定位挂在舞台内）。 */
  children?: ReactNode;
}

/**
 * 实验台：SVG 舞台 + 器皿 drop 目标 + 现象动画。
 * 动画结束回调 onReveal(outcome)，由父组件把 caption 写进事件条。
 */
export function BenchScene({
  contents,
  vesselIds,
  instrument = "balance",
  reaction,
  selectedReagentId,
  draggingReagentId,
  dropHoverId = null,
  dropHoverValid = true,
  cueVesselId = null,
  feedback,
  onFeedbackEnd,
  onDropReagent,
  onActivateVessel,
  toolIds,
  activeTool = null,
  onSelectTool,
  onUseTool,
  sink,
  onDropToSink,
  onDropToNowhere,
  onClearSelection,
  onReveal,
  action = null,
  onActionDone,
  onActionCue,
  pour = null,
  layoutKey,
  children,
}: BenchSceneProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  /**
   * 按下态（data-pressed）**不走 React 状态**（2026-10-22 性能体检）：
   * 旧实现按下就 setPressedId → 整块台面（4 台器皿 + 工具托盘 + 天平）重渲染一次，
   * 实测按下这一帧在 6x CPU 降速下要 180ms。按下只是变个样子，直接写属性即可。
   */
  const pressedElRef = useRef<HTMLElement | null>(null);
  const paintPressed = (el: HTMLElement | null) => {
    const prev = pressedElRef.current;
    if (prev && prev !== el) delete prev.dataset.pressed;
    pressedElRef.current = el;
    if (el) el.dataset.pressed = "true";
  };
  /**
   * 器皿液位（0..1）：倒一次涨一格，涨上去不回落（用户 2026-10-22：液面要随倒液上升）。
   * 只记「倒了几次」，液位由次数算出来 —— 这样倾倒动画的起止液位在整段动画里都是常量，
   * 中途任何一次重渲染都不会把液面拽回去，也不需要在渲染期读写 ref。
   */
  const [pours, setPours] = useState<Record<string, number>>({});

  /**
   * 器皿可以被拖动（用户 2026-10-22：烧杯试管拖不动）。
   * 只存「相对原位」的偏移，坐标仍在 SCENE_VESSELS 里当基准，拖动不改数据源。
   */
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  /** 拖动偏移的快照：回位动画要读当前值，不能只在渲染期用 state */
  const offsetsRef = useRef<Record<string, { dx: number; dy: number }>>({});
  /** 归位动画进行中：这段时间内不许 offsets 同步把器皿又写回拖动位置（会打断回弹）。 */
  const resettingRef = useRef(false);
  // offsets（React state）→ DOM transform：唯一写入口，避免和 React 的属性管理打架
  useEffect(() => {
    if (resettingRef.current) return;
    for (const [id, offset] of Object.entries(offsets)) {
      const node = vesselRefs.current[id];
      if (node) node.style.transform = `translate(${offset.dx}px, ${offset.dy}px)`;
    }
  }, [offsets]);

  /** 偏移快照：回位动画要读“当前值”，不能在渲染期写 ref */
  useEffect(() => {
    offsetsRef.current = offsets;
  }, [offsets]);

  /** 这台器皿的底液位：内容物里本来就有液体 → 0.38，只有固体 → 0（只有器底粉末层）。 */
  const baseLevelOf = (id: string) => (hasLiquidContent(contents[id] ?? []) ? 0.38 : 0);
  /** 倒过 n 次之后的液位（0.22 一格，上限 0.88，不超过器皿的 topMax）。 */
  const levelAfter = (id: string, n: number) => Math.min(0.88, Number((baseLevelOf(id) + 0.22 * n).toFixed(3)));

  /**
   * 这一次倾倒的液位计划：从「已经倒过 n 次」涨到「n+1 次」。
   * 只按 pour.key 算一次并记住 —— 动画落地时计数会 +1，如果这里跟着重算，
   * 动画会以为还要再涨一格（实测：液面先跳到两格，再掉回一格）。
   */
  const pourVesselId: string | null = pour?.vesselId ?? null;
  const pourKey = pour?.key ?? 0;
  const pourPlan = useMemo(() => {
    if (!pourVesselId) return null;
    const from = levelAfter(pourVesselId, pours[pourVesselId] ?? 0);
    return { id: pourVesselId, from, to: Math.min(0.88, Number((from + 0.22).toFixed(3))) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意只看这次倾倒：pours 落地后变化不该让计划重算
  }, [pourKey, pourVesselId]);

  const pourFrom = pourPlan?.from ?? 0;
  const pourTo = pourPlan?.to ?? 0;

  /**
   * 渲染用的液位：倾倒期间**立刻**按「倒完」的高度画，再由 bench-pour 用 scaleY
   * 从旧液位涨上来。动画落地后 onLanded 才把计数补上，液位在这一刻正好等于已经在画的高度。
   */
  const levelOf = (id: string) => (pourPlan?.id === id ? pourPlan.to : levelAfter(id, pours[id] ?? 0));
  /** 动画落地：这一台「倒过一次」记账 +1（液位 = levelAfter(次数)，正好等于计划里的 to）。 */
  const landPour = useCallback((id: string) => {
    setPours((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  /**
   * 器皿归位：滑回基准位置（400ms 缓动），不是瞬移。
   * - 步骤推进 / 重置（layoutKey 变）→ 全部归位；
   * - 在台面上松手 / 洗涤动作播完 → 单台归位
   *   （用户 2026-10-23：互动完之后器皿要回原来的位置，不能停在放下的地方）。
   */
  const sendHome = useCallback((ids?: readonly string[]) => {
    const current = offsetsRef.current;
    const targets = Object.keys(current).filter((id) => (ids ? ids.includes(id) : true));
    if (!targets.length) return;
    resettingRef.current = true;
    for (const id of targets) {
      const offset = current[id];
      const node = vesselRefs.current[id];
      if (!offset || (!offset.dx && !offset.dy) || !node) continue;
      const anim = node.animate(
        [
          // 先停一小下再走：直接从槽里"弹"回原位太突兀（用户 2026-10-23 反馈），
          // 现在读起来是「放回去」——停 120ms、再用柔和曲线走 560ms，落位不弹。
          { transform: `translate(${offset.dx}px, ${offset.dy}px)`, offset: 0 },
          { transform: `translate(${offset.dx}px, ${offset.dy}px)`, offset: 0.18 },
          { transform: "translate(0px, 0px)", offset: 1 },
        ],
        { duration: 680, easing: "cubic-bezier(.4, 0, .2, 1)" },
      );
      // 动画结束后把 inline transform 落成 0：否则后续任何一次 offsets 同步都会把它写回原位
      anim.onfinish = () => {
        node.style.transform = "translate(0px, 0px)";
      };
    }
    setOffsets((prev) => {
      if (!ids) return {};
      const next = { ...prev };
      for (const id of targets) delete next[id];
      return next;
    });
    window.setTimeout(() => {
      resettingRef.current = false;
    }, 740);
  }, []);

  useEffect(() => {
    if (layoutKey === undefined) return;
    sendHome();
  }, [layoutKey, sendHome]);

  /**
   * 动作演完（action: null）→ 槽里的器皿立刻回家。
   * 为什么还要这一条：洗涤动画长度是写在 rinse.tsx 里的常量，靠 2520ms 硬等会
   * 「动画停了器皿还卡在槽里」（用户 2026-10-23 实测）。动作生命周期是准的，用它兜底。
   */
  const hadActionRef = useRef(false);
  /** 当前有没有动作在演（洗涤被拒时没有动作 → 器皿要立刻回家） */
  const actionRef = useRef<SceneAction | null>(action);
  /** 刚演完的那条动作（决定要不要补一拍"倒掉"） */
  const endedRef = useRef<{ kind: SceneAction["kind"]; vesselId?: string } | null>(null);
  /**
   * 洗涤/稀释演完 → 先接一条 drain（把水倒掉），倒完再回家。
   * 用户 2026-10-23：水不能凭空消失，要么倒掉要么吸走，流程上要有这一拍。
   */
  const [drain, setDrain] = useState<SceneAction | null>(null);
  useEffect(() => {
    actionRef.current = action;
    if (action && "vesselId" in action) endedRef.current = { kind: action.kind, vesselId: action.vesselId };
    else if (action) endedRef.current = { kind: action.kind };
    const had = hadActionRef.current;
    hadActionRef.current = Boolean(action);
    if (!had || action) return;
    const ended = endedRef.current;
    if ((ended?.kind === "rinse" || ended?.kind === "dilute") && ended.vesselId) {
      setDrain({ kind: "drain", vesselId: ended.vesselId });
      return;
    }
    sendHome();
  }, [action, sendHome]);
  /**
   * 命中框 = 实测的器皿绘制框（2026-10-22 用户反馈"框有点偏移，没在正中间"）。
   * 原来的 hitX = vessel.x + glassLeft*scale - 8 是经验偏移，实测烧杯中心偏 (+11, -16.5)。
   * 现在量 VesselArt 的 getBBox() 直接用，任何 kind / scale 都自动对齐。
   *
   * 2026-10-22 二轮（演示前）：试管这种窄器皿实测只有 11px 宽，手指/鼠标根本压不住 ——
   * 现在按「屏幕像素」兜底：每个热区至少 36px 宽、36px 高（真实 px，用 svg 的缩放换算回
   * viewBox 单位），相邻热区横向重叠时把超出的部分收回到中缝，谁都不许盖住谁。
   */
  const svgRef = useRef<SVGSVGElement | null>(null);
  const artRefs = useRef<Record<string, SVGGElement | null>>({});
  /**
   * 器皿外层 <g> 的 ref。
   * 位置完全由 JS 写 DOM（不用 React 管 transform）：拖动时每帧 setState 会把整棵 SVG
   * 重渲染，实测直接把页面拖卡死；而 React 管理的 transform 又会被手动写入覆盖，
   * 两者打架。所以统一「React 只存 offsets，DOM 由 effect 同步」。
   */
  const vesselRefs = useRef<Record<string, SVGGElement | null>>({});
  /**
   * 拖动结束后浏览器还会补发一个 click：它的 target 落在拖起的器皿上，
   * 于是「选中/点空白」那套处理会把刚写出的成功文案直接盖掉
   * （用户 2026-10-22：洗完看不到「已倒置晾干」，只看到「这一步要用工具」）。
   * 拖动一旦真的移动过，就吞掉紧随其后的那一次 click。
   */
  const swallowNextClick = useCallback(() => {
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    document.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 400);
  }, []);

  /**
   * 可拖范围＝台面本身（用户 2026-10-22：以前为了省事写死 ±340 的方块，现在放开）。
   * 只挡两件不合理的事：拖出画布找不回来、把器皿按到台面以下或举到天上去。
   */
  const dragBounds = useCallback((id: string): BenchBounds => {
    const vessel = SCENE_VESSELS.find((item) => item.id === id);
    const w = vessel?.w ?? 90;
    const h = vessel?.h ?? 120;
    const baseX = vessel?.x ?? 0;
    const baseY = vessel?.y ?? 0;
    /**
     * 可拖范围 = 整个可见台面（取实时 viewBox，不写死常量）。
     * 上一版按「台面线 340 到前沿 430」算，器皿往下最多走 90 单位就顶住 ——
     * 指针还在往下走，器皿不动了，手感就是「拖着拖着不跟手」。
     * 现在只挡两件真正不合理的事：拖出画布（找不回来）、把器皿拖到看不见的位置。
     */
    const vb = svgRef.current?.viewBox.baseVal;
    const left = vb && vb.width > 0 ? vb.x : 370;
    const top = vb && vb.height > 0 ? vb.y : 0;
    const right = left + (vb && vb.width > 0 ? vb.width : 794);
    const bottom = top + (vb && vb.height > 0 ? vb.height : 560);
    const margin = 8;
    return {
      minX: left + margin - baseX,
      maxX: right - w - margin - baseX,
      minY: top + margin - baseY,
      maxY: bottom - h - margin - baseY,
    };
  }, [svgRef]);

  /**
   * 拖动结束后浏览器会补发一个 click：如果漏掉，它会把刚写出的文案盖掉
   * （用户 2026-10-22 报「洗完看不到结果条」）。document 级 swallow 之外再加一道时间闩，
   * 300ms 内的点击一律当作拖动的余波丢掉。
   */
  const dragEndedAtRef = useRef(0);
  const justDragged = useCallback(() => Date.now() - dragEndedAtRef.current < 320, []);

  /**
   * 松手：落在洗涤槽＝洗（洗完滑回原位）；落在台面上＝拿起看了看，滑回原位；
   * 落在别的器皿上或台面外＝回弹 + 一句话（不静默）。
   */
  const handleVesselDrop = useCallback(
    (id: string, target: BenchTarget, offset: BenchOffset): BenchOffset | void => {
      dragEndedAtRef.current = Date.now();
      if (target.kind === "sink") {
        onDropToSink?.(id);
        /**
         * 放在槽里洗，别立刻弹回原地（用户 2026-10-22：动作要在落点上发生）。
         * 冲洗/刷洗/倒水播完（wash 时间线 2520ms）再滑回原位
         * （用户 2026-10-23：互动完之后器皿要回原位，不能停在放下的地方）。
         */
        setOffsets((prev) => ({ ...prev, [id]: offset }));
        // 洗涤被拒（"这一步不用洗"）不会有动作：700ms 没等到动作就直接回家
        window.setTimeout(() => {
          if (!actionRef.current) sendHome([id]);
        }, 700);
        return offset;
      }
      // 台面上松手 = 只是把器皿拿起来看了看：回弹回原位，不停在放下的地方
      if (target.kind === "bench") return undefined;
      onDropToNowhere?.(id);
      return undefined;
    },
    [onDropToNowhere, onDropToSink, sendHome],
  );

  const drag = useBenchDrag({
    svgRef,
    bounds: dragBounds,
    onDrop: handleVesselDrop,
    onDragged: swallowNextClick,
  });
  const [hitBoxes, setHitBoxes] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  useLayoutEffect(() => {
    const measure = () => {
      const svg = svgRef.current;
      const next: Record<string, { x: number; y: number; w: number; h: number }> = {};
      // viewBox 单位 → 屏幕像素的换算（宽度方向），用来把"至少 36px"折成单位数
      const boxWidth = svg?.viewBox.baseVal.width || 570;
      const pxToUnit = svg && svg.clientWidth > 0 ? boxWidth / svg.clientWidth : 1;
      const MIN_W = 24 * pxToUnit;
      const MIN_H = 24 * pxToUnit;
      for (const [id, el] of Object.entries(artRefs.current)) {
        if (!el) continue;
        const b = el.getBBox();
        if (!b.width || !b.height) continue;
        next[id] = {
          // 贴合器皿本身：原来各边留 6~8 单位，画面上蓝框比烧杯大一圈、还偏上
          // （用户 2026-10-22 连提 4 条评论）。只留 2 单位，靠最小触控尺寸兜底。
          x: +(b.x - 2).toFixed(1),
          y: +(b.y - 2).toFixed(1),
          w: +(b.width + 4).toFixed(1),
          h: +(b.height + 4).toFixed(1),
        };
      }
      // ① 太窄/太矮的热区先撑到最小可点尺寸（以绘制框中心为锚点长出去）
      for (const [id, box] of Object.entries(next)) {
        if (box.w < MIN_W) {
          const cx = box.x + box.w / 2;
          box.x = +(cx - MIN_W / 2).toFixed(1);
          box.w = +MIN_W.toFixed(1);
        }
        if (box.h < MIN_H) {
          const cy = box.y + box.h / 2;
          box.y = +(cy - MIN_H / 2).toFixed(1);
          box.h = +MIN_H.toFixed(1);
        }
        next[id] = box;
      }
      // ② 撑大后可能互相压住：按横向顺序在两台器皿的中缝处各自收边（留 4 单位缝）
      const order = Object.entries(next).sort((a, b) => a[1].x - b[1].x);
      for (let i = 1; i < order.length; i += 1) {
        const [prevId, prev] = order[i - 1];
        const [curId, cur] = order[i];
        const prevRight = prev.x + prev.w;
        if (cur.x < prevRight + 4) {
          const seam = (prevRight + cur.x) / 2 - 2;
          if (seam - prev.x > MIN_W * 0.6) {
            prev.w = +(seam - prev.x).toFixed(1);
            next[prevId] = prev;
          }
          const right = cur.x + cur.w;
          if (right - (seam + 4) > MIN_W * 0.6) {
            cur.x = +(seam + 4).toFixed(1);
            cur.w = +(right - cur.x).toFixed(1);
            next[curId] = cur;
          }
        }
      }
      if (Object.keys(next).length) setHitBoxes(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (svgRef.current) ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, []);
  /**
   * 被点中的那一个器皿（用户 2026-10-22 口径：点烧杯就只跟烧杯互动）。
   * 只影响它自己的缩放 + 描边，整块台面与其它器皿的 transform 一律不动。
   */
  const [activeVesselId, setActiveVesselId] = useState<string | null>(null);
  /** 按实验裁剪器皿：天平单独渲染，这里只管玻璃器皿。 */
  const vessels = vesselIds ? SCENE_VESSELS.filter((v) => vesselIds.includes(v.id)) : SCENE_VESSELS;

  /**
   * viewBox 竖向按这一屏实际摆出来的器皿收紧：原 viewBox 顶部空着 ~150 单位，
   * 台面被压在下半屏、显得小（用户 2026-10-22「台面做的太小」）。
   * 横向仍固定 370..940：滴定场景的 pour.tsx 按 360 宽换算，别动横向刻度。
   */
  const tops = vessels.map((v) => v.y);
  if (instrument === "balance") tops.push(214);
  if (instrument === "ph") tops.push(196);
  const contentTop = (tops.length ? Math.min(...tops) : 180) - 30;
  // 台面下方再留 104px 放工具托盘与洗涤槽：动作要在场景里做，
  // 工具如果在 viewBox 外就等于不存在（2026-10-22 踩过）。
  // 台面翻高：器皿与工具之间留出呼吸，不然一排工具紧贴器皿标签（用户 2026-10-22）。
  // 宽度 528 → 780：右半原来全空着，现在放工具区，场景铺满工作区（用户 2026-10-22）
  // 底部空白收紧（186→126）：器皿与工具之间别隔那么死，整块台面更饱满（用户 2026-10-22）
    /**
   * 2.5D 舞台（用户 2026-10-23）：台面上方留出实验室背景带。
   * 背景画在 BENCH.surface 之上，器皿站位不变 —— 只往上加视野，不动任何已有坐标。
   */
  const BACKDROP_H = BENCH.backEdge - 40;
  const backdropTop = BENCH.backEdge - BACKDROP_H;
  const stageTop = Math.min(contentTop - 12, backdropTop);
  const benchTopY = BENCH.backEdge;
  /* 2026-10-23：横向从固定的 794 放宽到 1560（x 20..1580，中心 800 = 台面中心）。
     原来 794 宽配 container 1264px，等比缩放后左右各空 235px —— 台面缩在中间一小块。
     放宽后 viewBox 宽高比 ≈ 3.07，接近容器 3.16，画面基本铺满。 */
  /**
   * 舞台铺满容器（2026-10-23）：1440×900 这种高视口下，viewBox 宽高比（≈3.0）比容器（≈2.0）扁，
   * preserveAspectRatio=meet 会把画面按宽度缩放、下面留一大条白 —— 用户看到的就是「台面悬空」。
   * 做法：量容器实际宽高，把 viewBox 往上补高（补出来的部分全是墙，内容不动），
   * 让宽高比跟容器一致。只在需要时补，绝不裁掉已有内容。
   */
  const [wallExtra, setWallExtra] = useState(0);
  const [floorExtra, setFloorExtra] = useState(0);
  useLayoutEffect(() => {
    const host = svgRef.current?.parentElement;
    if (!host || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const box = host.getBoundingClientRect();
      if (box.width < 40 || box.height < 40) return;
      const vbW = BENCH.viewRight - BENCH.viewLeft;
      const vbH = BENCH.bottom - stageTop;
      const needH = (vbW * box.height) / box.width;
      const extra = Math.max(0, Math.round(needH - vbH));
      /* 多出来的高度一半给墙、一半给台面前方：全给墙会变成一大片空墙（1440×900 实测）。 */
      setWallExtra(Math.round(extra * 0.55));
      setFloorExtra(extra - Math.round(extra * 0.55));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [stageTop]);

  const benchViewBox = `${BENCH.viewLeft} ${stageTop - wallExtra} ${
    BENCH.viewRight - BENCH.viewLeft
  } ${BENCH.bottom + floorExtra - stageTop + wallExtra}`;

  useEffect(() => {
    if (!reaction) return;
    const ms = FX_MS[reaction.outcome.fx];
    if (ms === 0) {
      onReveal(reaction.outcome);
      return;
    }
    const timer = window.setTimeout(() => onReveal(reaction.outcome), ms);
    return () => window.clearTimeout(timer);
  }, [reaction, onReveal]);

  const handleDragOver = (event: DragEvent<SVGGElement>, vesselId: string, accepted = true) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setHoverId(accepted ? vesselId : null);
  };

  const handleDragLeave = (event: DragEvent<SVGGElement>, vesselId: string) => {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setHoverId((current) => (current === vesselId ? null : current));
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, vesselId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivateVessel(vesselId);
  };

  return (
    <div
      className={styles.stage}
      onClick={(event) => {
        // 点空白取消选中；点器皿交给器皿自己的 handler
        const el = event.target as Element;
        if (el.closest('[data-demo-id^="demo-scene-vessel"]')) return;
        setActiveVesselId(null);
        onClearSelection();
      }}
    >
      <svg ref={svgRef} className={styles.benchSvg} viewBox={benchViewBox} role="img" aria-label="实验台：玻璃器皿与分析天平">
        {/* 拿起时的接地投影：径向渐变画，不用 filter（拖动中不能有贵特效） */}
        <defs>
          <radialGradient id="benchLiftShadow">
            <stop offset="0%" stopColor="#1E2A38" stopOpacity="0.26" />
            <stop offset="62%" stopColor="#1E2A38" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#1E2A38" stopOpacity="0" />
          </radialGradient>
          {/* 台面接缝的内阴影：从上往下淡出，给台面「凹进墙里」的那道暗 */}
          <linearGradient id="benchSeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--bench-seam)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--bench-seam)" stopOpacity="0" />
          </linearGradient>
          {/* 台账纸网格：26×26 一格，只有 1px 细线。
              平移 5/9 —— 否则网格线正好落在器皿底沿（340 = 26×13 附近），
              看着像台面上多了一条搁板。 */}
          <pattern id="benchGrid" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="translate(5 9)">
            <path d="M26 0 H0 V26" fill="none" stroke="var(--bench-grid)" strokeWidth="1" />
          </pattern>
          {/* 台面纵深：上浅下深一点，像顶灯照在台面上 */}
          <linearGradient id="benchDepth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="88%" stopColor="#39485A" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#39485A" stopOpacity="0.075" />
          </linearGradient>
        </defs>
        {/* 实验室背景：墙 / 窗 / 试剂架 / 通风柜（纯矢量，零图片） */}
        {/* 墙要盖到补出来的那一截（wallExtra），否则高视口下台面上方会露白 */}
        <LabBackdrop top={backdropTop - wallExtra} />

        {/* 台面（铁架台已删除：exp01/exp03 都不用滴定台，空夹子会被当成"这是什么"） */}
        <g aria-hidden="true">
          {/*
            整块舞台就是台面（略微俯视）：暖白台面 + 极淡台账网格 + 前沿一条厚度。
            之前那条「墙与台面的接缝」画在器皿高度中间，横线从玻璃里穿过去，像贴了条胶带 ——
            去掉。纵深靠「前沿 + 上浅下深的台面渐变」表达。
          */}
          {/* 台面一直铺到舞台下沿（bottom + floorExtra）：高视口下多出来的那截留给台面前方，
              不留给墙 —— 否则 1440×900 上会是一大片空墙。 */}
          <rect
            x={BENCH.left}
            y={benchTopY}
            width={BENCH.right - BENCH.left}
            height={BENCH.bottom + floorExtra - benchTopY}
            fill="var(--bench-top)"
          />
          <rect
            x={BENCH.left}
            y={benchTopY}
            width={BENCH.right - BENCH.left}
            height={BENCH.bottom + floorExtra - benchTopY}
            fill="url(#benchDepth)"
          />
          {/* 极淡网格：26 单位一格，只当纸感，不当装饰 */}
          <rect
            x={BENCH.left}
            y={benchTopY}
            width={BENCH.right - BENCH.left}
            height={BENCH.bottom + floorExtra - benchTopY}
            fill="url(#benchGrid)"
            opacity="0.45"
          />
          {/* 前沿（台面厚度） */}
          <rect x={BENCH.left} y="532" width={BENCH.right - BENCH.left} height="28" fill="var(--bench-edge)" />
          <line x1={BENCH.left} y1="532" x2={BENCH.right} y2="532" stroke="var(--bench-line)" strokeWidth="1" opacity="0.8" />
          <rect x={BENCH.left} y="524" width={BENCH.right - BENCH.left} height="8" fill="url(#benchSeam)" />
        </g>

        {/* 台面落点：落在台面任何位置 = 换了位置就留在那（用户 2026-10-22：放开拖拽范围）。
            放在器皿之前渲染，器皿永远在它上面，不会抢走点击。 */}
        <rect
          data-drop-kind="bench"
          x={BENCH.left}
          y={BENCH.top - 96}
          width={BENCH.right - BENCH.left}
          height={BENCH.front - BENCH.top + 96}
          fill="transparent"
        />

        {/* 分析天平（称量类实验的识别物，静态外形；读数在 step-demo 文案里表达） */}
        {instrument === "balance" ? (
        <g
          data-demo-id="demo-scene-instrument-balance"
          /* 2026-10-23：用户「器材颜色太平淡 / 器皿有实体感」——天平原来只有 132 宽（烧杯 168），
             在台面上像个玩具。以底座为基准放大 1.32 倍，底边仍压 340 台面线。 */
          transform={`translate(${BENCH.instrumentX} ${BENCH.top}) scale(1.2) translate(0 -126)`}
          role="button"
          tabIndex={0}
          aria-label="分析天平：点一下使用建议动作"
          style={{ cursor: "pointer" }}
          onClick={() => onActivateVessel("balance")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onActivateVessel("balance");
            }
          }}
        >
          {/* 底座 + 立柱 */}
          <rect x="0" y="108" width="132" height="18" rx="3" fill="var(--canvas-glass-fill)" stroke="var(--canvas-glass-line)" strokeWidth={1.6} />
          <rect x="56" y="44" width="20" height="64" fill="var(--canvas-glass-fill)" stroke="var(--canvas-glass-line)" strokeWidth={1.6} />
          {/* 玻璃防风罩 + 称量盘（静态外形） */}
          <rect x="18" y="2" width="96" height="44" rx="2" fill="none" stroke="var(--canvas-glass-line)" strokeWidth={1.6} />
          <line x1="66" y1="2" x2="66" y2="12" stroke="var(--canvas-glass-line)" strokeWidth={1.2} />
          <ellipse
            data-balance-pan
            cx="66"
            cy="34"
            rx="30"
            ry="6"
            fill="var(--canvas-glass-fill)"
            stroke="var(--canvas-glass-line)"
            strokeWidth="1.2"
          />
          {/* 显示屏 */}
          <rect x="20" y="56" width="92" height="26" rx="2" fill="none" stroke="var(--canvas-glass-line)" strokeWidth={1.2} />
          <text
            data-balance-readout
            x="66"
            y="74"
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="20"
            fontFamily="ui-monospace, monospace"
          >
            0.0000 g
          </text>
          <text x="66" y="100" textAnchor="middle" fill="var(--ink-2)" fontSize="12">
            分析天平 · 0.1 mg
          </text>
        </g>
        ) : null}

        {/* pH 计（exp03 醋酸电离常数）：主机 + 电极杆，画法沿用天平（底座/屏/标签） */}
        {instrument === "ph" ? (
        <g
          data-demo-id="demo-scene-instrument-ph"
          aria-hidden="true"
          /* 与天平同一口径：以底座为基准放大，底边压 340 台面线 */
          transform={`translate(${BENCH.instrumentX} ${BENCH.top}) scale(1.18) translate(0 -140)`}
        >
          {/* 电极杆 + 球泡 */}
          <line x1="34" y1="70" x2="34" y2="4" stroke="var(--canvas-glass-line)" strokeWidth={2.2} />
          <circle cx="34" cy="4" r="4.5" fill="var(--canvas-glass-fill)" stroke="var(--canvas-glass-line)" strokeWidth={1.4} />
          {/* 主机 */}
          <rect x="8" y="70" width="124" height="70" rx="4" fill="none" stroke="var(--canvas-glass-line)" strokeWidth={1.6} />
          <rect x="18" y="80" width="104" height="30" rx="2" fill="none" stroke="var(--canvas-glass-line)" strokeWidth={1.2} />
          <text x="70" y="101" textAnchor="middle" fill="var(--ink)" fontSize="20" fontFamily="var(--font-mono)">
            7.00
          </text>
          <text x="70" y="128" textAnchor="middle" fill="var(--ink-2)" fontSize="12">
            pH 计 · 0.01
          </text>
        </g>
        ) : null}

        {/* 工具托盘 + 洗涤槽：动作要在场景里做，不能靠点卡片一步过（用户 2026-10-22）。
            托盘位置：用户 2026-10-23「小工具放右下角」—— 器皿行占 430..1005，托盘从 900 铺到台面右沿。 */}
        {toolIds && toolIds.length > 0 && onSelectTool ? (
          <ToolTray
            area={{ x: 640, y: 432, w: 650, h: 112 }}
            toolIds={toolIds}
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            onUseTool={onUseTool}
          />
        ) : null}
        {sink ? (
          <Sink x={sink.x} y={sink.y} running={activeTool === "faucet"} onUse={sink.onUse} />
        ) : null}

        {vessels.map((vessel) => {
          const droppable = DROPPABLE_KINDS.has(vessel.kind);
          const activeOutcome = reaction?.vesselId === vessel.id ? reaction.outcome : null;
          const hovered = hoverId === vessel.id;
          const hintMode = draggingReagentId ? "drag" : selectedReagentId ? "click" : null;
          const glassLeft =
            vessel.kind === "flask"
              ? 32
              : vessel.kind === "beaker"
                ? 26
                : vessel.kind === "burette"
                  ? 38
                  : vessel.kind === "volumetric"
                    ? 28
                    : 7;
          const scale =
            vessel.kind === "flask"
              ? 0.8
              : vessel.kind === "beaker"
                ? 0.72
                : vessel.kind === "burette"
                  ? 0.7
                  : vessel.kind === "volumetric"
                    ? 0.85
                    : 0.64;
          const hitX = vessel.x + glassLeft * scale - 8;
          const hitW = vessel.kind === "burette" ? 70 : vessel.w;

          const fb = feedback?.vesselId === vessel.id ? feedback.kind : null;
          /* 框用实测 bbox（hitBoxes，已按真实绘制范围量过、并按中缝收过边），
             不再用 vessel.w —— 2026-10-23 放大到 1.45 倍后 vessel.w 是画布宽虚胖值，
             ringW = vessel.w + 20 会让相邻两只的热区相交 39px，
             于是「点试管」走 elementFromPoint 命中试管、「拖试管」走矩形扫描命中烧杯。 */
          const hb = hitBoxes[vessel.id];
          const ringX = hb ? hb.x - 6 : vessel.x - 10;
          const ringY = hb ? hb.y - 16 : vessel.y - 22;
          const ringW = hb ? hb.w + 12 : vessel.kind === "burette" ? 100 : vessel.w + 20;
          const ringH = hb ? hb.h + 22 : vessel.h + 34;
          /** 拖拽/点选时指针正压在这台器皿上（每台自己亮，替代以前盖住整排的大方块）。 */
          const isDropHover = dropHoverId === vessel.id;
          /** 本步推荐操作的那台：常驻呼吸描边，让第一次进来的人知道点哪。 */
          const isCue = cueVesselId === vessel.id && !isDropHover;
          /** 拖拽时其它器皿也淡淡描一圈：告诉学生"这些都能落"，不用命中猜。 */
          const isDropCandidate = Boolean(draggingReagentId) && droppable && !isDropHover;

          /**
           * key 只在「这个器皿拿到反馈」时变：让 ix-snap / ix-shake 能重播，
           * 又不会像旧的 wrap key 那样每做一步就把整台器皿重建（整场一起闪）。
           */
          return (
            <g
              ref={(node) => {
                vesselRefs.current[vessel.id] = node;
              }}
              key={`${vessel.id}${fb ? `-${feedback?.key}` : ""}`}
              data-demo-id={`demo-scene-vessel-${vessel.id}`}
              data-drop-kind="vessel"
              data-vessel-id={vessel.id}
              className={`ix ${styles.vessel} ${droppable ? styles.droppable : styles.static} ${
                fb === "reject" ? "ix-shake" : ""
              }`}
              role="button"
              tabIndex={0}
              data-active={activeVesselId === vessel.id ? "true" : "false"}
              data-drag-over={droppable && hovered && draggingReagentId ? "true" : "false"}
              data-drop-hover={isDropHover ? (dropHoverValid ? "valid" : "invalid") : "false"}
              data-cue={cueVesselId === vessel.id ? "true" : "false"}
              data-feedback={fb ?? undefined}
              onPointerDown={(event) => {
                // 拖动器皿：跟手/落点/回弹全交给 use-bench-drag。
                // 关键——拖动过程中不 setState、不重渲染，一帧只写一次 transform。
                if (event.pointerType === "mouse" && event.button !== 0) return;
                event.stopPropagation();
                paintPressed(event.currentTarget as unknown as HTMLElement);
                drag.begin(event, vessel.id, offsets[vessel.id] ?? ZERO_OFFSET);
              }}
              onPointerUp={() => paintPressed(null)}
              onPointerCancel={() => paintPressed(null)}
              aria-label={
                droppable
                  ? `${vessel.label}，内含${describeContents(contents[vessel.id] ?? [])}，可接收试剂`
                  : `${vessel.label}，只装标准溶液，不接受投加试剂；拖入会给出规范提示`
              }
              onPointerLeave={() => paintPressed(null)}
              onClick={(event) => {
                // 必须停冒泡：舞台层的 onClick 是「点空白」处理，会把
                // 「这一步要…拖工具到器皿上」的提示写到 caption 上，
                // 直接盖掉刚出来的成功文案（1.0599 g / 切线 100.0 mL 都看不到）。
                event.stopPropagation();
                // 拖动刚结束的补偿 click：不算「点了一下器皿」
                if (justDragged()) return;
                setActiveVesselId(vessel.id);
                // 手上拿着工具（水龙头/毛刷/洗瓶/玻璃棒）→ 对这台器皿使用它，
                // 用完自动放下。手空着才走原来的「执行当前建议动作」。
                if (activeTool && onUseTool) {
                  onUseTool(activeTool, vessel.id);
                  onSelectTool?.(null);
                  return;
                }
                onActivateVessel(vessel.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setActiveVesselId(vessel.id);
                handleKeyDown(event, vessel.id);
              }}
              onAnimationEnd={(event) => {
                if (event.target === event.currentTarget && fb) onFeedbackEnd();
              }}
              /* 滴定管也接住 drop：交给 resolveDrop 给出「只装标准溶液」的规范提示，而不是默默无反应 */
              onDragEnter={(event) => {
                event.preventDefault();
                if (droppable) setHoverId(vessel.id);
              }}
              onDragOver={(event) => {
                handleDragOver(event, vessel.id, droppable);
              }}
              onDragLeave={(event) => {
                handleDragLeave(event, vessel.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setHoverId(null);
                onDropReagent(vessel.id);
              }}
            >
              {/* 拿起时的接地投影：径向渐变椭圆，拖动中零成本（不用 filter） */}
              <ellipse
                className={styles.liftShadow}
                cx={vessel.x + vessel.w / 2}
                cy={vessel.y + vessel.h + 4}
                rx={vessel.w * 0.6}
                ry={Math.max(7, vessel.w * 0.13)}
              />
              <g ref={(el) => { artRefs.current[vessel.id] = el; }}>
                <g className={styles.vesselLift}>
                  <VesselArt
                    vessel={vessel}
                    contents={contents[vessel.id] ?? []}
                    outcome={activeOutcome}
                    fxKey={reaction?.key ?? 0}
                    level={levelOf(vessel.id)}
                  />
                </g>
              </g>
              {/* 名称 / 内容不跟着器皿走：名字是台面上的固定标签，器皿拖动时字要待在原地
                  （用户 2026-10-23）。标签统一在器皿之后单独一层渲染，见下面 labels 层。 */}
              {/* 成功光环 / 拒收红环（一次性，动画结束由 onAnimationEnd 清掉） */}
              {fb === "success" ? (
                <rect className={styles.pulseRing} x={ringX} y={ringY} width={ringW} height={ringH} rx={10} />
              ) : null}
              {fb === "reject" ? (
                <rect className={styles.rejectRing} x={ringX} y={ringY} width={ringW} height={ringH} rx={10} />
              ) : null}
              {/* 目标环只在「拖到它上面 / 悬停它」时出现：选中态用 focusRing 描边，
                  不再整排器皿一起闪虚线（2026-10-22 用户口径：只跟被操作的那一台互动）。 */}
              {/* 拖拽落点环：常驻渲染，显隐由 data-drop / data-drop-hover 驱动。
                  为什么不做成条件渲染：拖动中每帧 setState 会重渲染整棵 SVG —— 用户报的「卡顿、不跟手」就是这个。 */}
              <rect
                className={styles.dropRing}
                data-ring="ok"
                x={ringX}
                y={ringY}
                width={ringW}
                height={ringH}
                rx={10}
              />
              <rect
                className={styles.dropRingBad}
                data-ring="bad"
                x={ringX}
                y={ringY}
                width={ringW}
                height={ringH}
                rx={10}
              />
              {isDropCandidate ? (
                <rect
                  className={styles.dropRingSoft}
                  x={ringX}
                  y={ringY}
                  width={ringW}
                  height={ringH}
                  rx={10}
                />
              ) : null}
              {isCue ? (
                <rect
                  className={styles.cueRing}
                  data-cue-vessel={vessel.id}
                  x={ringX}
                  y={ringY}
                  width={ringW}
                  height={ringH}
                  rx={10}
                />
              ) : null}
              {/* 落点提示气泡：松手会落进哪一台 / 哪一台放不了 */}
              <g className={styles.dropBadge} data-badge="ok" pointerEvents="none" aria-hidden="true">
                <rect x={vessel.x + vessel.w / 2 - 46} y={ringY - 26} width={92} height={22} rx={11} />
                <text x={vessel.x + vessel.w / 2} y={ringY - 10} textAnchor="middle">
                  落进 {vessel.label}
                </text>
              </g>
              <g className={styles.dropBadge} data-badge="bad" pointerEvents="none" aria-hidden="true">
                <rect x={vessel.x + vessel.w / 2 - 46} y={ringY - 26} width={92} height={22} rx={11} />
                <text x={vessel.x + vessel.w / 2} y={ringY - 10} textAnchor="middle">
                  {vessel.label} 不行
                </text>
              </g>
              {isCue ? (
                <g className={styles.dropBadge} pointerEvents="none" aria-hidden="true">
                  <rect x={vessel.x + vessel.w / 2 - 30} y={ringY - 26} width={60} height={22} rx={11} />
                  <text x={vessel.x + vessel.w / 2} y={ringY - 10} textAnchor="middle">
                    点这里
                  </text>
                </g>
              ) : null}
              {droppable && hovered ? (
                <rect
                  className={styles.targetRing}
                  data-drop-target="true"
                  x={ringX}
                  y={ringY}
                  width={ringW}
                  height={ringH}
                  rx={10}
                />
              ) : null}
              {/* 命中框与焦点环都用实测绘制框：中心与器皿对齐，不再靠经验偏移 */}
              <rect
                className={styles.hit}
                data-hit-vessel={vessel.id}
                x={hitBoxes[vessel.id]?.x ?? hitX}
                y={hitBoxes[vessel.id]?.y ?? vessel.y - 14}
                width={hitBoxes[vessel.id]?.w ?? hitW}
                height={hitBoxes[vessel.id]?.h ?? vessel.h + 22}
                rx={4}
                pointerEvents="all"
              />
              <rect
                className={styles.focusRing}
                x={hitBoxes[vessel.id]?.x ?? hitX}
                y={hitBoxes[vessel.id]?.y ?? vessel.y - 14}
                width={hitBoxes[vessel.id]?.w ?? hitW}
                height={hitBoxes[vessel.id]?.h ?? vessel.h + 22}
                rx={4}
              />
              {hovered && hintMode ? <DropHint vessel={vessel} mode={hintMode} /> : null}
            </g>
          );
        })}

        {/* 器皿名称：固定坐标、独立一层 —— 拖动/回位时字待在原地，不跟着玻璃跑
            （用户 2026-10-23）。状态（空/配方）仍用液面、颜色、粉末层表达，不写第二行小字；
            读屏从器皿的 aria-label 拿到「内含…」。 */}
        <g aria-hidden="true" pointerEvents="none">
          {vessels.map((vessel) => (
            <text
              key={`label-${vessel.id}`}
              data-demo-id={`demo-scene-vessel-label-${vessel.id}`}
              x={vessel.x + vessel.w / 2}
              y={(LABEL_POSITION[vessel.id] ?? { y: 356, contentY: 368 }).y}
              textAnchor="middle"
              className={styles.vesselName}
            >
              {vessel.label}
            </text>
          ))}
        </g>

        {/* 倾倒：瓶子 / 液柱 / 涟漪全部画在这个 SVG 里，坐标就是器皿几何算出来的 */}
        <BenchPour
          pour={pour}
          fromLevel={pourFrom}
          toLevel={pourTo}
          svgRef={svgRef}
          offsets={offsets}
          onLanded={landPour}
        />

        {/* 动作层：洗涤 / 搅拌 / 转移 / 称量等动作统一在这里播（可复用底层） */}
        <ActionLayer
          action={drain ?? action}
          offsets={offsets}
          baseLevelOf={baseLevelOf}
          onCue={onActionCue}
          onDone={() => {
            if (drain) {
              // 倒完了：撤掉补拍、回原位（父组件的 onActionDone 不重复触发）
              setDrain(null);
              sendHome();
              return;
            }
            onActionDone?.();
          }}
        />
      </svg>

      {/* 事故特效层挂载点：绝对定位在舞台内 */}
      <div className={styles.fxSlot}>{children}</div>
    </div>
  );
}
