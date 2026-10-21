import { describe, expect, it } from "vitest";
import { FX_LIST, getFx, type FxKey } from "./fx";

const EXPECTED: Readonly<Record<FxKey, string>> = {
  explosion: "FxExplosion",
  toxicGas: "FxToxicGas",
  fire: "FxFire",
  boilOver: "FxBoilOver",
  burn: "FxBurn",
  glassBreak: "FxGlassBreak",
  heavyMetal: "FxHeavyMetal",
  deviceAccident: "FxDeviceAccident",
};

describe("事故特效映射", () => {
  it("正好 8 个 FxKey，且与组件名一一对应", () => {
    expect(FX_LIST).toHaveLength(8);
    const byKey = Object.fromEntries(FX_LIST.map((fx) => [fx.key, fx.component]));
    expect(byKey).toEqual(EXPECTED);
  });

  it("key / demoId / 组件名都不重复", () => {
    expect(new Set(FX_LIST.map((fx) => fx.key)).size).toBe(8);
    expect(new Set(FX_LIST.map((fx) => fx.demoId)).size).toBe(8);
    expect(new Set(FX_LIST.map((fx) => fx.component)).size).toBe(8);
  });

  it("每个特效都有中文名、语义提示与合法时长", () => {
    for (const fx of FX_LIST) {
      expect(fx.label.length).toBeGreaterThan(0);
      expect(fx.hint.length).toBeGreaterThan(10);
      expect(fx.durationMs).toBeGreaterThanOrEqual(0);
      expect(fx.loop).toBe(fx.durationMs === 0);
      expect(["danger", "warn", "oxid", "toxic"]).toContain(fx.semantic);
    }
  });

  it("demoId 统一为 demo-fx-*，可直接被脚本定位", () => {
    for (const fx of FX_LIST) {
      expect(fx.demoId).toMatch(/^demo-fx-[a-z-]+$/);
    }
    expect(getFx("explosion").demoId).toBe("demo-fx-explosion");
    expect(getFx("toxicGas").demoId).toBe("demo-fx-toxic-gas");
  });

  it("8 个 key 均为契约里的语义色，不越界到 UI 控件", () => {
    const semantics = new Set(FX_LIST.map((fx) => fx.semantic));
    expect(semantics).toEqual(new Set(["danger", "warn", "toxic"]));
  });
});
