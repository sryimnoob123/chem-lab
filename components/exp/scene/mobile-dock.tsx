"use client";

/**
 * MobileDock —— 窄屏（≤560px）的点击目标层（D5，2026-10-24）。
 *
 * 为什么不是在 SVG 里把热区放大：台面 viewBox 宽 1560 单位，390 屏的缩放是 0.25 ——
 * 器皿 27px、工具 15px、天平 40px，全都不够 44px；把 SVG 放大到够 44px 需要 2000px 宽
 * （横向滑五屏），那不是能用的界面。所以窄屏换一条路：**把「可点」提到 HTML**，
 * SVG 只负责「看现象」，可点目标全在这一条里，每个 ≥44×44。
 *
 * 交互与台面一致（DECISIONS §20 B 方案「点选投放」）：
 *   先点工具 → 再点器皿 = 对这台器皿用这个工具；没拿工具时点器皿 = 选中它。
 * 拖动仍可在 SVG 上做（PC 用），这里不抢它的活。
 */

import styles from "./mobile-dock.module.css";
import { SCENE_VESSELS } from "@/lib/scene/palette";
import { SCENE_TOOLS, type SceneToolId } from "@/lib/scene/tools";

export type MobileDockProps = {
  vesselIds: readonly string[];
  toolIds?: readonly SceneToolId[];
  activeTool?: SceneToolId | null;
  activeVesselId?: string | null;
  onSelectTool?: (id: SceneToolId | null) => void;
  onActivateVessel: (vesselId: string) => void;
  onUseTool?: (tool: SceneToolId, vesselId: string) => void;
  /** 天平：称量类实验才出现 */
  instrument?: "balance" | "ph" | null;
  onInstrument?: () => void;
};

export function MobileDock({
  vesselIds,
  toolIds,
  activeTool = null,
  activeVesselId = null,
  onSelectTool,
  onActivateVessel,
  onUseTool,
  instrument = null,
  onInstrument,
}: MobileDockProps) {
  const vessels = SCENE_VESSELS.filter((v) => vesselIds.includes(v.id));
  const tools = SCENE_TOOLS.filter((t) => toolIds?.includes(t.id));
  if (vessels.length === 0 && tools.length === 0) return null;

  const pickVessel = (id: string) => {
    if (activeTool && onUseTool) {
      onUseTool(activeTool, id);
      onSelectTool?.(null);
      return;
    }
    onActivateVessel(id);
  };

  return (
    <div className={styles.dock} data-demo-id="demo-mobile-dock" aria-label="操作台">
      {instrument === "balance" && onInstrument ? (
        <button
          type="button"
          className={styles.chip}
          data-demo-id="demo-dock-balance"
          onClick={onInstrument}
        >
          天平
        </button>
      ) : null}

      {vessels.map((vessel) => (
        <button
          key={vessel.id}
          type="button"
          className={styles.chip}
          data-demo-id={`demo-dock-vessel-${vessel.id}`}
          data-active={activeTool ? "target" : activeVesselId === vessel.id ? "true" : "false"}
          aria-pressed={activeVesselId === vessel.id}
          onClick={() => pickVessel(vessel.id)}
        >
          {vessel.label}
        </button>
      ))}

      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={styles.chip}
          data-demo-id={`demo-dock-tool-${tool.id}`}
          data-active={activeTool === tool.id ? "true" : "false"}
          aria-pressed={activeTool === tool.id}
          onClick={() => onSelectTool?.(activeTool === tool.id ? null : tool.id)}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}
