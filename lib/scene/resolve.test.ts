import { describe, expect, it } from "vitest";
import { requireSubstance } from "@/lib/chem/substances";
import { PHENOMENA } from "@/lib/chem/phenomena";
import { equationFor } from "./equations";
import { MISS_CAPTION, resolveDrop } from "./resolve";
import { getSceneVessel, SCENE_VESSELS, VESSEL_SEED } from "./palette";
import { getSceneReagent, WATER_TINT } from "./reagents";
import type { SceneReagent } from "./types";

const vessel = (id: string) => {
  const v = getSceneVessel(id);
  if (!v) throw new Error(`缺少器皿 ${id}`);
  return v;
};

/** 不在试剂架上的物质（测试用）：从物质表直接造一个 SceneReagent。 */
function reagentOf(id: string): SceneReagent {
  const s = requireSubstance(id);
  return {
    id: s.id,
    name: s.nameZh,
    formula: s.formula,
    colorHex: s.color.toUpperCase() === "#FFFFFF" ? WATER_TINT : s.color,
    ghs: [...s.hazards],
    unit: "测试",
  };
}

const rack = (id: string) => {
  const r = getSceneReagent(id);
  if (!r) throw new Error(`缺少试剂 ${id}`);
  return r;
};

describe("resolveDrop · 命中", () => {
  it("氯化钠 + 硝酸银：白色 AgCl 沉淀，走 precipitate 动画", () => {
    const out = resolveDrop(vessel("flask"), rack("agno3"), ["nacl"]);
    expect(out.ok).toBe(true);
    expect(out.fx).toBe("precipitate");
    expect(out.matchedId).toBe("agno3-nacl-agcl");
    expect(out.phenomena.precipitate?.color).toBe("#FFFFFF");
    expect(out.phenomena.precipitate?.label).toContain("氯化银");
    expect(out.caption).toContain("AgCl↓");
    expect(out.caption).toContain("Ag⁺");
  });

  it("氢氧化钠 + 硫酸铜：浅蓝色 Cu(OH)₂ 沉淀", () => {
    const out = resolveDrop(vessel("beaker"), rack("cuso4"), ["naoh"]);
    expect(out.fx).toBe("precipitate");
    expect(out.phenomena.precipitate?.color).toBe("#81D4FA");
    expect(out.phenomena.precipitate?.label).toContain("氢氧化铜");
    expect(out.caption).toContain("Cu(OH)₂↓");
  });

  it("碘化钾 + 硝酸银：黄色 AgI 沉淀", () => {
    const out = resolveDrop(vessel("flask"), rack("agno3"), ["ki"]);
    expect(out.ok).toBe(true);
    expect(out.phenomena.precipitate?.color).toBe("#FFF59D");
    expect(out.caption).toContain("AgI↓");
  });

  it("试管 A（种子是稀盐酸）+ 碳酸钠：剧烈冒泡，走 bubbles 动画", () => {
    const out = resolveDrop(vessel("tube-a"), rack("na2co3"), VESSEL_SEED["tube-a"]);
    expect(out.ok).toBe(true);
    expect(out.fx).toBe("bubbles");
    expect(out.phenomena.gas?.label).toContain("二氧化碳");
    expect(out.phenomena.gas?.label).toContain("CO2");
    expect(out.caption).toContain("CO₂↑");
  });

  it("试管 A 的场景种子就是盐酸：拖 Na₂CO₃ 必定命中 CO₂ 现象，而不是“无现象”", () => {
    expect(VESSEL_SEED["tube-a"]).toEqual(["hcl"]);
    const out = resolveDrop(vessel("tube-a"), rack("na2co3"), VESSEL_SEED["tube-a"]);
    expect(out.ok).toBe(true);
    expect(out.matchedId).toBe("na2co3-hcl-co2");
    expect(out.phenomena.gas).toBeDefined();
  });

  it("硫氰酸钾 + 氯化铁：血红 [Fe(SCN)]²⁺，走 color 动画", () => {
    const out = resolveDrop(vessel("tube-b"), rack("fecl3"), ["kscn"]);
    expect(out.fx).toBe("color");
    expect(out.phenomena.colorChange?.to).toBe("血红");
    expect(out.phenomena.colorChange?.toHex).toBe("#8B0000");
    expect(out.caption).toContain("[Fe(SCN)]²⁺");
  });

  it("酚酞 + 氢氧化钠：变粉红，颜色映射到 CSS 色", () => {
    const out = resolveDrop(vessel("beaker"), rack("phenolphthalein"), ["naoh"]);
    expect(out.fx).toBe("color");
    expect(out.phenomena.colorChange?.to).toBe("粉红");
    expect(out.phenomena.colorChange?.toHex).toBe("#F48FB1");
  });

  it("氢氧化钠 + 盐酸：中和放热，无可见现象但有 heat 标记", () => {
    const out = resolveDrop(vessel("beaker"), rack("hcl"), ["naoh"]);
    expect(out.ok).toBe(true);
    expect(out.fx).toBe("heat");
    expect(out.phenomena.heat).toBe(true);
    expect(out.caption).toContain("H₂O");
    expect(out.note).toContain("中和");
  });

  it("氯化银 + 氨水：沉淀溶解，没有主动画（fx none）但有方程式", () => {
    const out = resolveDrop(vessel("flask"), reagentOf("nh3"), ["agcl"]);
    expect(out.ok).toBe(true);
    expect(out.fx).toBe("none");
    expect(out.phenomena.precipitate?.label).toContain("溶解");
    expect(out.caption).toContain("AgCl");
    expect(out.caption).toContain("[Ag(NH₃)₂]⁺");
  });

  it("铋酸钠 + 盐酸：可见黄绿色 Cl₂，走 smoke 动画", () => {
    const out = resolveDrop(vessel("flask"), rack("hcl"), ["nabio3"]);
    expect(out.ok).toBe(true);
    expect(out.fx).toBe("smoke");
    expect(out.phenomena.gas?.label).toContain("氯气");
    expect(out.caption).toContain("Cl₂↑");
  });
});

describe("resolveDrop · 未命中与边界", () => {
  it("本课程没有收录的组合：温和提示，不给假现象", () => {
    const out = resolveDrop(vessel("flask"), rack("cuso4"), ["nacl"]);
    expect(out.ok).toBe(false);
    expect(out.fx).toBe("none");
    expect(out.caption).toBe(MISS_CAPTION);
    expect(out.phenomena).toEqual({});
  });

  it("空器皿里只投一种试剂：不报错、不编反应", () => {
    const out = resolveDrop(vessel("flask"), rack("agno3"), []);
    expect(out.ok).toBe(false);
    expect(out.fx).toBe("none");
  });

  it("未知物质 id：安全返回未命中，不抛错", () => {
    const ghost: SceneReagent = {
      id: "unobtainium",
      name: "未知试剂",
      formula: "Xx",
      colorHex: "#999999",
      ghs: [],
      unit: "—",
    };
    const out = resolveDrop(vessel("flask"), ghost, ["nacl"]);
    expect(out.ok).toBe(false);
    expect(out.caption).toBe(MISS_CAPTION);
    expect(out.hint).toBeTruthy();
  });

  it("滴定管不接受投加，给出明确操作提示", () => {
    const out = resolveDrop(vessel("burette"), rack("agno3"), []);
    expect(out.ok).toBe(false);
    expect(out.fx).toBe("none");
    expect(out.caption).toContain("滴定管");
    expect(out.hint).toBe("burette-not-target");
  });

  it("硝酸银 → 滴定管：拒收文案说清规范，不复用“没有明显现象”那句", () => {
    const out = resolveDrop(vessel("burette"), rack("agno3"), []);
    expect(out.ok).toBe(false);
    expect(out.caption).toContain("滴定管");
    expect(out.caption).toContain("标准溶液");
    expect(out.caption).not.toBe(MISS_CAPTION);
    expect(out.caption).not.toContain("没有明显现象");
  });

  it("已存在物质里有未收录 id 时按未命中处理，不抛错", () => {
    const out = resolveDrop(vessel("flask"), rack("agno3"), ["nacl", "mystery"]);
    expect(out.ok).toBe(false);
  });

  it("判定是纯函数：同一输入两次结果一致，且不改 alreadyIn", () => {
    const alreadyIn = ["nacl"] as const;
    const first = resolveDrop(vessel("flask"), rack("agno3"), alreadyIn);
    const second = resolveDrop(vessel("flask"), rack("agno3"), alreadyIn);
    expect(second).toEqual(first);
    expect(alreadyIn).toEqual(["nacl"]);
  });
});

describe("现象表与文案的完整性", () => {
  it("每条已收录现象都有真实化学方程式 caption", () => {
    const missing = PHENOMENA.filter((entry) => !equationFor(entry.id)).map((entry) => entry.id);
    expect(missing).toEqual([]);
  });

  it("所有 caption 都带化学式或离子式（含 Unicode 上下标/箭头）", () => {
    const samples = [
      resolveDrop(vessel("flask"), rack("agno3"), ["nacl"]),
      resolveDrop(vessel("tube-a"), rack("hcl"), ["na2co3"]),
      resolveDrop(vessel("tube-b"), rack("fecl3"), ["kscn"]),
      resolveDrop(vessel("beaker"), rack("hcl"), ["naoh"]),
    ];
    for (const out of samples) {
      expect(out.caption).toMatch(/[A-Z][a-z]?|↓|↑|→|⇌/);
      expect(out.caption).not.toContain("undefined");
    }
  });

  it("试剂与器皿配置自洽：种子物质都在物质表里，滴定管不可投加", () => {
    expect(SCENE_VESSELS.length).toBeGreaterThanOrEqual(4);
    for (const id of ["nacl", "naoh", "hcl", "kscn"]) {
      expect(requireSubstance(id).formula.length).toBeGreaterThan(0);
    }
    expect(vessel("burette").kind).toBe("burette");
  });
});
