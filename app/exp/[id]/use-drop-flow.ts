"use client";

/**
 * use-drop-flow —— 拖拽三段式的时序层（用户点名要的那条链路）。
 *
 * 段 1 拖动中：跟手 + 目标热区高亮（draggingId / overFlask 交给 scene-stage 渲染）。
 * 段 2 松手吸附：整块台面 160ms scale(1.03→1) 弹回 + 瓶身倾转 + 一声轻水声。
 * 段 3a 成功：倒入动画（pour.tsx，700ms）**播完才回调 onAccept**，工作台随后才 dispatch；
 *        所以 stepIndex 前进时画面已经演完，不会再"拖进去直接下一步"。
 * 段 3b 失败：试剂瓶从落点回弹原处 240ms + 目标抖动 + `fail-reject`，回调 onReject 给一句为什么；
 *        不重置本步，学生可原地再投一次（reject 不占用 busy）。
 *
 * `prefers-reduced-motion` 下所有动画跳过（0ms），但 accept / reject 分支和文案仍完整走一遍。
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { playSound } from "@/lib/audio/engine";
import {
  POUR_MS,
  REJECT_MS,
  SNAP_MS,
  type DropVerdict,
} from "@/components/exp/guide/drop-resolve";
import { type PourState } from "@/components/exp/scene/pour";
import { getSceneReagent } from "@/lib/scene/reagents";

export type DropMode = "drag" | "click" | "event";
export type DropPoint = { x: number; y: number };
export type DropAccept = Extract<DropVerdict, { kind: "accept" }>;
export type DropReject = Extract<DropVerdict, { kind: "reject" }>;

const BOTTLE_SELECTOR = (id: string) => `[data-demo-id="demo-scene-reagent-${id}"]`;
const TARGET_SELECTOR = '[data-demo-id="demo-scene-drop-flask"]';
const SNAP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function centerOf(rect: DOMRect): DropPoint {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

interface DropFlowOptions {
  stageRef: RefObject<HTMLDivElement | null>;
  /** 同步判定：这瓶试剂投进锥形瓶算不算这一步的正确动作。 */
  resolve: (reagentId: string) => DropVerdict;
  /** 倒入开始（底部结果条给一句说明 + 投放审计）。 */
  onPour: (reagentId: string, verdict: DropAccept, mode: DropMode) => void;
  /** 倒入动画播完 → 工作台再 dispatch。 */
  onAccept: (verdict: DropAccept, mode: DropMode) => void;
  /** 拒收：一句为什么，本步不动。 */
  onReject: (verdict: DropReject, reagentId: string, mode: DropMode, point?: DropPoint) => void;
}

export function useDropFlow({ stageRef, resolve, onPour, onAccept, onReject }: DropFlowOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overFlask, setOverFlask] = useState(false);
  const [pour, setPour] = useState<PourState | null>(null);
  const timerRef = useRef<number | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const busyRef = useRef(false);
  const handlers = useRef({ resolve, onPour, onAccept, onReject });
  // refs 只在 effect 里写（渲染期读写 ref 会被 react-hooks 判为 error）。
  useEffect(() => {
    handlers.current = { resolve, onPour, onAccept, onReject };
  }, [resolve, onPour, onAccept, onReject]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      animsRef.current.forEach((anim) => anim.cancel());
      animsRef.current = [];
    },
    [],
  );

  const animate = useCallback(
    (element: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      if (!(element instanceof Element)) return;
      animsRef.current.push(element.animate(frames, options));
    },
    [],
  );

  const attempt = useCallback(
    (reagentId: string, mode: DropMode, point?: DropPoint) => {
      setDraggingId(null);
      setOverFlask(false);
      const stage = stageRef.current;
      if (!stage || busyRef.current) return;

      const verdict = handlers.current.resolve(reagentId);
      const reduced = prefersReduced();
      const bottle = stage.querySelector(BOTTLE_SELECTOR(reagentId));
      const target = stage.querySelector(TARGET_SELECTOR);
      const stageRect = stage.getBoundingClientRect();
      const bottleRect = bottle?.getBoundingClientRect();
      const targetRect = target?.getBoundingClientRect();
      const landing = bottleRect && targetRect ? centerOf(targetRect) : undefined;

      /**
       * 倒向哪个器皿（2026-10-22 用户报"瓶子飞到中间去了"）：
       * TARGET_SELECTOR 是覆盖整个台面的大热区，中心常常不在任何器皿上。
       * 松手点落在哪个器皿就从哪个器皿进去；落在空白才回退到热区中心。
       *
       * 注意用 elementsFromPoint 逐层穿透：大热区按钮盖在 SVG 之上，
       * 单用 elementFromPoint 只会拿到那层按钮，永远找不到器皿。
       */
      const dropVessel =
        point && typeof document !== "undefined"
          ? (document
              .elementsFromPoint(point.x, point.y)
              .map((el) => el.closest<HTMLElement>('[data-demo-id^="demo-scene-vessel"]'))
              .find((el): el is HTMLElement => Boolean(el)) ?? null)
          : null;
      const vesselRect = dropVessel?.getBoundingClientRect() ?? null;
      const pourTargetRect = vesselRect ?? targetRect;

      if (verdict.kind === "accept") {
        busyRef.current = true;
        // 2026-10-22：不再让源按钮原地倾斜 —— 改由 PourFX 里一个"飞过去的瓶子"完成
        // 举瓶→倾斜→倒→飞回，源按钮只留一个轻微的被拿起反馈。
        if (!reduced) {
          const wrap = stage.querySelector('[class*="apparatusWrap"]');
          animate(
            wrap,
            [
              /* 1.06 → 1.03：同一口径（用户 2026-10-23「拖拽时放大偏大」）。
                 注意这层缩放目前被 apparatusWrap 的 transform:none !important 压住，
                 真正在画面上放大的是 .vesselLift 的 1.03 —— 两边保持一致，将来解开也不会突然变大。 */
              { transform: "scale(1.03)" },
              { transform: "scale(0.995)", offset: 0.6 },
              { transform: "scale(1)" },
            ],
            { duration: SNAP_MS, easing: SNAP_EASING },
          );
        }
        if (bottleRect && pourTargetRect) {
          setPour({
            key: Date.now(),
            color: getSceneReagent(reagentId)?.colorHex ?? "#DCE9F2",
            mode: mode === "event" ? "event" : mode,
            // 倒进哪台 + 从哪松手：台面场景的 SVG 倾倒动画按这两个算瓶口与液柱
            vesselId: dropVessel?.dataset.vesselId ?? null,
            release: point ?? centerOf(bottleRect),
            from: {
              x: bottleRect.left + bottleRect.width / 2 - stageRect.left,
              y: bottleRect.top + 8 - stageRect.top,
            },
            // 落点 = 真实器皿的液面高度（器皿顶部往下 45%），不是大热区中心
            to: {
              x: pourTargetRect.left + pourTargetRect.width / 2 - stageRect.left,
              y: pourTargetRect.top + pourTargetRect.height * 0.45 - stageRect.top,
            },
          });
        }
        playSound("drop", { delayMs: reduced ? 0 : SNAP_MS + 100 });
        handlers.current.onPour(reagentId, verdict, mode);
        timerRef.current = window.setTimeout(
          () => {
            timerRef.current = null;
            busyRef.current = false;
            setPour(null);
            /* 第五轮：把「接下一拍动作」挪到下一个任务里。
               原来倾倒层卸载 + 动作层挂载 + 步骤推进全在一次提交里，开发构建实测 55~70ms，
               正好压在动画第一帧上；拆成两个提交后各自 <30ms，中间只差一帧（肉眼无感）。 */
            window.setTimeout(() => handlers.current.onAccept(verdict, mode), 0);
          },
          reduced ? 0 : POUR_MS,
        );
        return;
      }

      // 失败：回弹 + 抖动 + 一句为什么，本步不动、允许原地重试。
      playSound("fail-reject");
      handlers.current.onReject(verdict, reagentId, mode, point ?? landing);
      if (reduced) return;

      const start = point && bottleRect ? point : landing;
      const dx = start && bottleRect ? start.x - centerOf(bottleRect).x : 0;
      const dy = start && bottleRect ? start.y - centerOf(bottleRect).y : 22;
      animate(
        bottle,
        [
          { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.98)`, opacity: 1 },
          { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        ],
        { duration: REJECT_MS, easing: SNAP_EASING },
      );
      // 热区自身有 translateX(-50%)，抖动帧里保留它，避免位置跳。
      animate(
        target,
        [
          { transform: "translateX(-50%) translateX(0)" },
          { transform: "translateX(-50%) translateX(-5px)", offset: 0.18 },
          { transform: "translateX(-50%) translateX(5px)", offset: 0.42 },
          { transform: "translateX(-50%) translateX(-3px)", offset: 0.68 },
          { transform: "translateX(-50%) translateX(0)" },
        ],
        { duration: REJECT_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
    },
    [animate, stageRef],
  );

  /**
   * 已经有外部判定（工作台按「本步建议动作」判过）时，只播倒液动画，播完再回调。
   *
   * 为什么需要这条：台面场景的投放判定在 workbench（onUseReagent 里看 suggested.type），
   * 而 resolveDrop 只认"文案里点名了这瓶试剂"的步骤 —— exp01 的「洗瓶给烧杯加水溶解」
   * 文案里没有"蒸馏水"三个字，走 resolveDrop 会被误判成加错试剂。
   * 所以判定仍归 workbench，这里只负责把"瓶子飞过去→倾斜→液柱落下→液面上升"演完，
   * 演完再让步骤推进（用户口径：动作结束才出结果）。
   */
  const pourThen = useCallback(
    (reagentId: string, vesselId: string, point: DropPoint | undefined, done: () => void) => {
      const stage = stageRef.current;
      const bottle = stage?.querySelector(BOTTLE_SELECTOR(reagentId));
      const bottleRect = bottle?.getBoundingClientRect();
      const stageRect = stage?.getBoundingClientRect();
      if (!stage || !stageRect || prefersReduced()) {
        done();
        return;
      }
      // 上一次动画还没收尾就再来一次：直接把上一次收掉，不让两队动画叠在一起
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      busyRef.current = true;
      setDraggingId(null);
      setOverFlask(false);
      setPour({
        key: Date.now(),
        color: getSceneReagent(reagentId)?.colorHex ?? "#DCE9F2",
        mode: "drag",
        vesselId,
        release: point ?? (bottleRect ? centerOf(bottleRect) : undefined),
        from: {
          x: (bottleRect?.left ?? stageRect.left) + (bottleRect?.width ?? 0) / 2 - stageRect.left,
          y: (bottleRect?.top ?? stageRect.top) + 8 - stageRect.top,
        },
        to: {
          x: stageRect.width / 2,
          y: stageRect.height / 2,
        },
      });
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        busyRef.current = false;
        setPour(null);
        done();
      }, POUR_MS - 60);
    },
    [stageRef],
  );

  return {
    draggingId,
    overFlask,
    pour,
    pourThen,
    beginDrag: (id: string) => {
      setDraggingId(id);
      setOverFlask(false);
    },
    endDrag: () => {
      setDraggingId(null);
      setOverFlask(false);
    },
    setOverFlask,
    clearPour: () => setPour(null),
    /** 松手投放（拖拽）。 */
    drop: (id: string, point?: DropPoint) => attempt(id, "drag", point),
    /** 点选后点目标器皿（点选模式）。 */
    tapTarget: (id: string) => {
      const stage = stageRef.current;
      const target = stage?.querySelector(TARGET_SELECTOR);
      const rect = target?.getBoundingClientRect();
      attempt(id, "click", rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined);
    },
    /** URL 事件 / 演示脚本一次性投放。 */
    fireEvent: (id: string) => attempt(id, "event"),
  };
}
