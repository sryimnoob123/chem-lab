import { describe, expect, it } from "vitest";
import { BENCH } from "@/components/exp/scene/bench-layout";
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
    /* 画布上界跟着 BENCH 走（2026-10-23 台面放宽到 viewBox 20..1580 × bottom 560）：
       写死 940/420 是旧窄画布的数，器皿一挪到右侧就假报错。 */
    for (const v of SCENE_VESSELS) {
      expect(v.x, v.id).toBeGreaterThanOrEqual(0);
      expect(v.y, v.id).toBeGreaterThanOrEqual(0);
      expect(v.x + v.w, v.id).toBeLessThanOrEqual(BENCH.viewRight);
      expect(v.y + v.h, v.id).toBeLessThanOrEqual(BENCH.front);
      // 所有器皿底边都压在台面线上（BENCH.top；用户 2026-10-23：天平与器皿同一条线）
      expect(v.y + v.h, `${v.id} 底边`).toBeLessThanOrEqual(BENCH.top + 1);
    }
  });

  it("exp01 台面五只器皿互不重叠、不钻进右侧浮层面板区", () => {
    const ids = ["beaker", "volumetric", "flask", "tube-a", "tube-b"];
    const row = ids
      .map((id) => getSceneVessel(id))
      .filter((v): v is NonNullable<ReturnType<typeof getSceneVessel>> => Boolean(v))
      .sort((a, b) => a.x - b.x);
    expect(row).toHaveLength(ids.length);
    /* 右侧「任务 / 错误演示」浮层常驻压在台面上（1440×900 实测换算后左沿 ≈1299 单位），
       器皿落进去等于被面板吃掉一半；锥形瓶 2026-10-23 就是照这条线选的位。 */
    const PANEL_LEFT = 1290;
    for (const v of row) expect(v.x + v.w, `${v.id} 右沿`).toBeLessThanOrEqual(PANEL_LEFT);
    for (let i = 1; i < row.length; i += 1) {
      expect(row[i].x, `${row[i - 1].id} 与 ${row[i].id} 重叠`).toBeGreaterThanOrEqual(
        row[i - 1].x + row[i - 1].w,
      );
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
