"use client";

import { useEffect, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { DROPPABLE_KINDS, SCENE_VESSELS } from "@/lib/scene/palette";
import { describeContents } from "@/lib/scene/reagents";
import type { SceneFx, SceneOutcome } from "@/lib/scene/types";
import { DropHint } from "./drop-hint";
import styles from "./scene.module.css";
import { VesselArt } from "./vessel-art";

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
  burette: { y: 356, contentY: 368 },
  flask: { y: 356, contentY: 368 },
  beaker: { y: 356, contentY: 368 },
  "tube-a": { y: 356, contentY: 368 },
  "tube-b": { y: 356, contentY: 368 },
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
  feedback: SceneFeedback | null;
  onFeedbackEnd: () => void;
  onDropReagent: (vesselId: string) => void;
  onActivateVessel: (vesselId: string) => void;
  /** 点空白/Esc 取消已选试剂。 */
  onClearSelection: () => void;
  onReveal: (outcome: SceneOutcome) => void;
  /** 事故特效层（父组件绝对定位挂在舞台内）。 */
  children?: ReactNode;
};

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
  feedback,
  onFeedbackEnd,
  onDropReagent,
  onActivateVessel,
  onClearSelection,
  onReveal,
  children,
}: BenchSceneProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  /** 按实验裁剪器皿：天平单独渲染，这里只管玻璃器皿。 */
  const vessels = vesselIds ? SCENE_VESSELS.filter((v) => vesselIds.includes(v.id)) : SCENE_VESSELS;

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
        onClearSelection();
      }}
    >
      <svg className={styles.benchSvg} viewBox="0 50 940 340" role="img" aria-label="实验台：玻璃器皿与分析天平">
        {/* 台面与铁架台 */}
        <g aria-hidden="true">
          <rect x="0" y="340" width="940" height="80" fill="var(--bench)" />
          <line x1="0" y1="340" x2="940" y2="340" stroke="var(--line)" strokeWidth="1" />
          <ellipse cx="64" cy="340" rx="22" ry="5" fill="#4A5768" opacity="0.16" />
          <line x1="64" y1="92" x2="64" y2="340" stroke="#4A5768" strokeOpacity="0.6" strokeWidth="2" />
          <rect x="58" y="206" width="26" height="4" rx="1" fill="#4A5768" opacity="0.55" />
          <text x="924" y="402" textAnchor="end" className={styles.benchMark}>
            实验台
          </text>
        </g>

        {/* 分析天平（称量类实验的识别物，静态外形；读数在 step-demo 文案里表达） */}
        {instrument === "balance" ? (
        <g data-demo-id="demo-scene-instrument-balance" aria-hidden="true" transform="translate(792 214)">
          {/* 底座 + 立柱 */}
          <rect x="0" y="108" width="132" height="18" rx="3" fill="#4A5768" opacity="0.85" />
          <rect x="56" y="44" width="20" height="64" fill="#4A5768" opacity="0.7" />
          {/* 玻璃防风罩 + 称量盘（静态外形） */}
          <rect x="18" y="2" width="96" height="44" rx="2" fill="#fff" fillOpacity="0.5" stroke="#16202C" strokeOpacity="0.7" strokeWidth="1.4" />
          <line x1="66" y1="2" x2="66" y2="12" stroke="#16202C" strokeOpacity="0.45" strokeWidth="1" />
          <ellipse cx="66" cy="34" rx="30" ry="6" fill="#DCE9F2" fillOpacity="0.7" stroke="#16202C" strokeOpacity="0.45" strokeWidth="1" />
          {/* 显示屏 */}
          <rect x="20" y="56" width="92" height="26" rx="2" fill="#16202C" opacity="0.85" />
          <text x="66" y="74" textAnchor="middle" fill="#8FE3CF" fontSize="19" fontFamily="ui-monospace, monospace">
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

          return (
            <g
              key={vessel.id}
              data-demo-id={`demo-scene-vessel-${vessel.id}`}
              className={`ix ${styles.vessel} ${droppable ? styles.droppable : styles.static} ${
                fb === "success" ? "ix-snap" : fb === "reject" ? "ix-shake" : ""
              }`}
              role="button"
              tabIndex={0}
              data-pressed={pressedId === vessel.id ? "true" : "false"}
              data-drag-over={droppable && hovered && draggingReagentId ? "true" : "false"}
              data-feedback={fb ?? undefined}
              aria-label={
                droppable
                  ? `${vessel.label}，内含${describeContents(contents[vessel.id] ?? [])}，可接收试剂`
                  : `${vessel.label}，只装标准溶液，不接受投加试剂；拖入会给出规范提示`
              }
              onPointerDown={() => setPressedId(vessel.id)}
              onPointerUp={() => setPressedId(null)}
              onPointerCancel={() => setPressedId(null)}
              onPointerLeave={() => setPressedId(null)}
              onClick={() => onActivateVessel(vessel.id)}
              onKeyDown={(event) => handleKeyDown(event, vessel.id)}
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
              <VesselArt
                vessel={vessel}
                contents={contents[vessel.id] ?? []}
                outcome={activeOutcome}
                fxKey={reaction?.key ?? 0}
              />
              {/* 成功光环 / 拒收红环（一次性，动画结束由 onAnimationEnd 清掉） */}
              {fb === "success" ? (
                <rect className={styles.pulseRing} x={ringX} y={ringY} width={ringW} height={ringH} rx={10} />
              ) : null}
              {fb === "reject" ? (
                <rect className={styles.rejectRing} x={ringX} y={ringY} width={ringW} height={ringH} rx={10} />
              ) : null}
              {droppable && ((hovered && draggingReagentId) || (!draggingReagentId && selectedReagentId)) ? (
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
              <rect
                className={styles.hit}
                x={hitX}
                y={vessel.y - 14}
                width={hitW}
                height={vessel.h + 22}
                rx={4}
                pointerEvents="all"
              />
              <rect
                className={styles.focusRing}
                x={hitX}
                y={vessel.y - 14}
                width={hitW}
                height={vessel.h + 22}
                rx={4}
              />
              {hovered && hintMode ? <DropHint vessel={vessel} mode={hintMode} /> : null}
            </g>
          );
        })}

        {/* 器皿标签：名称 + 当前内容 */}
        {vessels.map((vessel) => {
          const pos = LABEL_POSITION[vessel.id] ?? { y: 356, contentY: 368 };
          const cx = vessel.x + vessel.w / 2;
          return (
            <g key={`label-${vessel.id}`} aria-hidden="true">
              <text x={cx} y={pos.y} textAnchor="middle" className={styles.vesselName}>
                {vessel.label}
              </text>
              <text x={cx} y={pos.contentY} textAnchor="middle" className={styles.vesselContents}>
                {describeContents(contents[vessel.id] ?? [])}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 事故特效层挂载点：绝对定位在舞台内 */}
      <div className={styles.fxSlot}>{children}</div>
    </div>
  );
}
