import { describe, expect, it } from "vitest";
import { PHENOMENA, lookup, phenomenaFor } from "./phenomena";
import { COLORS, resolveSubstanceId } from "./substances";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("现象表完整性", () => {
  it("条目 id 唯一、ref/note 非空", () => {
    const ids = PHENOMENA.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PHENOMENA.length).toBeGreaterThanOrEqual(40);
    for (const p of PHENOMENA) {
      expect(p.ref.trim().length, p.id).toBeGreaterThan(0);
      expect(p.note.trim().length, p.id).toBeGreaterThan(0);
    }
  });

  it("试剂 id 与产物物质都能在当前物质表里解析", () => {
    for (const p of PHENOMENA) {
      expect(p.reagents.length, p.id).toBeGreaterThan(0);
      for (const r of p.reagents) expect(resolveSubstanceId(r), `${p.id} → ${r}`).toBeDefined();
      if (p.precipitate) {
        expect(resolveSubstanceId(p.precipitate.substance), `${p.id} 沉淀`).toBeDefined();
        expect(p.precipitate.color, p.id).toMatch(HEX);
      }
      if (p.gas) {
        expect(resolveSubstanceId(p.gas.substance), `${p.id} 气体`).toBeDefined();
        expect(p.gas.color, p.id).toMatch(HEX);
      }
      if (p.colorChange) {
        expect(typeof p.colorChange.from, p.id).toBe("string");
        expect(typeof p.colorChange.to, p.id).toBe("string");
      }
    }
  });
});

describe("现象命中", () => {
  it("AgNO₃ + NaCl → 白色 AgCl 沉淀", () => {
    const r = lookup(["agno3", "nacl"]);
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.precipitate?.substance).toBe("agcl");
    expect(r.precipitate?.color).toBe("#FFFFFF");
    expect(r.gas).toBeUndefined();
  });

  it("AgNO₃ + KI → 黄色沉淀（颜色按契约取 #FFF59D）", () => {
    const r = lookup(["agno3", "ki"]);
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.precipitate?.substance).toBe("agi");
    expect(r.precipitate?.color).toBe(COLORS.yellow);
  });

  it("试剂顺序无关", () => {
    const a = lookup(["agno3", "nacl"]);
    const b = lookup(["nacl", "agno3"]);
    expect(a.matched && b.matched).toBe(true);
    if (a.matched && b.matched) expect(a.id).toBe(b.id);
  });

  it("可写化学式 / 中文名，大小写与下标不敏感", () => {
    const byFormula = lookup(["AgNO3", "NaCl"]);
    const byChinese = lookup(["硝酸银", "氯化钠"]);
    expect(byFormula.matched).toBe(true);
    expect(byChinese.matched).toBe(true);
    if (byFormula.matched && byChinese.matched) {
      expect(byFormula.precipitate?.substance).toBe("agcl");
      expect(byChinese.precipitate?.substance).toBe("agcl");
    }
  });

  it("Na₂CO₃ + HCl → CO₂ 气泡", () => {
    const r = lookup(["na2co3", "hcl"]);
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.gas?.substance).toBe("co2");
    expect(r.gas?.bubbles).toBe(true);
  });

  it("中和放热：NaOH + HCl", () => {
    const r = lookup(["naoh", "hcl"]);
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.heat).toBe(true);
    expect(r.note).toContain("指示剂");
  });

  it("酚酞 + NaOH → 粉红（指示剂终点）", () => {
    const r = lookup(["phenolphthalein", "naoh"]);
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.colorChange?.to).toContain("粉红");
  });
});

describe("条件消歧", () => {
  it("酸性介质下 Cr₂O₇²⁻ + KI 才明显析出 I₂", () => {
    const acidic = lookup(["k2cr2o7", "ki"], { medium: "acidic" });
    const noCondition = lookup(["k2cr2o7", "ki"]);
    expect(acidic.matched).toBe(true);
    if (acidic.matched) {
      expect(acidic.id).toBe("k2cr2o7-ki-acid-iodine");
      expect(acidic.colorChange?.to).toContain("棕黄");
    }
    expect(noCondition.unknown).toBe(true);
  });

  it("碱性介质下 Cr(Ⅵ) 变黄", () => {
    const r = lookup(["k2cr2o7", "naoh"], { medium: "basic" });
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.colorChange?.to).toContain("黄");
  });

  it("氨水过量才出现铜氨深蓝（否则不算命中）", () => {
    const withoutExcess = lookup(["cuso4", "nh3"]);
    const withExcess = lookup(["cuso4", "nh3"], { excessOf: "nh3" });
    expect(withoutExcess.unknown).toBe(true);
    expect(withExcess.matched).toBe(true);
    if (withExcess.matched) {
      expect(withExcess.colorChange?.to).toContain("深蓝");
      expect(withExcess.colorChange?.from).toContain("浅蓝");
    }
  });

  it("焰色需要 method 条件，直接查不带条件会落空", () => {
    const flame = lookup(["nacl"], { method: "flameTest" });
    expect(flame.matched).toBe(true);
    if (flame.matched) expect(flame.colorChange?.to).toBe(COLORS.yellow);
    expect(lookup(["nacl"]).unknown).toBe(true);
  });
});

describe("未命中不瞎编", () => {
  it("组合未收录时返回 unknown + hint + suggestions", () => {
    const r = lookup(["naoh", "nacl"]);
    expect(r.unknown).toBe(true);
    if (!r.unknown) return;
    expect(r.hint.length).toBeGreaterThan(0);
    expect(r.hint).toContain("未收录");
    expect(Array.isArray(r.suggestions)).toBe(true);
  });

  it("物质本身未收录时明确点名", () => {
    const r = lookup(["不存在的试剂", "naoh"]);
    expect(r.unknown).toBe(true);
    if (!r.unknown) return;
    expect(r.hint).toContain("不存在的试剂");
  });

  it("空输入也走 unknown 分支", () => {
    const r = lookup([]);
    expect(r.unknown).toBe(true);
  });

  it("phenomenaFor 返回该物质参与的全部条目", () => {
    const entries = phenomenaFor("agno3");
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(entries.every((e) => e.reagents.includes("agno3"))).toBe(true);
    expect(phenomenaFor("NaCl").length).toBeGreaterThan(0);
  });
});
