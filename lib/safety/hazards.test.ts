import { describe, expect, it } from "vitest";
import {
  HAZARDS,
  HAZARD_IDS,
  getHazard,
  hasHazard,
  hazardsForScene,
  missingHazardIds,
  type HazardDomain,
} from "./hazards";

const DOMAINS: HazardDomain[] = [
  "discipline",
  "glassware",
  "corrosive",
  "titration",
  "heating",
  "instrument",
  "hazardous",
  "waste",
  "electrical",
  "report",
];

describe("规范条目库 hazards", () => {
  it("exp09 §5 的 S001~S009 全部存在，且标题口径与规格一致", () => {
    const expected: Record<string, string> = {
      S001: "实验室安全守则",
      S002: "玻璃器皿",
      S003: "腐蚀性试剂",
      S004: "滴定管",
      S005: "滴定操作",
      S006: "读数",
      S007: "移液管",
      S008: "废液",
      S009: "事故报告",
    };
    for (const [id, keyword] of Object.entries(expected)) {
      const item = getHazard(id);
      expect(item, `${id} 缺失`).toBeDefined();
      expect(item?.title).toContain(keyword);
    }
  });

  it("编号格式统一为 S+三位数字，且全库唯一、升序", () => {
    expect(HAZARD_IDS.length).toBeGreaterThanOrEqual(9);
    expect(new Set(HAZARD_IDS).size).toBe(HAZARD_IDS.length);
    for (const id of HAZARD_IDS) expect(id).toMatch(/^S\d{3}$/);
    expect([...HAZARD_IDS].sort()).toEqual([...HAZARD_IDS]);
  });

  it("每条都有可印在规范卡上的要求、适用场景、来源口径与【待老师核】标记", () => {
    for (const h of HAZARDS) {
      expect(h.requirement.length, `${h.id} requirement 太短`).toBeGreaterThanOrEqual(20);
      expect(h.scenes.length, `${h.id} 无适用场景`).toBeGreaterThan(0);
      expect(h.source.length, `${h.id} 无来源口径`).toBeGreaterThan(0);
      expect(h.review).toBe("【待老师核】");
      expect(DOMAINS).toContain(h.domain);
    }
  });

  it("S003（腐蚀性试剂）明确写入『酸入水』口径，S004 写入『碱不进酸式管』", () => {
    expect(getHazard("S003")?.requirement).toContain("酸入水");
    expect(getHazard("S004")?.requirement).toContain("碱液只用碱式");
  });

  it("S006 是滴定管读数（exp09 事故 refs 依赖这一口径）", () => {
    const s006 = getHazard("S006");
    expect(s006?.domain).toBe("titration");
    expect(s006?.requirement).toContain("0.01 mL");
  });

  it("getHazard / hasHazard 对未知编号安全返回", () => {
    expect(getHazard("S999")).toBeUndefined();
    expect(hasHazard("S999")).toBe(false);
    expect(hasHazard("S001")).toBe(true);
  });

  it("missingHazardIds 只报出不存在的编号，顺序不变", () => {
    expect(missingHazardIds(["S001", "S999", "S003", "S998"])).toEqual(["S999", "S998"]);
    expect(missingHazardIds(["S001", "S009"])).toEqual([]);
  });

  it("hazardsForScene 按场景关键字检索；空串返回空数组", () => {
    expect(hazardsForScene("滴定管").some((h) => h.id === "S004")).toBe(true);
    expect(hazardsForScene("通风橱").some((h) => h.id === "S010")).toBe(true);
    expect(hazardsForScene("")).toEqual([]);
    expect(hazardsForScene("这个场景不存在")).toEqual([]);
  });

  it("索引与数组一致（HAZARD_INDEX 不会漏条目）", () => {
    expect(HAZARD_IDS.length).toBe(HAZARDS.length);
    for (const h of HAZARDS) expect(getHazard(h.id)).toBe(h);
  });
});
