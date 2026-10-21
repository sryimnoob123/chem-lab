import { describe, expect, it } from "vitest";
import {
  COLORS,
  SUBSTANCES,
  getSubstance,
  listSubstanceIds,
  listSubstancesByPhase,
  requireSubstance,
  resolveSubstanceId,
} from "./substances";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("物质表完整性", () => {
  it("id 唯一且数量覆盖 10 个实验", () => {
    const ids = SUBSTANCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(50);
  });

  it("每个物质的危险标签、化学式、储存要求、ref 都非空", () => {
    for (const s of SUBSTANCES) {
      expect(s.hazards.length, s.id).toBeGreaterThan(0);
      expect(s.hazards.every((h) => h.trim().length > 0), s.id).toBe(true);
      expect(s.formula.trim().length, s.id).toBeGreaterThan(0);
      expect(s.storage.trim().length, s.id).toBeGreaterThan(0);
      expect(s.ref.trim().length, s.id).toBeGreaterThan(0);
      expect(s.nameZh.trim().length, s.id).toBeGreaterThan(0);
    }
  });

  it("颜色都是契约可用的十六进制 CSS 值", () => {
    for (const s of SUBSTANCES) expect(s.color, s.id).toMatch(HEX);
    expect(COLORS.white).toBe("#FFFFFF");
    expect(COLORS.yellow).toBe("#FFF59D");
  });

  it("常用浓度单位与数值合法", () => {
    for (const s of SUBSTANCES) {
      for (const c of s.commonConcentrations) {
        expect(Number.isFinite(c.value), `${s.id} ${c.value}`).toBe(true);
        expect(c.value).toBeGreaterThan(0);
        expect(["mol/L", "%", "g/mL"]).toContain(c.unit);
      }
    }
  });

  it("10 个实验的关键试剂都在表里", () => {
    const required = [
      "naoh", "hcl", "hac", "h2so4", "na2co3", "nacl", "agno3", "ki", "k2cro4", "k2cr2o7",
      "cuso4", "znso4", "nh3", "phenolphthalein", "methylOrange", "cacl2", "bacl2", "mgso4",
      "edta", "nabio3", "h2s", "ether", "distilledWater", "agcl", "agi", "baso4", "co2",
    ];
    for (const id of required) expect(getSubstance(id), id).toBeDefined();
  });

  it("物质关键属性可查", () => {
    expect(getSubstance("naoh")?.nameZh).toBe("氢氧化钠");
    expect(getSubstance("NaOH")?.id).toBe("naoh");
    expect(getSubstance("不存在")).toBeUndefined();
    expect(requireSubstance("naoh").molarMass).toBeCloseTo(40.0, 1);
    expect(() => requireSubstance("不存在")).toThrow(/未知物质/);
  });

  it("化学式 / 中文名 / 别名都能解析成规范 id", () => {
    expect(resolveSubstanceId("NaOH")).toBe("naoh");
    expect(resolveSubstanceId("氢氧化钠")).toBe("naoh");
    expect(resolveSubstanceId("CuSO4")).toBe("cuso4");
    expect(resolveSubstanceId("CuSO₄")).toBe("cuso4");
    expect(resolveSubstanceId("EDTA")).toBe("edta");
    expect(resolveSubstanceId("氨水")).toBe("nh3");
    expect(resolveSubstanceId("不存在的物质")).toBeUndefined();
  });

  it("列表函数按物态分组", () => {
    expect(listSubstanceIds()).toContain("co2");
    const gases = listSubstancesByPhase("gas").map((s) => s.id);
    expect(gases).toContain("co2");
    expect(gases).not.toContain("naoh");
  });

  it("关键反应产物带颜色，供现象表直接消费", () => {
    expect(getSubstance("agcl")?.color).toBe("#FFFFFF");
    expect(getSubstance("agi")?.color).toBe(COLORS.yellow);
    expect(getSubstance("cus")?.color).toBe(COLORS.black);
    expect(getSubstance("cuoh2")?.color).toBe(COLORS.lightBlue);
  });
});
