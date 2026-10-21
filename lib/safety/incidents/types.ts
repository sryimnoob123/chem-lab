/**
 * 事故层类型 —— 复用引擎契约类型 + 事故层扩展 + 判定小工具
 *
 * 引擎侧权威类型在 `lib/engine.types.ts`（engine-core 已交付），这里**只 re-export，不重复声明**，
 * 以免两份 ExperimentState/Incident 漂移。
 *
 * 红线：trigger 必须是纯函数 `(state, action) => boolean`；不读全局、不取时间、不用随机。
 */

export type {
  Action,
  ActionParams,
  ActionType,
  CompetencyCode,
  EntityKind,
  EntityState,
  ExperimentState,
  FxKey,
  Incident,
  IncidentLevel,
  IncidentRecord,
  Observation,
  ViolationRecord,
} from "@/lib/engine.types";

import type { Incident } from "@/lib/engine.types";

/** 契约 §5 / §11：8 个视觉键，与 `components/fx/` 一一对应，不可增删、不可改名 */
export const FX_KEYS = [
  "boil-over",
  "explosion",
  "toxic-gas",
  "burn",
  "glass-break",
  "fire",
  "heavy-metal",
  "device-accident",
] as const;

export const INCIDENT_LEVELS = ["L1", "L2", "L3", "L4"] as const;

/** 契约 §5 判分表：固定，不许各实验自定 */
export interface LevelRule {
  /** 中文名 */
  label: string;
  min: number;
  max: number;
  /** 是否必须 terminate */
  terminate: boolean;
}

export const LEVEL_RULES: Readonly<Record<(typeof INCIDENT_LEVELS)[number], LevelRule>> = {
  L1: { label: "偏差", min: 2, max: 3, terminate: false },
  L2: { label: "数据作废", min: 5, max: 5, terminate: false },
  L3: { label: "事故", min: 8, max: 10, terminate: false },
  L4: { label: "危险事故", min: 15, max: 20, terminate: true },
};

/**
 * 事故层的 Incident：契约 §5 字段一个不少，另加两个**可选**扩展（引擎不消费、UI 用）：
 * - `stepNo`：规格里的「步」是 1-based，照抄便于定格/复盘定位；
 * - `fxSilent`：L1/L2 在规格 §7 标「无特效，文字+音效」。契约 `fx: FxKey` 必填，故 fx 仍填最接近的键，
 *   但 UI/引擎必须看 fxSilent 决定**不播动画**。
 */
export interface HazardIncident extends Incident {
  stepNo?: number;
  fxSilent?: boolean;
}

/** 扣分是否落在该级别的合法区间（含端点） */
export function isDeductInRange(level: keyof typeof LEVEL_RULES, deduct: number): boolean {
  const rule = LEVEL_RULES[level];
  return Number.isFinite(deduct) && deduct >= rule.min && deduct <= rule.max;
}

// ── 判定小工具（全部纯函数）────────────────────────────────────────────

/** 规格里的「步」是 1-based，state.stepIndex 是 0-based（契约 §3） */
export function onStep(state: import("@/lib/engine.types").ExperimentState, stepNo: number): boolean {
  return state.stepIndex === stepNo - 1;
}

/** params 里任一键严格为 true */
export function paramTrue(action: import("@/lib/engine.types").Action, ...keys: string[]): boolean {
  const p = action.params;
  if (!p) return false;
  return keys.some((k) => p[k] === true);
}

/** params[key] 等于给定值之一 */
export function paramEquals(
  action: import("@/lib/engine.types").Action,
  key: string,
  ...values: Array<string | number | boolean>
): boolean {
  const p = action.params;
  if (!p) return false;
  return values.some((v) => p[key] === v);
}

/** params[key] 取数值；不是有限数则返回 undefined */
export function numParam(action: import("@/lib/engine.types").Action, key: string): number | undefined {
  const p = action.params;
  if (!p) return undefined;
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** choiceId 命中任一语义 token（小写、包含即命中），用于容忍定义文件的命名差异 */
export function choiceHas(action: import("@/lib/engine.types").Action, ...tokens: string[]): boolean {
  const id = action.choiceId.toLowerCase();
  return tokens.some((t) => id.includes(t.toLowerCase()));
}

/** 多个判定里任一成立 */
export function anyOf(...checks: Array<() => boolean>): boolean {
  return checks.some((c) => c());
}
