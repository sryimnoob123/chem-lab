"use client";

/**
 * 动作层（可复用底层的入口）
 *
 * 一次操作 = 一条 `SceneAction`。动作由底层统一播，实验定义只说"这一步做什么"，
 * 不写场景/动画代码（用户 2026-10-22：「实验定义里只写 action，动画由底层统一播」）。
 *
 * 播放规则：
 *   - 默认播完才 onDone（工作台此时才 dispatch、才出分数条）；
 *   - 点「跳过」或 prefers-reduced-motion → 立刻 onDone（判定与文案照常）；
 *   - 播放期间父组件用 busy 挡住重复触发。
 */

import { useEffect, useId, useMemo, useRef } from "react";
import { anchorOf, type VesselOffset } from "./geometry";
import { playBeats, prefersReducedMotion } from "./timeline";
import { buildRinse } from "./rinse";
import { buildDrops, buildStir } from "./stir";
import { buildTransfer } from "./transfer";
import { buildHeat, buildObserve, buildRead, buildWeigh } from "./instrument";

export type SceneAction =
  | { kind: "rinse"; vesselId: string; tool?: string | null }
  | { kind: "dilute"; vesselId: string }
  | { kind: "stir"; vesselId: string }
  | { kind: "transfer"; from: string; to: string }
  | { kind: "drops"; vesselId: string }
  | { kind: "weigh"; mass?: number }
  | { kind: "read"; value?: number }
  | { kind: "observe"; vesselId: string }
  | { kind: "heat"; vesselId: string };

export type SceneActionApi = {
  play: (action: SceneAction) => Promise<boolean>;
  skip: () => void;
  busy: boolean;
};

type Props = {
  action: SceneAction | null;
  /** 器皿当前位置（拖动偏移），动作要落在器皿现在的位置上 */
  offsets: Readonly<Record<string, VesselOffset>>;
  onDone: () => void;
};

/** 读数滚动：动作期间把天平示数从 0 滚到目标值。 */
function countUp(el: Element | null, to: number, decimals: number, ms: number): () => void {
  if (!el) return () => undefined;
  const target = el as SVGTextElement;
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    target.textContent = `${(to * eased).toFixed(decimals)} g`;
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function ActionLayer({ action, offsets, onDone }: Props) {
  const uid = useId().replace(/:/g, "");
  const groupRef = useRef<SVGGElement | null>(null);

  /** 一条动作 = 一份渲染 + 一组 beat；动作变了就重建。 */
  const scene = useMemo(() => {
    if (!action) return null;
    switch (action.kind) {
      case "rinse": {
        const a = anchorOf(action.vesselId, offsets[action.vesselId]);
        return a ? buildRinse(a, { variant: "wash", clipId: `act-${uid}-a` }) : null;
      }
      case "dilute": {
        const a = anchorOf(action.vesselId, offsets[action.vesselId]);
        return a ? buildRinse(a, { variant: "dilute", clipId: `act-${uid}-a` }) : null;
      }
      case "stir": {
        const a = anchorOf(action.vesselId, offsets[action.vesselId]);
        return a ? buildStir(a, { clipId: `act-${uid}-a` }) : null;
      }
      case "drops": {
        const a = anchorOf(action.vesselId, offsets[action.vesselId]);
        return a ? buildDrops(a, { clipId: `act-${uid}-a` }) : null;
      }
      case "transfer": {
        const from = anchorOf(action.from, offsets[action.from]);
        const to = anchorOf(action.to, offsets[action.to]);
        return from && to ? buildTransfer(from, to, { clipFrom: `act-${uid}-f`, clipTo: `act-${uid}-t` }) : null;
      }
      case "weigh":
        return buildWeigh(action.mass ?? 1.0599);
      case "read":
        return buildRead(action.value ?? 0);
      case "observe": {
        const a = anchorOf(action.vesselId, offsets[action.vesselId]);
        return a ? buildObserve(a) : null;
      }
      case "heat": {
        const a = anchorOf(action.vesselId, offsets[action.vesselId]);
        return a ? buildHeat(a, { clipId: `act-${uid}-a` }) : null;
      }
      default:
        return null;
    }
  }, [action, offsets, uid]);

  useEffect(() => {
    if (!scene) {
      onDone();
      return;
    }
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    const root = groupRef.current?.ownerSVGElement ?? groupRef.current;
    const ms = playBeats(root, scene.beats);
    let stopCount: () => void = () => undefined;
    if (scene.readout) {
      stopCount = countUp(
        root?.querySelector("[data-balance-readout]") ?? null,
        scene.readout.to,
        scene.readout.decimals,
        Math.max(500, ms - 120),
      );
    }
    const timer = window.setTimeout(onDone, Math.max(ms, scene.ms));
    return () => {
      window.clearTimeout(timer);
      stopCount();
    };
    // scene 变了才重播一次
  }, [scene, onDone]);

  if (!scene) return null;
  return <g ref={groupRef} data-action-layer className="ix-action-layer">{scene.node}</g>;
}
