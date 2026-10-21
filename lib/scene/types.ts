/**
 * 拖拽反应场景 · 类型（asset-pipeline 独占 `lib/scene/**`）
 *
 * 只描述"台面上有什么、拖了什么、结果是什么"，不含 React、不含 IO。
 * 现象结构刻意与 `lib/chem/phenomena-table.ts` 解耦：屏幕只消费
 * 颜色 / 文案 / 动画键，化学口径改表时这里不动。
 */

export type SceneVesselKind = "flask" | "beaker" | "burette" | "tube" | "dish" | "volumetric";

/** 实验台上的一个器皿；x/y/w/h 是 720×420 画布里的包围盒（drop 区与高亮环用）。 */
export type SceneVessel = {
  id: string;
  kind: SceneVesselKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 试剂架上一瓶试剂；colorHex 用于瓶身液色，无色溶液给水色提示。 */
export type SceneReagent = {
  id: string;
  name: string;
  formula: string;
  colorHex: string;
  ghs: string[];
  unit: string;
};

export type SceneDrop = { reagentId: string; vesselId: string };

export type ScenePrecipitate = { color: string; label: string; formula: string };
export type SceneGas = { label: string; formula: string };
export type SceneColorChange = { from: string; to: string; fromHex: string; toHex: string };

export type ScenePhenomena = {
  precipitate?: ScenePrecipitate;
  gas?: SceneGas;
  colorChange?: SceneColorChange;
  heat?: boolean;
};

/** 动画键：沉淀 / 气泡 / 变色 / 放热 / 雾气（可见气体）。 */
export type SceneFx = "none" | "precipitate" | "bubbles" | "color" | "heat" | "smoke";

export type SceneOutcome = {
  /** 查表命中（真正有现象）才为 true；未命中走温和提示。 */
  ok: boolean;
  phenomena: ScenePhenomena;
  /** 一句中文解释，含真实化学方程式或离子式（Unicode 上下标）。 */
  caption: string;
  fx: SceneFx;
  /** 命中的现象条目 id，便于测试与日志定位（可选）。 */
  matchedId?: string;
  /** 命中条目的补充说明（来源/条件/处置），事件条作为第二行展示。 */
  note?: string;
  /** 未命中时给开发者的查表提示，不直接展示给学生。 */
  hint?: string;
};
