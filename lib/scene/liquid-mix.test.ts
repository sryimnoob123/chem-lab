import { describe, expect, it } from "vitest";
import { WATER_TINT, hasIndicator, mixLiquids, normalizeLiquidIds } from "./liquid-mix";

describe("液体混色：指示剂", () => {
  it("酚酞遇碱变粉红", () => {
    const m = mixLiquids(["phenolphthalein", "naoh"]);
    expect(m.kind).toBe("indicator");
    expect(m.color).toBe("#F48FB1");
    expect(m.note).toContain("粉红");
  });

  it("酚酞在酸里无色（回落水色）", () => {
    const m = mixLiquids(["phenolphthalein", "hcl"]);
    expect(m.color).toBe(WATER_TINT);
    expect(m.note).toContain("无色");
  });

  it("甲基橙遇酸变红、遇碱变黄、单独呈橙", () => {
    expect(mixLiquids(["methylOrange", "hcl"]).color).toBe("#E53935");
    expect(mixLiquids(["methylOrange", "naoh"]).color).toBe("#FDD835");
    expect(mixLiquids(["methylOrange"]).color).toBe("#FB8C00");
  });

  it("淀粉遇碘变深蓝", () => {
    const m = mixLiquids(["starch", "i2"]);
    expect(m.color).toBe("#1A237E");
    expect(m.note).toContain("深蓝");
  });

  it("hasIndicator 能认出指示剂", () => {
    expect(hasIndicator(["naoh", "phenolphthalein"])).toBe(true);
    expect(hasIndicator(["naoh", "hcl"])).toBe(false);
  });
});

describe("液体混色：沉淀", () => {
  it("AgNO₃ + NaCl → 白色 AgCl，且顺序无关", () => {
    const a = mixLiquids(["agno3", "nacl"]);
    const b = mixLiquids(["nacl", "agno3"]);
    expect(a.kind).toBe("precipitate");
    expect(a.color).toBe("#FFFFFF");
    expect(b.color).toBe(a.color);
    expect(a.note).toContain("AgCl");
  });

  it("AgNO₃ + KI → 黄色 AgI（不再是同一种白）", () => {
    const m = mixLiquids(["agno3", "ki"]);
    expect(m.color).toBe("#FFF59D");
    expect(m.kind).toBe("precipitate");
  });

  it("CuSO₄ + NaOH → 浅蓝 Cu(OH)₂", () => {
    const m = mixLiquids(["cuso4", "naoh"]);
    expect(m.color).toBe("#4FC3F7");
    expect(m.note).toContain("Cu(OH)₂");
  });

  it("FeCl₃ + NaOH → 红褐色 Fe(OH)₃", () => {
    expect(mixLiquids(["fecl3", "naoh"]).color).toBe("#8D6E63");
  });

  it("Na₂S + HCl 放气（不再是液体混合）", () => {
    const m = mixLiquids(["na2s", "hcl"]);
    expect(m.kind).toBe("precipitate");
    expect(m.note).toContain("H₂S");
  });
});

describe("液体混色：配位与基础色", () => {
  it("Cu²⁺ + 过量氨 → 深蓝", () => {
    const m = mixLiquids(["cuso4", "nh3"]);
    expect(m.kind).toBe("complex");
    expect(m.color).toBe("#1565C0");
  });

  it("Fe³⁺ + SCN⁻ → 血红", () => {
    const m = mixLiquids(["fecl3", "kscn"]);
    expect(m.kind).toBe("complex");
    expect(m.color).toBe("#B71C1C");
  });

  it("高锰酸钾自带紫色", () => {
    const m = mixLiquids(["kmno4"]);
    expect(m.kind).toBe("base");
    expect(m.color).toBe("#B39DDB");
  });

  it("空器皿 → 水色，kind=none", () => {
    const m = mixLiquids([]);
    expect(m.kind).toBe("none");
    expect(m.color).toBe(WATER_TINT);
  });

  it("只有蒸馏水也回落水色", () => {
    expect(mixLiquids(["water"]).color).toBe(WATER_TINT);
  });
});

describe("液体混色：回归「红黄不再同色」", () => {
  it("甲基橙(红系) 与 重铬酸钾(橙红) 给出不同颜色", () => {
    const orange = mixLiquids(["methylOrange", "hcl"]);
    const dichromate = mixLiquids(["k2cr2o7"]);
    expect(orange.color).not.toBe(dichromate.color);
  });

  it("连续加入两种试剂后颜色会变（不是取最后一个）", () => {
    const onlyCu = mixLiquids(["cuso4"]);
    const withBase = mixLiquids(["cuso4", "naoh"]);
    expect(withBase.color).not.toBe(onlyCu.color);
  });
});

describe("液体混色：id 归一化", () => {
  it("试剂架变体 id 归到物质 id", () => {
    expect(normalizeLiquidIds(["na2co3-solid", "h2so4-conc", "water"])).toEqual([
      "na2co3",
      "h2so4",
      "distilledwater",
    ]);
  });

  it("Na₂CO₃ 固体 + HCl 也能识别出放气", () => {
    const m = mixLiquids(["na2co3-solid", "hcl"]);
    expect(m.note).toContain("CO₂");
  });
});

describe("液体混色：沉淀沉底标记（B2 画器底沉淀层用）", () => {
  it("真沉淀标 sediment：AgCl / Cu(OH)₂ / AgI", () => {
    expect(mixLiquids(["agno3", "nacl"]).sediment).toBe(true);
    expect(mixLiquids(["cuso4", "naoh"]).sediment).toBe(true);
    expect(mixLiquids(["agno3", "ki"]).sediment).toBe(true);
  });

  it("逸出气体不标 sediment：CO₂ / H₂S 不沉底", () => {
    const co2 = mixLiquids(["na2co3", "hcl"]);
    expect(co2.kind).toBe("precipitate"); // 现象表里和沉淀同一优先级
    expect(co2.sediment).toBe(false);
    const h2s = mixLiquids(["na2s", "hcl"]);
    expect(h2s.note).toContain("H₂S");
    expect(h2s.sediment).toBe(false);
  });

  it("无色液体不标 sediment（沉淀层只属于真有固相的体系）", () => {
    expect(mixLiquids(["water"]).sediment).toBeUndefined();
    expect(mixLiquids(["cuso4"]).sediment).toBeUndefined();
  });
});
