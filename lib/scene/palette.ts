/**
 * 实验台布局与种子内容（asset-pipeline 独占 `lib/scene/**`）
 *
 * 坐标是 720×420 画布中的包围盒；绘制细节在 components/exp/scene/vessel-art.tsx。
 * 种子内容 = 器皿里预先装好的溶液，让学生"拖一瓶进去"就能看到现象，
 * 而不是必须先拖两瓶（一次拖拽一个现象，符合课堂演示节奏）。
 * 试剂数据在 ./reagents.ts。
 */

import type { SceneVessel } from "./types";

/** 实验台器皿；burette 只作场景陈设，不接受投加（resolveDrop 会温柔拒绝）。 */
export const SCENE_VESSELS: readonly SceneVessel[] = [
  { id: "burette", kind: "burette", label: "酸式滴定管", x: 48, y: 100, w: 84, h: 239 },
  { id: "flask", kind: "flask", label: "锥形瓶", x: 232, y: 193, w: 128, h: 134 },
  { id: "beaker", kind: "beaker", label: "烧杯", x: 404, y: 205, w: 116, h: 135 },
  { id: "tube-a", kind: "tube", label: "试管 A", x: 564, y: 215, w: 26, h: 125 },
  { id: "tube-b", kind: "tube", label: "试管 B", x: 620, y: 215, w: 26, h: 125 },
  { id: "volumetric", kind: "volumetric", label: "容量瓶 100 mL", x: 676, y: 180, w: 86, h: 160 },
];

/** 器皿里预先装好的物质（id 见 lib/chem/substances.ts）。 */
export const VESSEL_SEED: Readonly<Record<string, readonly string[]>> = {
  flask: ["nacl"],
  beaker: ["naoh"],
  "tube-a": ["hcl"], // 稀盐酸：拖碳酸钠进去即剧烈冒泡（CO₂）
  "tube-b": ["kscn"],
};

/** 可接受拖放的器皿种类；滴定管只装标准液，不接受直接投加。 */
export const DROPPABLE_KINDS: ReadonlySet<SceneVessel["kind"]> = new Set(["flask", "beaker", "tube", "dish", "volumetric"]);

export function getSceneVessel(id: string): SceneVessel | undefined {
  return SCENE_VESSELS.find((v) => v.id === id);
}
