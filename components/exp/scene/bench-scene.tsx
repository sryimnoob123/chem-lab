"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { DROPPABLE_KINDS, SCENE_VESSELS } from "@/lib/scene/palette";
import { describeContents } from "@/lib/scene/reagents";
import type { SceneFx, SceneOutcome } from "@/lib/scene/types";
import { DropHint } from "./drop-hint";
import styles from "./scene.module.css";
import { VesselArt } from "./vessel-art";
import { ToolTray } from "./tool-tray";
import { Sink } from "./sink";
import { ActionLayer, type SceneAction } from "./actions/action-layer";
import type { SceneToolId } from "@/lib/scene/tools";
import { BENCH } from "./bench-layout";
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

const noop = () => undefined;

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
  layoutKey,
  children,
}: BenchSceneProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
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

  /**
   * 器皿归位（用户 2026-10-22："松手之后还是要让它能回去，不然很容易出问题"）。
   * 步骤推进 / 重置 / 拖错 → 用 380ms 缓动滑回基准位置，不是瞬移。
   */
  useEffect(() => {
    if (layoutKey === undefined) return;
    const current = offsetsRef.current;
    if (!Object.keys(current).length) return;
    resettingRef.current = true;
    for (const [id, offset] of Object.entries(current)) {
      if (!offset.dx && !offset.dy) continue;
      const node = vesselRefs.current[id];
      if (!node) continue;
      const anim = node.animate(
        [
          { transform: `translate(${offset.dx}px, ${offset.dy}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        { duration: 400, easing: "cubic-bezier(.23, 1, .32, .1)" },
      );
      // 动画结束后把 inline transform 落成 0：否则后续任何一次 offsets 同步都会把它写回原位
      anim.onfinish = () => {
        node.style.transform = "translate(0px, 0px)";
      };
    }
    setOffsets({});
    const timer = window.setTimeout(() => {
      resettingRef.current = false;
    }, 460);
    return () => window.clearTimeout(timer);
  }, [layoutKey]);
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
   * 松手：落到洗涤槽＝洗（洗完归位）；落在台面上＝换位置，位置留在那；
   * 落在别的器皿上或台面外＝回弹 + 一句话（不静默）。
   */
  const handleVesselDrop = useCallback(
    (id: string, target: BenchTarget, offset: BenchOffset): BenchOffset | void => {
      dragEndedAtRef.current = Date.now();
      if (target.kind === "sink") {
        onDropToSink?.(id);
        /**
         * 放在槽里洗，别立刻弹回原地（用户 2026-10-22：动作要在落点上发生）。
         * 位置留在槽里 → 冲洗/刷洗/倒水整段动画都在槽口播放；
         * 这一步做完 stepIndex 变 → layoutKey 变化把器皿滑回基准位（400ms 缓动）。
         */
        setOffsets((prev) => ({ ...prev, [id]: offset }));
        return offset;
      }
      if (target.kind === "bench") {
        setOffsets((prev) => ({ ...prev, [id]: offset }));
        return offset;
      }
      onDropToNowhere?.(id);
      return undefined;
    },
    [onDropToNowhere, onDropToSink],
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
  const benchViewBox = `370 ${contentTop - 12} 780 ${434 - contentTop + 126}`;

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
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#39485A" stopOpacity="0.035" />
          </linearGradient>
        </defs>
        {/* 台面（铁架台已删除：exp01/exp03 都不用滴定台，空夹子会被当成"这是什么"） */}
        <g aria-hidden="true">
          {/*
            整块舞台就是台面（略微俯视）：暖白台面 + 极淡台账网格 + 前沿一条厚度。
            之前那条「墙与台面的接缝」画在器皿高度中间，横线从玻璃里穿过去，像贴了条胶带 ——
            去掉。纵深靠「前沿 + 上浅下深的台面渐变」表达。
          */}
          <rect x="370" y={contentTop - 12} width="780" height={560 - contentTop} fill="var(--bench-top)" />
          <rect
            x="370"
            y={contentTop - 12}
            width="780"
            height={560 - contentTop}
            fill="url(#benchDepth)"
          />
          {/* 极淡网格：26 单位一格，只当纸感，不当装饰 */}
          <rect
            x="370"
            y={contentTop - 12}
            width="780"
            height={560 - contentTop}
            fill="url(#benchGrid)"
            opacity="0.45"
          />
          {/* 前沿（台面厚度） */}
          <rect x="370" y="532" width="780" height="28" fill="var(--bench-edge)" />
          <line x1="370" y1="532" x2="1150" y2="532" stroke="var(--bench-line)" strokeWidth="1" opacity="0.8" />
          <rect x="370" y="524" width="780" height="8" fill="url(#benchSeam)" />
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
          transform="translate(792 214)"
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
          <rect x="0" y="108" width="132" height="18" rx="3" fill="#4A5768" opacity="0.85" />
          <rect x="56" y="44" width="20" height="64" fill="#4A5768" opacity="0.7" />
          {/* 玻璃防风罩 + 称量盘（静态外形） */}
          <rect x="18" y="2" width="96" height="44" rx="2" fill="#fff" fillOpacity="0.5" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
          <line x1="66" y1="2" x2="66" y2="12" stroke="#16202C" strokeOpacity="0.45" strokeWidth="1" />
          <ellipse
            data-balance-pan
            cx="66"
            cy="34"
            rx="30"
            ry="6"
            fill="#DCE9F2"
            fillOpacity="0.7"
            stroke="#16202C"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          {/* 显示屏 */}
          <rect x="20" y="56" width="92" height="26" rx="2" fill="#16202C" opacity="0.85" />
          <text
            data-balance-readout
            x="66"
            y="74"
            textAnchor="middle"
            fill="#8FE3CF"
            fontSize="19"
            fontFamily="ui-monospace, monospace"
          >
            0.0000 g
          </text>
          <text x="66" y="100" textAnchor="middle" fill="#4A5768" fontSize="14">
            分析天平 · 0.1 mg
          </text>
        </g>
        ) : null}

        {/* pH 计（exp03 醋酸电离常数）：主机 + 电极杆，画法沿用天平（底座/屏/标签） */}
        {instrument === "ph" ? (
        <g data-demo-id="demo-scene-instrument-ph" aria-hidden="true" transform="translate(792 196)">
          {/* 电极杆 + 球泡 */}
          <line x1="34" y1="70" x2="34" y2="4" stroke="#4A5768" strokeOpacity="0.75" strokeWidth="2.5" />
          <circle cx="34" cy="4" r="4.5" fill="#81D4FA" fillOpacity="0.85" stroke="#16202C" strokeOpacity="0.6" strokeWidth="1" />
          {/* 主机 */}
          <rect x="8" y="70" width="124" height="70" rx="4" fill="#fff" fillOpacity="0.9" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
          <rect x="18" y="80" width="104" height="30" rx="2" fill="#16202C" opacity="0.85" />
          <text x="70" y="101" textAnchor="middle" fill="#8FE3CF" fontSize="20" fontFamily="ui-monospace, monospace">
            7.00
          </text>
          <text x="70" y="128" textAnchor="middle" fill="#4A5768" fontSize="14">
            pH 计 · 0.01
          </text>
        </g>
        ) : null}

        {/* 工具托盘 + 洗涤槽：动作要在场景里做，不能靠点卡片一步过（用户 2026-10-22） */}
        {toolIds && toolIds.length > 0 && onSelectTool ? (
          <ToolTray
            area={{ x: 578, y: 424, w: 560, h: 112 }}
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
          const ringX = vessel.x - 10;
          const ringY = vessel.y - 22;
          const ringW = vessel.kind === "burette" ? 100 : vessel.w + 20;
          const ringH = vessel.h + 34;
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
                fb === "success" ? "ix-snap" : fb === "reject" ? "ix-shake" : ""
              }`}
              role="button"
              tabIndex={0}
              data-pressed={pressedId === vessel.id ? "true" : "false"}
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
                setPressedId(vessel.id);
                drag.begin(event, vessel.id, offsets[vessel.id] ?? ZERO_OFFSET);
              }}
              aria-label={
                droppable
                  ? `${vessel.label}，内含${describeContents(contents[vessel.id] ?? [])}，可接收试剂`
                  : `${vessel.label}，只装标准溶液，不接受投加试剂；拖入会给出规范提示`
              }
              onPointerLeave={() => setPressedId(null)}
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
                  />
                </g>
              </g>
              {/* 名称/内容跟着器皿走：拖到哪，标签跟到哪（原来标签是固定坐标，器皿一动就对不上） */}
              <g aria-hidden="true" pointerEvents="none">
                <text
                  x={vessel.x + vessel.w / 2}
                  y={(LABEL_POSITION[vessel.id] ?? { y: 356, contentY: 368 }).y}
                  textAnchor="middle"
                  className={styles.vesselName}
                >
                  {vessel.label}
                </text>
                <text
                  x={vessel.x + vessel.w / 2}
                  y={(LABEL_POSITION[vessel.id] ?? { y: 356, contentY: 368 }).contentY}
                  textAnchor="middle"
                  className={styles.vesselContents}
                >
                  {describeContents(contents[vessel.id] ?? [])}
                </text>
              </g>
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

        {/* 动作层：洗涤 / 搅拌 / 转移 / 称量等动作统一在这里播（可复用底层） */}
        <ActionLayer action={action} offsets={offsets} onDone={onActionDone ?? noop} />
      </svg>

      {/* 事故特效层挂载点：绝对定位在舞台内 */}
      <div className={styles.fxSlot}>{children}</div>
    </div>
  );
}
