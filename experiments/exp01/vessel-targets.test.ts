import { describe, expect, it } from "vitest";
import { getDefinition } from "@/lib/engine";
import { expectedVesselId } from "../../app/exp/[id]/vessel-targets";

/**
 * 「这一步该往哪台器皿里倒」的判定（app/exp/[id]/vessel-targets）。
 *
 * 钉住演示主线：判错的器皿要被拦下、判对的要能通过。
 * 第 7 步是关键 —— 浓硫酸必须先进入**烧杯里的水**，
 * 判定若退化成「转移类默认容量瓶」，学生把酸倒进容量瓶反而被判对。
 */
const VESSELS = [
  { id: "beaker", label: "烧杯 250 mL" },
  { id: "volumetric", label: "容量瓶 100 mL" },
  { id: "tube-a", label: "试管 A" },
  { id: "tube-b", label: "试管 B" },
];

describe("expectedVesselId · exp01", () => {
  const definition = getDefinition("exp01");
  if (!definition) throw new Error("exp01 定义缺失");

  it("第 4 步（溶解转移）指向烧杯", () => {
    expect(expectedVesselId(definition.steps[3], new Set(), VESSELS)).toBe("beaker");
  });

  it("第 5 步（定容）指向容量瓶", () => {
    expect(expectedVesselId(definition.steps[4], new Set(), VESSELS)).toBe("volumetric");
  });

  it("第 7 步（浓硫酸稀释）指向烧杯，不是容量瓶", () => {
    expect(expectedVesselId(definition.steps[6], new Set(), VESSELS)).toBe("beaker");
  });
});
