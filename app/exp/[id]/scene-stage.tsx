"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { getSceneReagent } from "@/lib/scene/reagents";
import { DEFAULT_RACK_IDS, rackIdsFor } from "./rack-ids";
import { BenchScene, type SceneFeedback } from "@/components/exp/scene/bench-scene";
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
  forceBench,
  benchInstrument,
  computeMode,
  observations,
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
  onQuickAction?: () => void;
  /** 强制走台面场景（exp09 前两步是配溶液，不该显示滴定台）。 */
  forceBench?: boolean;
  /** 台面场景摆哪台仪器：balance / ph / none（不传按 expId 走默认）。 */
  benchInstrument?: "balance" | "ph" | "none";
  /** 数据处理步（exp09 第 7 步）：场景换成数据台，不再显示滴定管/锥形瓶。 */
  computeMode?: boolean;
  /** 本步已完成的观察文本，数据台据此点亮读数表 / 极差 / 浓度比。 */
  observations?: readonly string[];
  children?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
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
   * 跟手的拖动影子（用户 2026-10-22 报"瓶子拖不动"）：
   * 之前只给源按钮加 scale(.98)，鼠标移 150px 瓶子只动 2px —— 视觉上等于没拖起来。
   * 现在拖出阈值后渲染一个 fixed 定位的瓶子副本跟着指针走，源按钮留在架上变淡。
   */
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; reagentId: string } | null>(null);

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

  /** 落位：先记下落点器皿（反馈只给它），再交给 flow 播倾倒。 */
  const dropAt = (id: string, point: { x: number; y: number }) => {
    const hit = vesselAt(point);
    if (hit) setTargetVesselId(hit);
    flow.drop(id, point);
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
        // 点空白取消选中；按钮自己的 click 不在这里处理
        if ((event.target as Element).closest("button")) return;
        setSelectedId(null);
        flow.endDrag();
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
                  // 段 2 移动：超过阈值才算出拖，实时高亮落区（锥形瓶）+ 影子跟手。
                  const drag = pointerDragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  if (!drag.moved) {
                    if (Math.abs(event.movementX) + Math.abs(event.movementY) < 3) return;
                    drag.moved = true;
                  }
                  setDragGhost({ x: event.clientX, y: event.clientY, reagentId: drag.id });
                  const hit = document.elementFromPoint(event.clientX, event.clientY);
                  flow.setOverFlask(Boolean(hit?.closest('[data-demo-id="demo-scene-drop-flask"]')));
                }}
                onPointerUp={(event) => {
                  // 段 3 落位：用松手坐标提交，吸附/倾倒/回弹都由 useDropFlow 播。
                  const drag = pointerDragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  pointerDragRef.current = null;
                  setDragGhost(null);
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                  flow.setOverFlask(false);
                  if (!drag.moved) {
                    flow.endDrag();
                    return;
                  }
                  dropAt(drag.id, { x: event.clientX, y: event.clientY });
                }}
                onPointerCancel={() => {
                  pointerDragRef.current = null;
                  setDragGhost(null);
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
                <span className={styles.reagentBottle} aria-hidden="true">
                  <span
                    className={styles.reagentFill}
                    style={{ background: reagent.colorHex }}
                  />
                </span>
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
                selectedReagentId={null}
                draggingReagentId={null}
                feedback={isBenchScene ? vesselFeedback : null}
                onFeedbackEnd={() => undefined}
                onDropReagent={() => undefined}
                onActivateVessel={(id) => {
                  // 点场景里的实体 = 执行当前建议动作。
                  // 原来只有 balance 走 onQuickAction，点烧杯/容量瓶只记 targetVesselId、什么都不发生，
                  // 用户 2026-10-22 实测"检查就是检查不了"——点了没反应等于不能操作。
                  setTargetVesselId(id);
                  onQuickAction?.();
                }}
                onClearSelection={() => undefined}
                onReveal={() => undefined}
              />
            </div>
          ) : computeMode ? (
            <div className={styles.apparatus} data-demo-id="demo-compute-wrap">
              <ComputeBench observations={observations ?? []} />
            </div>
          ) : (
            <LabApparatus className={styles.apparatus} />
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
            onClick={() => {
              if (selectedId) flow.tapTarget(selectedId);
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

      <PourFX pour={flow.pour} onDone={flow.clearPour} />

      {/* 跟手的拖动影子：只在拖出阈值后出现，fixed 定位跟着指针，不抢事件 */}
      {dragGhost ? (
        <div
          className={styles.dragGhost}
          style={{ left: dragGhost.x, top: dragGhost.y }}
          aria-hidden="true"
          data-demo-id="demo-drag-ghost"
        >
          <span className={styles.dragGhostBottle}>
            <span
              className={styles.dragGhostFill}
              style={{ background: getSceneReagent(dragGhost.reagentId)?.colorHex ?? "#DCE9F2" }}
            />
          </span>
          <span className={styles.dragGhostName}>
            {getSceneReagent(dragGhost.reagentId)?.name ?? ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
