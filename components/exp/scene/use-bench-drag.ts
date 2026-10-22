"use client";

/**
 * useBenchDrag —— 实验台统一拖拽引擎（可复用底层，exp01 起所有实验共用）。
 *
 * 为什么要有这一层（2026-10-22 用户实测三条硬伤）：
 *   1. 「拖起来不跟手、有滞后」—— 旧实现每次 pointermove 都 setState，整棵 SVG 重渲染；
 *   2. 「拖拽范围有点奇怪」—— 旧实现写死 clamp ±340 单位，拖出这个盒子就被橡皮筋拉住；
 *   3. 「松手之后要能回去」—— 旧实现松手瞬移回原位，看着像操作丢了。
 *
 * 做法（性能硬指标见任务评论）：
 *   - move 里**不 setState**：坐标只写进 ref，真正落 DOM 放到 requestAnimationFrame，一帧最多一次；
 *   - 位移用 transform（translate），不动 x/y 属性，不触发布局；
 *   - pointerdown 即 setPointerCapture，指针移出元素也照收 move（不会「跟一半断掉」）；
 *   - 抓取点守恒：记下按下时元素已有的偏移，之后按「指针位移」叠加，抓住哪就从哪跟；
 *   - 拿起态只切一个 data-lifted 属性，交给 CSS 降级（去掉滤镜/重绘，加廉价投影+轻微放大）；
 *   - 落点判定用 data-drop-kind（vessel / sink / bench），松手才判，不合法由调用方决定是否回弹；
 *   - 回弹用 380ms cubic-bezier(.22,1,.36,1)（柔和，不弹跳）。
 *
 * 调用方只需要给：这个器皿能去哪（bounds）、松手怎么办（onDrop）。
 */

import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

export type BenchPoint = { x: number; y: number };
export type BenchOffset = { dx: number; dy: number };

export type BenchTarget =
  | { kind: "sink" }
  | { kind: "bench" }
  | { kind: "outside" }
  | { kind: "vessel"; id: string };

/** 拖动时器皿包围盒左上角允许落在哪（viewBox 单位）。 */
export type BenchBounds = { minX: number; maxX: number; minY: number; maxY: number };

const SPRING_MS = 380;
const SPRING_EASE = "cubic-bezier(.22, 1, .36, 1)";
/** 判定「这是拖动不是点击」的位移阈值（屏幕像素） */
const DRAG_THRESHOLD = 4;

export const ZERO_OFFSET: BenchOffset = { dx: 0, dy: 0 };

export function offsetTransform(offset: BenchOffset): string {
  return `translate(${round(offset.dx)}px, ${round(offset.dy)}px)`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type UseBenchDragOptions = {
  /** 实验台 SVG：client → viewBox 坐标换算、落点元素查找都以它为根 */
  svgRef: RefObject<SVGSVGElement | null>;
  /** 这个器皿能拖到哪（一般就是台面范围） */
  bounds: (id: string) => BenchBounds;
  /** 落点合法性：返 bad 时元素给红环 */
  validate?: (id: string, target: BenchTarget) => "ok" | "bad";
  /**
   * 松手。返回 `BenchOffset` = 最终停在哪个偏移（调用方自己决定并落库）；
   * 返回空 = 停在拖动前的位置（回弹）。
   */
  onDrop: (id: string, target: BenchTarget, offset: BenchOffset) => BenchOffset | void;
  /** 真的拖动过（用于吞掉紧随其后的补偿 click） */
  onDragged?: () => void;
};

type DragSession = {
  dispose: () => void;
};

export function useBenchDrag({ svgRef, bounds, validate, onDrop, onDragged }: UseBenchDragOptions) {
  const sessionRef = useRef<DragSession | null>(null);

  const begin = useCallback(
    (event: ReactPointerEvent<SVGGElement>, id: string, offset: BenchOffset) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const el = event.currentTarget;
      const svg = svgRef.current;
      if (!svg || !el) return;

      // 上一段拖拽没收干净（极端情况：多指同时按下）→ 先清掉
      sessionRef.current?.dispose();

      const pointerId = event.pointerId;
      const startClient = { x: event.clientX, y: event.clientY };
      const limits = bounds(id);
      const scaleX = svg.getScreenCTM()?.a || 1;
      const scaleY = svg.getScreenCTM()?.d || 1;

      let moved = false;
      let pointer = { x: event.clientX, y: event.clientY };
      let current: BenchOffset = offset;
      let frame = 0;
      let hoverEl: Element | null = null;
      let hoverState: "ok" | "bad" | null = null;
      let alive = true;

      /**
       * 落点目标一次性算好（2026-10-22 性能体检）。
       *
       * 旧实现每个 rAF 都调 document.elementsFromPoint 做一遍命中测试：命中测试要让
       * 浏览器先 flush 样式与布局，等于**拖动的每一帧都在强制同步布局**。
       * 现在按下时把带 data-drop-kind 的元素的屏幕矩形读一次（此时布局是干净的），
       * 之后每帧只做「点在不在矩形里」的整数比较 —— 零布局、零命中测试。
       * 拖动中器皿不会动（只有被拖的那台在动），所以这份快照在整段拖动里都成立。
       */
      const dropTargets: { kind: "vessel" | "sink" | "bench"; id: string; el: Element; rect: DOMRect }[] = [];
      for (const node of document.querySelectorAll<HTMLElement>("[data-drop-kind]")) {
        const kind = node.dataset.dropKind;
        if (kind !== "vessel" && kind !== "sink" && kind !== "bench") continue;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        dropTargets.push({ kind, id: node.dataset.vesselId ?? "", el: node, rect });
      }

      const clampOffset = (next: BenchOffset): BenchOffset => ({
        dx: Math.min(limits.maxX, Math.max(limits.minX, next.dx)),
        dy: Math.min(limits.maxY, Math.max(limits.minY, next.dy)),
      });

      /** 落点：器皿优先，其次洗涤槽，最后台面；都不在 = 台面外。 */
      const targetAt = (clientX: number, clientY: number): { target: BenchTarget; el: Element | null } => {
        const inside = (t: { rect: DOMRect }) =>
          clientX >= t.rect.left && clientX <= t.rect.right && clientY >= t.rect.top && clientY <= t.rect.bottom;
        for (const t of dropTargets) {
          if (t.kind !== "vessel" || t.id === id) continue;
          if (inside(t)) return { target: { kind: "vessel", id: t.id }, el: t.el };
        }
        for (const t of dropTargets) {
          if (t.kind === "sink" && inside(t)) return { target: { kind: "sink" }, el: t.el };
        }
        for (const t of dropTargets) {
          if (t.kind === "bench" && inside(t)) return { target: { kind: "bench" }, el: t.el };
        }
        return { target: { kind: "outside" }, el: null };
      };

      /** hover 只改 DOM 属性，且**只在命中目标真的变了的时候**写。 */
      const paintHover = (el: Element | null, state: "ok" | "bad" | null) => {
        if (el === hoverEl && state === hoverState) return;
        if (hoverEl && hoverEl !== el) delete (hoverEl as HTMLElement).dataset.drop;
        hoverEl = el;
        hoverState = state;
        if (!el) return;
        if (state) (el as HTMLElement).dataset.drop = state;
        else delete (el as HTMLElement).dataset.drop;
      };

      /** 一帧一次：写 transform + 更新落点高亮。 */
      const flush = () => {
        frame = 0;
        if (!alive) return;
        const next = clampOffset({
          dx: offset.dx + (pointer.x - startClient.x) / scaleX,
          dy: offset.dy + (pointer.y - startClient.y) / scaleY,
        });
        current = next;
        el.style.transform = offsetTransform(next);
        const { target, el: hitEl } = targetAt(pointer.x, pointer.y);
        // 落点没换台：判定与高亮都不用重算（每帧都算一遍白白喂给 React 校验函数）
        if (hitEl === hoverEl && hoverState !== null) return;
        const verdict = validate ? validate(id, target) : target.kind === "vessel" ? "bad" : "ok";
        paintHover(hitEl, target.kind === "bench" || target.kind === "outside" ? null : verdict);
      };

      const onMove = (moveEvent: PointerEvent) => {
        if (!alive || moveEvent.pointerId !== pointerId) return;
        pointer = { x: moveEvent.clientX, y: moveEvent.clientY };
        if (!moved) {
          if (Math.hypot(pointer.x - startClient.x, pointer.y - startClient.y) < DRAG_THRESHOLD) return;
          moved = true;
          onDragged?.();
        }
        if (frame) return;
        frame = window.requestAnimationFrame(flush);
      };

      const snapBack = () => {
        el.style.transform = offsetTransform(offset);
        if (prefersReduced() || (current.dx === offset.dx && current.dy === offset.dy)) return;
        el.animate(
          [{ transform: offsetTransform(current) }, { transform: offsetTransform(offset) }],
          { duration: SPRING_MS, easing: SPRING_EASE },
        );
      };

      const finish = (cancelled: boolean) => {
        if (!alive) return;
        alive = false;
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onCancel);
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          /* 合成事件没有真实 capture，忽略 */
        }
        delete el.dataset.lifted;
        delete svg.dataset.drag;
        paintHover(null, null);

        if (!moved) {
          // 没动 = 一次点击，交回给 onClick（选择/执行当前动作）
          el.style.transform = offsetTransform(offset);
          return;
        }
        el.style.transform = offsetTransform(current);
        if (cancelled) {
          snapBack();
          return;
        }
        const { target } = targetAt(pointer.x, pointer.y);
        const settle = onDrop(id, target, current) ?? offset;
        if (settle.dx !== current.dx || settle.dy !== current.dy) {
          const from = current;
          current = settle;
          el.style.transform = offsetTransform(settle);
          if (!prefersReduced()) {
            el.animate(
              [{ transform: offsetTransform(from) }, { transform: offsetTransform(settle) }],
              { duration: SPRING_MS, easing: SPRING_EASE },
            );
          }
        }
      };

      const onUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        finish(false);
      };
      const onCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return;
        finish(true);
      };

      try {
        el.setPointerCapture?.(pointerId);
      } catch {
        /* 合成事件（demo 脚本 / e2e）没有真实指针，捕获失败不影响后续 dispatch */
      }
      el.dataset.lifted = "true";
      svg.dataset.drag = id;
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onCancel);

      sessionRef.current = {
        dispose: () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onCancel);
          if (frame) window.cancelAnimationFrame(frame);
          alive = false;
          delete el.dataset.lifted;
          delete svg.dataset.drag;
          paintHover(null, null);
        },
      };
    },
    [bounds, onDrop, onDragged, svgRef, validate],
  );

  return { begin };
}
