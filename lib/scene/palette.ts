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
  /* 2026-10-23：器皿排成一条基线（y 底边都压在 340 台面线），右侧留给工具托盘。
     烧杯 430 / 试管 690·786 / 容量瓶 880 —— 间距按「17px 标签不叠」定。 */
  /* 2026-10-23：exp01 第 6 步「移取 25.00 mL 放入锥形瓶」原来台面上没有锥形瓶（只有烧杯/两支试管/
     容量瓶），学生没有落点、指引指向的是容量瓶。把锥形瓶摆进容量瓶右侧的空位：
     1028（容量瓶右沿）.. 1299（右侧浮层面板左沿）是台面上唯一一段常驻可见的空白，
     瓶身 1040..1226 落在正中且不与面板重叠；底边压 340 台面线（与烧杯/容量瓶同一基线）。
     y 取 126 而不是 146：锥形瓶的画法在包围盒里偏下（146 时瓶底比烧杯低 20 单位，实拍量过）。 */
  { id: "flask", kind: "flask", label: "锥形瓶", x: 1040, y: 126, w: 186, h: 194 },
  { id: "beaker", kind: "beaker", label: "烧杯", x: 430, y: 144, w: 168, h: 196 },
  { id: "tube-a", kind: "tube", label: "试管 A", x: 690, y: 159, w: 38, h: 181 },
  { id: "tube-b", kind: "tube", label: "试管 B", x: 786, y: 159, w: 38, h: 181 },
  { id: "volumetric", kind: "volumetric", label: "容量瓶 100 mL", x: 880, y: 108, w: 125, h: 232 },
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
