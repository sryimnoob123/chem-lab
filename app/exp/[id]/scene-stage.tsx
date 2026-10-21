"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { getSceneReagent } from "@/lib/scene/reagents";
import { BenchScene } from "@/components/exp/scene/bench-scene";
import { LabApparatus } from "./lab-apparatus";
import styles from "./workbench.module.css";

const RACK_IDS = ["naoh", "hcl", "phenolphthalein", "methylOrange"] as const;
const EXP02_RACK_IDS = ["na2co3-solid", "water"] as const;
const EXP03_RACK_IDS = ["water"] as const;
const EXP04_RACK_IDS = ["na2co3-solid", "water"] as const;
const EXP08_RACK_IDS = ["na2co3-solid"] as const;

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

const EXP04_BENCH_CONTENTS: Readonly<Record<string, readonly string[]>> = {
  burette: [],
  flask: [],
  beaker: ["na2co3"],
  "tube-a": ["nacl"],
  "tube-b": ["ki"],
  volumetric: ["water"],
};

const DROP_COPY: Record<string, string> = {
  naoh: "NaOH 逐滴加入锥形瓶：局部出现浅粉红又褪去，说明还在终点前；继续半滴、摇匀。",
  hcl: "锥形瓶里已经是 HCl。再补酸只会让终点更晚，体积比会偏大。",
  phenolphthalein: "酚酞在酸性溶液中无色；等 NaOH 滴到终点，才会出现 30 s 不褪的浅粉红。",
  methylOrange: "甲基橙在酸性溶液中呈橙红；它和酚酞不能同时拿来判这个终点。",
  "na2co3-solid": "Na₂CO₃ 试样：用药匙取用，称量纸折角盛放，不能直接倒在秤盘上。",
  water: "蒸馏水：沿玻璃棒或杯壁加入，别直接冲起沉淀；除杂阶段按 8 mL/g 粗盐取水。",
};

export function SceneStage({
  expId,
  onCaption,
  onInput,
  autoDrop,
  feedbackTone,
  feedbackSeq,
  children,
}: {
  expId?: string;
  onCaption: (text: string | null) => void;
  onInput?: (mode: "drag" | "click" | "event") => void;
  autoDrop?: { reagentId: string; vesselId: string };
  feedbackTone: "success" | "failure" | null;
  feedbackSeq: number;
  children?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overFlask, setOverFlask] = useState(false);

  const isBenchScene =
    expId === "exp08" || expId === "exp02" || expId === "exp03" || expId === "exp04";
  const rackIds: readonly string[] =
    expId === "exp02"
      ? EXP02_RACK_IDS
      : expId === "exp03"
        ? EXP03_RACK_IDS
        : expId === "exp04"
          ? EXP04_RACK_IDS
          : expId === "exp08"
            ? EXP08_RACK_IDS
            : RACK_IDS;
  const reagents = rackIds.map((id) => getSceneReagent(id)).filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );

  const applyReagent = (id: string, mode: "drag" | "click" | "event") => {
    const copy = DROP_COPY[id];
    setSelectedId(null);
    setDraggingId(null);
    setOverFlask(false);
    if (copy) {
      onInput?.(mode);
      onCaption(copy);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const id = draggingId ?? event.dataTransfer.getData("text/plain");
    if (id) applyReagent(id, "drag");
  };

  useEffect(() => {
    if (!autoDrop || autoDrop.vesselId !== "flask") return;
    if (!RACK_IDS.includes(autoDrop.reagentId as (typeof RACK_IDS)[number])) return;
    const timer = window.setTimeout(() => applyReagent(autoDrop.reagentId, "event"), 0);
    return () => window.clearTimeout(timer);
    // 只在 URL 事件参数变化时重放一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDrop?.reagentId, autoDrop?.vesselId]);

  const selected = reagents.find((item) => item.id === selectedId) ?? null;

  const feedbackClass =
    feedbackTone === "success" ? "ix-snap" : feedbackTone === "failure" ? "ix-shake" : "";

  return (
    <div
      className={styles.sceneStage}
      onClick={(event) => {
        // 点空白取消选中；按钮自己的 click 不在这里处理
        if ((event.target as Element).closest("button")) return;
        setSelectedId(null);
        setDraggingId(null);
        setOverFlask(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelectedId(null);
          setDraggingId(null);
          setOverFlask(false);
          onCaption(null);
        }
      }}
    >
      <aside className={styles.rack} aria-label="试剂架">
        <div className={styles.rackHead}>
          <span>试剂架</span>
          <span className={styles.rackHint}>拖到锥形瓶</span>
        </div>
        <ul className={styles.rackList}>
          {reagents.map((reagent) => (
            <li key={reagent.id}>
              <button
                type="button"
                className={`${styles.reagent} ix`}
                draggable
                data-demo-id={reagent.demoId}
                data-selected={selectedId === reagent.id ? "true" : "false"}
                data-dragging={draggingId === reagent.id ? "true" : "false"}
                aria-pressed={selectedId === reagent.id}
                aria-label={`${reagent.name} ${reagent.formula}，${selectedId === reagent.id ? "已选中" : "可拖动"}`}
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
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", reagent.id);
                  event.dataTransfer.effectAllowed = "copy";
                  setDraggingId(reagent.id);
                  setSelectedId(reagent.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setSelectedId(null);
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
          {expId === "exp02"
            ? "台上：分析天平 200 g / 0.1 mg · 烧杯 · 容量瓶 · Na₂CO₃ / 蒸馏水"
            : expId === "exp03"
              ? "台上：pH 计 · 烧杯 · 容量瓶 · 蒸馏水（电极待替换 · TODO）"
              : expId === "exp04"
                ? "台上：离心管 · 烧杯 · 试管 · 容量瓶 · Na₂CO₃ / 蒸馏水（离心机待替换 · TODO）"
                : expId === "exp08"
                  ? "台上：分析天平 200 g / 0.1 mg · 烧杯 · Na₂CO₃ 试样"
                  : "台上：酸式滴定管 50 mL / 锥形瓶 250 mL"}
        </p>
      </aside>

      {selected && !draggingId ? (
        <div className={styles.pickHint} role="status" aria-live="polite" data-demo-id="demo-pick-hint">
          已选中 {selected.name} · 再点目标器皿
          <span className={styles.pickHintKey}>Esc 取消</span>
        </div>
      ) : null}

      <div className={styles.benchArea}>
        <div
          key={`vessel-${feedbackSeq}`}
          className={`${styles.apparatusWrap} ${feedbackClass}`}
          data-bench={isBenchScene ? "true" : undefined}
          data-feedback={feedbackTone ?? undefined}
        >
          {isBenchScene ? (
            <div className={styles.benchReuse} data-demo-id={`${expId}-bench-scene`}>
              <BenchScene
                contents={
                  expId === "exp03"
                    ? EXP03_BENCH_CONTENTS
                    : expId === "exp04"
                      ? EXP04_BENCH_CONTENTS
                      : BENCH_CONTENTS
                }
                reaction={null}
                selectedReagentId={null}
                draggingReagentId={null}
                feedback={null}
                onFeedbackEnd={() => undefined}
                onDropReagent={() => undefined}
                onActivateVessel={() => undefined}
                onClearSelection={() => undefined}
                onReveal={() => undefined}
              />
            </div>
          ) : (
            <LabApparatus className={styles.apparatus} />
          )}
          <button
            type="button"
            className={`${styles.flaskTarget} ix`}
            data-active={selectedId || draggingId ? "true" : "false"}
            data-drop-target={selectedId || draggingId ? "true" : "false"}
            data-over={overFlask ? "true" : "false"}
            data-demo-id="demo-scene-drop-flask"
            aria-label="锥形瓶：把选中的试剂放进来"
            onClick={() => {
              if (selectedId) applyReagent(selectedId, "click");
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setOverFlask(true);
            }}
            onDragLeave={() => setOverFlask(false)}
            onDrop={handleDrop}
          >
            <span className={styles.dropLabel}>
              {selectedId ? "放到锥形瓶" : "锥形瓶"}
            </span>
          </button>
        </div>
        <div className={styles.benchSurface} aria-hidden="true" />
      </div>

      <div className={styles.stageCaption}>
        <span className={styles.captionMark} aria-hidden="true" />
        {expId === "exp02"
          ? "图 02 · 分析天平 200 g / 0.1 mg · 烧杯 / 容量瓶 · 正视无透视"
          : expId === "exp03"
            ? "图 03 · pH 计 / 烧杯 / 容量瓶 · 正视无透视"
            : expId === "exp04"
              ? "图 04 · 离心管 / 烧杯 / 试管 / 容量瓶 · 正视无透视"
              : expId === "exp08"
                ? "图 08 · 分析天平 200 g / 0.1 mg · 称量瓶（烧杯占位）· 正视无透视"
                : "图 09 · 酸式滴定管 50 mL / 锥形瓶 250 mL · 正视无透视"}
      </div>

      <div className={styles.fxSlot} data-feedback={feedbackTone ?? undefined}>
        {children}
      </div>
    </div>
  );
}
