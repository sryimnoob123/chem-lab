/**
 * FxKey 适配层：引擎/安全层用 kebab（"boil-over"），场景特效层用 camel（"boilOver"）。
 *
 * 这里是**唯一转换点**：任何把事故 → 特效的地方都必须走 `toSceneFx()` / `fxMetaOf()`，
 * 不要在组件里手写映射，否则 8 个 key 里 4 个对不上，特效永远播不出来。
 */
import type { FxKey as EngineFxKey } from "../engine.types";
import { FX_LIST, getFx, type FxKey, type FxMeta } from "./fx";

export const ENGINE_TO_SCENE: Readonly<Record<EngineFxKey, FxKey>> = {
  "boil-over": "boilOver",
  explosion: "explosion",
  "toxic-gas": "toxicGas",
  burn: "burn",
  "glass-break": "glassBreak",
  fire: "fire",
  "device-accident": "deviceAccident",
  "heavy-metal": "heavyMetal",
};

const SCENE_TO_ENGINE = Object.fromEntries(
  Object.entries(ENGINE_TO_SCENE).map(([engine, scene]) => [scene, engine]),
) as Record<FxKey, EngineFxKey>;

export function toSceneFx(key: EngineFxKey | string | null | undefined): FxKey | null {
  if (!key) return null;
  const mapped = (ENGINE_TO_SCENE as Record<string, FxKey | undefined>)[key];
  if (mapped) return mapped;
  // 已经是 camel 形式就直接用，避免调用方两套都传过
  if ((FX_LIST as readonly FxMeta[]).some((fx) => fx.key === key)) return key as FxKey;
  return null;
}

export function toEngineFx(key: FxKey): EngineFxKey {
  return SCENE_TO_ENGINE[key];
}

/** 引擎 key → 特效元数据（时长/中文名/demo-id/语义色都从这里取，别再另存一份） */
export function fxMetaOf(key: EngineFxKey | string | null | undefined): FxMeta | null {
  const scene = toSceneFx(key);
  if (!scene) return null;
  try {
    return getFx(scene);
  } catch {
    return null;
  }
}

/** 一次特效要播多久；循环特效（火焰）返回默认展示时长 */
export function fxDurationOf(key: EngineFxKey | string | null | undefined, loopMs = 2400): number {
  const meta = fxMetaOf(key);
  if (!meta) return 0;
  return meta.loop ? loopMs : meta.durationMs;
}
