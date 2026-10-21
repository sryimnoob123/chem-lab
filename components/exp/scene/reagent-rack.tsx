"use client";

import { useState } from "react";

import { REAGENTS, REAGENT_GROUPS, type SceneReagentDef } from "@/lib/scene/reagents";
import styles from "./scene.module.css";

type ReagentRackProps = {
  selectedId: string | null;
  draggingId: string | null;
  onSelect: (reagentId: string) => void;
  onDragStart: (reagentId: string) => void;
  onDragEnd: () => void;
};

/** 试剂瓶小图：瓶盖深色、瓶身填真实溶液色、白标签。 */
function BottleArt({ color }: { color: string }) {
  return (
    <svg className={styles.bottleArt} viewBox="0 0 44 56" aria-hidden="true" focusable="false">
      <rect x="14" y="2" width="16" height="8" rx="1.5" fill="#16202C" fillOpacity="0.8" />
      <rect
        x="17"
        y="10"
        width="10"
        height="7"
        fill="#fff"
        fillOpacity="0.5"
        stroke="#16202C"
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
      <path
        d="M10 17 H34 L38 50 Q38 54 34 54 H10 Q6 54 6 50 Z"
        fill="#fff"
        fillOpacity="0.55"
        stroke="#16202C"
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
      <path d="M8 26 H36 V49 Q36 52 33 52 H11 Q8 52 8 49 Z" fill={color} fillOpacity="0.75" />
      <rect x="12" y="30" width="20" height="13" rx="1" fill="#fff" fillOpacity="0.9" />
      <line x1="15" y1="35" x2="29" y2="35" stroke="#16202C" strokeOpacity="0.6" strokeWidth="1" />
      <line x1="15" y1="39" x2="25" y2="39" stroke="#16202C" strokeOpacity="0.4" strokeWidth="0.8" />
    </svg>
  );
}

export function Bottle({
  reagent,
  selected,
  dragging,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  reagent: SceneReagentDef;
  selected: boolean;
  dragging: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);

  return (
    <li>
      <button
        type="button"
        className={`ix ${styles.bottle}`}
        draggable
        data-demo-id={reagent.demoId}
        data-dragging={dragging ? "true" : "false"}
        data-selected={selected ? "true" : "false"}
        data-picked={selected ? "true" : "false"}
        data-pressed={pressed ? "true" : "false"}
        aria-pressed={selected}
        aria-label={`${reagent.name} ${reagent.formula}，${reagent.unit}${selected ? "，已选中" : ""}`}
        title={`${reagent.name} · ${reagent.formula} · ${reagent.unit}｜${reagent.ghs.join("、")}`}
        onPointerDown={() => setPressed(true)}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        onClick={() => onSelect(reagent.id)}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", reagent.id);
          event.dataTransfer.effectAllowed = "copy";
          onDragStart(reagent.id);
        }}
        onDragEnd={onDragEnd}
      >
        <BottleArt color={reagent.colorHex} />
        <span className={styles.bottleName}>{reagent.name}</span>
        <span className={styles.bottleFormula}>{reagent.formula}</span>
        <span className={styles.selectedTag} aria-hidden="true">
          已选中
        </span>
      </button>
    </li>
  );
}

/** 可拖拽试剂架：点选（键盘/触屏路径）与 HTML5 拖拽共用同一份数据。 */
export function ReagentRack({ selectedId, draggingId, onSelect, onDragStart, onDragEnd }: ReagentRackProps) {
  return (
    <div className={styles.rack} aria-label="试剂架">
      <h2 className={styles.rackTitle}>试剂架</h2>
      <p className={styles.rackHint}>拖到器皿上，或点试剂再点器皿</p>
      {REAGENT_GROUPS.map((group) => {
        const items = REAGENTS.filter((r) => r.group === group.id);
        if (items.length === 0) return null;
        return (
          <section key={group.id} className={styles.rackGroup} aria-label={group.label}>
            <h3 className={styles.rackGroupTitle}>{group.label}</h3>
            <ul className={styles.bottles}>
              {items.map((reagent) => (
                <Bottle
                  key={reagent.id}
                  reagent={reagent}
                  selected={selectedId === reagent.id}
                  dragging={draggingId === reagent.id}
                  onSelect={onSelect}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
