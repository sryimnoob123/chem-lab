import { describe, expect, it } from "vitest";
import type { FxKey as EngineFxKey } from "../engine.types";
import { ENGINE_TO_SCENE, fxDurationOf, fxMetaOf, toEngineFx, toSceneFx } from "./fx-adapter";
import { FX_LIST } from "./fx";

const ENGINE_KEYS: EngineFxKey[] = [
  "boil-over",
  "explosion",
  "toxic-gas",
  "burn",
  "glass-break",
  "fire",
  "device-accident",
  "heavy-metal",
];

describe("fx-adapter：引擎 kebab ↔ 场景 camel", () => {
  it("8 个引擎 key 全部能映射，且不重复", () => {
    const mapped = ENGINE_KEYS.map((k) => toSceneFx(k));
    expect(mapped.every(Boolean)).toBe(true);
    expect(new Set(mapped).size).toBe(8);
  });

  it("每个映射结果都在 FX_LIST 里，且能拿到元数据", () => {
    for (const key of ENGINE_KEYS) {
      const meta = fxMetaOf(key);
      expect(meta, `缺少特效元数据：${key}`).not.toBeNull();
      expect(FX_LIST.some((fx) => fx.key === meta?.key)).toBe(true);
    }
  });

  it("双向映射可逆", () => {
    for (const key of ENGINE_KEYS) {
      const scene = toSceneFx(key);
      expect(scene).not.toBeNull();
      expect(toEngineFx(scene as NonNullable<typeof scene>)).toBe(key);
    }
  });

  it("kebab 的 4 个历史不一致项都对上了（回归）", () => {
    expect(toSceneFx("boil-over")).toBe("boilOver");
    expect(toSceneFx("toxic-gas")).toBe("toxicGas");
    expect(toSceneFx("glass-break")).toBe("glassBreak");
    expect(toSceneFx("device-accident")).toBe("deviceAccident");
    expect(toSceneFx("heavy-metal")).toBe("heavyMetal");
  });

  it("未知/null 返回 null，不抛错", () => {
    expect(toSceneFx(null)).toBeNull();
    expect(toSceneFx(undefined)).toBeNull();
    expect(toSceneFx("nope")).toBeNull();
    expect(fxMetaOf("nope")).toBeNull();
    expect(fxDurationOf(null)).toBe(0);
  });

  it("时长单源：非循环特效取 durationMs，循环特效取默认展示时长", () => {
    expect(fxDurationOf("explosion")).toBe(1400);
    expect(fxDurationOf("toxic-gas")).toBe(2000);
    expect(fxDurationOf("fire")).toBe(2400); // loop
    expect(fxDurationOf("fire", 1000)).toBe(1000);
  });

  it("映射表覆盖 FX_LIST 全部 key", () => {
    const scenes = new Set(Object.values(ENGINE_TO_SCENE));
    for (const fx of FX_LIST) expect(scenes.has(fx.key)).toBe(true);
  });
});
