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
import type { SceneCue } from "./rinse";
import { buildRinse } from "./rinse";
import { buildDrops, buildStir } from "./stir";
import { buildTransfer } from "./transfer";
import { buildHeat, buildObserve, buildRead, buildWeigh } from "./instrument";
import { buildIncident, type IncidentOp } from "./incident";
import { buildDrain } from "./drain";
import type { IncidentFx } from "./incident-art";
import type { IncidentPlan } from "./incident-plan";

export type SceneAction =
  | { kind: "rinse"; vesselId: string; tool?: string | null }
  | { kind: "dilute"; vesselId: string }
  /** 排液：把器皿里的水倒掉/吸走（rinse 之后自动接一拍，水不许凭空消失） */
  | { kind: "drain"; vesselId: string }
  | { kind: "stir"; vesselId: string }
  | { kind: "transfer"; from: string; to: string }
  | { kind: "drops"; vesselId: string }
  | { kind: "weigh"; mass?: number }
  | { kind: "read"; value?: number }
  | { kind: "observe"; vesselId: string }
  | { kind: "heat"; vesselId: string }
  /** 事故：起手错操作 → 中途炸 → 余波归位（与上面几条同一套器皿/液体/token） */
  | { kind: "incident"; vesselId: string; fx: IncidentFx; op: IncidentOp; from?: string | null };

export type SceneActionApi = {
  play: (action: SceneAction) => Promise<boolean>;
  /**
   * 事故演出的唯一入口。
   * 真操作与错误演示都调它；要不要改实验状态由调用方在 Promise 之后做（演示不 commit）。
   */
  playIncident: (plan: IncidentPlan) => Promise<boolean>;
  skip: () => void;
  busy: boolean;
};

type Props = {
  action: SceneAction | null;
  /** 器皿当前位置（拖动偏移），动作要落在器皿现在的位置上 */
  offsets: Readonly<Record<string, VesselOffset>>;
  /** 版面整体左移了多少（右栏安全边收边时器皿会一起左移，动作要跟着走） */
  layoutDx?: number;
  /** 器皿原本的液位（0 空 / 0.38 有液）：事故结束回到这里，卸下层时液面不跳 */
  baseLevelOf?: (vesselId: string) => number;
  /**
   * 器皿**当前**液位（0~1，含此前倒过几次）。
   * 第 4 轮补：动作层的液体原来一律从 0 / 0.5 / 0.55 起画，跟台面上真实的液位对不上 ——
   * 定容时滴加的水面浮在半瓶高、洗涤结束液面和状态差一格。现在由台面把真实液位传进来。
   */
  levelOf?: (vesselId: string) => number;
  /** 时间线中途回调（事故在中间那一帧触发：播一声闷响 / 让台面轻震） */
  onCue?: (kind: SceneCue["kind"]) => void;
  onDone: () => void;
};

/** 读数滚动：动作期间把天平示数从 0 滚到目标值。 */
function countUp(el: Element | null, to: number, decimals: number, ms: number): () => void {
  if (!el) return () => undefined;
  const target = el as SVGTextElement;
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    // 第 4 轮修：首帧 rAF 的 now 可能早于 start（chromium 上实测 −0.2605 g 闪一下），夹到 0
    const t = Math.min(1, Math.max(0, (now - start) / ms));
    const eased = 1 - Math.pow(1 - t, 3);
    target.textContent = `${(to * eased).toFixed(decimals)} g`;
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** 事故「炸」的那一下：整块台面轻震（只动 transform，不碰 React 状态，260ms 内结束）。 */
function impactShake(el: Element | null): void {
  if (!el) return;
  el.animate(
    [
      { transform: "translate(0px, 0px)" },
      { transform: "translate(-3px, 1.5px)", offset: 0.18 },
      { transform: "translate(2.5px, -1.5px)", offset: 0.38 },
      { transform: "translate(-2px, 1px)", offset: 0.58 },
      { transform: "translate(1.5px, -0.5px)", offset: 0.78 },
      { transform: "translate(0px, 0px)" },
    ],
    { duration: 280, easing: "ease-out" },
  );
}

export function ActionLayer({ action, offsets, layoutDx = 0, baseLevelOf, levelOf, onCue, onDone }: Props) {
  const uid = useId().replace(/:/g, "");
  const groupRef = useRef<SVGGElement | null>(null);
  /** 回调放 ref：父组件每次渲染都换引用，直接进 deps 会让动画重播 */
  const cueRef = useRef(onCue);
  useEffect(() => {
    cueRef.current = onCue;
  }, [onCue]);

  /** 一条动作 = 一份渲染 + 一组 beat；动作变了就重建。 */
  const scene = useMemo(() => {
    if (!action) return null;
    /** 所有动作的锚点都从这里取：拖动偏移 + 版面整体位移（右栏收边时器皿左移了多少） */
    const an = (id: string) => anchorOf(id, offsets[id], layoutDx);
    /** 动作里液体的起点 = 台面当前液位（没有就退回 0） */
    const levelAt = (id: string) => Math.max(0, Math.min(1, levelOf?.(id) ?? 0));
    switch (action.kind) {
      case "rinse": {
        const a = an(action.vesselId);
        return a ? buildRinse(a, { variant: "wash", clipId: `act-${uid}-a`, levelStart: levelAt(action.vesselId) }) : null;
      }
      case "dilute": {
        const a = an(action.vesselId);
        return a ? buildRinse(a, { variant: "dilute", clipId: `act-${uid}-a`, levelStart: levelAt(action.vesselId) }) : null;
      }
      case "drain": {
        const a = an(action.vesselId);
        return a ? buildDrain(a, { clipId: `act-${uid}-d` }) : null;
      }
      case "stir": {
        const a = an(action.vesselId);
        return a ? buildStir(a, { clipId: `act-${uid}-a`, levelStart: levelAt(action.vesselId) }) : null;
      }
      case "drops": {
        const a = an(action.vesselId);
        return a ? buildDrops(a, { clipId: `act-${uid}-a`, levelStart: levelAt(action.vesselId) }) : null;
      }
      case "transfer": {
        const from = an(action.from);
        const to = an(action.to);
        return from && to ? buildTransfer(from, to, { clipFrom: `act-${uid}-f`, clipTo: `act-${uid}-t` }) : null;
      }
      case "weigh":
        return buildWeigh(action.mass ?? 1.0599);
      case "read":
        return buildRead(action.value ?? 0);
      case "observe": {
        const a = an(action.vesselId);
        return a ? buildObserve(a) : null;
      }
      case "heat": {
        const a = an(action.vesselId);
        return a ? buildHeat(a, { clipId: `act-${uid}-a` }) : null;
      }
      case "incident": {
        const a = an(action.vesselId);
        if (!a) return null;
        return buildIncident(a, {
          fx: action.fx,
          op: action.op,
          clipId: `act-${uid}-i`,
          baseLevel: baseLevelOf?.(action.vesselId) ?? 0.38,
        });
      }
      default:
        return null;
    }
  }, [action, offsets, layoutDx, uid, baseLevelOf, levelOf]);

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
    // 时间线回调：事故在中间那一帧「炸」（不是播完再炸）
    const cues = (scene.cues ?? []).map((cue) =>
      window.setTimeout(() => {
        cueRef.current?.(cue.kind);
        if (cue.kind === "impact") impactShake(root);
      }, cue.at),
    );
    const timer = window.setTimeout(onDone, Math.max(ms, scene.ms));
    return () => {
      window.clearTimeout(timer);
      cues.forEach((id) => window.clearTimeout(id));
      stopCount();
    };
    // scene 变了才重播一次
  }, [scene, onDone]);

  if (!scene) return null;
  return <g ref={groupRef} data-action-layer className="ix-action-layer">{scene.node}</g>;
}
