import { describe, expect, it } from "vitest";
import { DROPPABLE_KINDS, SCENE_VESSELS, getSceneVessel } from "./palette";
import { REAGENTS, REAGENT_GROUPS, getSceneReagent } from "./reagents";

describe("exp01 场景资产", () => {
  it("容量瓶已注册且可投放（点选高亮自动生效）", () => {
    const v = getSceneVessel("volumetric");
    expect(v).toBeDefined();
    expect(v?.kind).toBe("volumetric");
    expect(DROPPABLE_KINDS.has("volumetric")).toBe(true);
    // 旧规则不变：滴定管仍不接受投加
    expect(DROPPABLE_KINDS.has("burette")).toBe(false);
  });

  it("器皿 id 唯一、坐标在画布内", () => {
    const ids = SCENE_VESSELS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of SCENE_VESSELS) {
      expect(v.x, v.id).toBeGreaterThanOrEqual(0);
      expect(v.y, v.id).toBeGreaterThanOrEqual(0);
      expect(v.x + v.w, v.id).toBeLessThanOrEqual(940);
      expect(v.y + v.h, v.id).toBeLessThanOrEqual(420);
    }
  });

  it("exp01 三个货架条目存在，demo-id 按规则命名", () => {
    const expected = {
      "na2co3-solid": "demo-scene-reagent-na2co3-solid",
      "h2so4-conc": "demo-scene-reagent-h2so4-conc",
      water: "demo-scene-reagent-water",
    };
    for (const [id, demoId] of Object.entries(expected)) {
      const reagent = getSceneReagent(id);
      expect(reagent, id).toBeDefined();
      expect(reagent?.demoId).toBe(demoId);
      expect(reagent?.group).toBe("exp01");
    }
  });

  it("旧 id 一律保留（na2co3 / h2so4 未被改掉）", () => {
    expect(getSceneReagent("na2co3")?.demoId).toBe("demo-scene-reagent-na2co3");
    expect(getSceneReagent("h2so4")?.demoId).toBe("demo-scene-reagent-h2so4");
  });

  it("货架分组有序、demo-id 全局唯一", () => {
    expect(REAGENT_GROUPS.map((g) => g.id)).toEqual(["exp09", "exp01", "common"]);
    const ids = REAGENTS.map((r) => r.demoId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of REAGENTS) expect(r.colorHex).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
