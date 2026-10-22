/**
 * coach-plan 单测：演示引导的路线必须指到「这一步真的该动的那个东西」。
 * 数据取 exp01 的真实步骤文案（第 1/4/6/7 步），器皿/工具用场景里的真 id。
 */

import { describe, expect, it } from "vitest";
import { buildCoachPlan, vesselFromText, COACH_SELECTOR } from "./coach-plan";

const VESSELS = [
  { id: "flask", label: "锥形瓶" },
  { id: "beaker", label: "烧杯" },
  { id: "volumetric", label: "容量瓶 100 mL" },
  { id: "burette", label: "酸式滴定管" },
] as const;

const TOOLS = [
  { id: "pipette", label: "移液管" },
  { id: "rod", label: "玻璃棒" },
  { id: "wash-bottle", label: "洗瓶" },
  { id: "cylinder", label: "量筒" },
] as const;

describe("buildCoachPlan · exp01", () => {
  it("第 1 步洗涤：从容量瓶拖进洗涤槽", () => {
    const plan = buildCoachPlan({
      key: "exp01:0:step1-dry",
      type: "wash",
      label: "拖进洗涤槽：冲洗→刷洗→淋洗→倒置晾干",
      vessels: VESSELS,
      cueVesselId: "volumetric",
    });
    expect(plan.gesture).toBe("drag");
    expect(plan.from).toBe(COACH_SELECTOR.vessel("volumetric"));
    expect(plan.to).toBe(COACH_SELECTOR.sink);
    expect(plan.action).toContain("容量瓶");
    expect(plan.vesselId).toBe("volumetric");
  });

  it("第 4 步溶解：从洗瓶拖到烧杯（文案点名烧杯）", () => {
    const plan = buildCoachPlan({
      key: "exp01:3:step4-rinse",
      type: "dissolve",
      label: "洗瓶给烧杯加水溶解，玻璃棒引流并入容量瓶",
      vessels: VESSELS,
      reagentId: "water",
      reagentName: "蒸馏水",
      cueVesselId: "beaker",
      stepHow: "拿洗瓶往烧杯里加约 30 mL 蒸馏水，用玻璃棒搅拌到固体完全溶解；再沿玻璃棒把溶液转入容量瓶。",
    });
    // 溶解只可能在烧杯里做：文案后面虽然提到容量瓶，落点仍是烧杯
    expect(plan.to).toBe(COACH_SELECTOR.vessel("beaker"));
    expect(plan.from).toBe(COACH_SELECTOR.reagent("water"));
    expect(plan.action).toContain("蒸馏水");
    expect(plan.action).toContain("烧杯");
  });

  it("第 6 步移液：文案写着放入锥形瓶，就从移液管拖到锥形瓶", () => {
    const plan = buildCoachPlan({
      key: "exp01:5:step6-drain",
      type: "transfer",
      label: "移液管润洗后吸液，管尖靠壁放出",
      vessels: VESSELS,
      tools: TOOLS,
      cueVesselId: "volumetric",
      stepHow: "拿移液管：先用待取液润洗 3 次，排尽管尖气泡，移取 25.00 mL 放入锥形瓶。",
    });
    expect(plan.from).toBe(COACH_SELECTOR.tool("pipette"));
    expect(plan.to).toBe(COACH_SELECTOR.vessel("flask"));
    expect(plan.gesture).toBe("drag");
  });

  it("第 7 步稀释浓硫酸：从浓硫酸瓶拖到烧杯", () => {
    const plan = buildCoachPlan({
      key: "exp01:6:step7-label",
      type: "transfer",
      label: "量浓硫酸沿玻璃棒注入 250 mL 烧杯的水中→冷却→转入试剂瓶贴标签",
      vessels: VESSELS,
      reagentId: "h2so4-conc",
      reagentName: "浓硫酸",
      tools: TOOLS,
      cueVesselId: "beaker",
    });
    expect(plan.from).toBe(COACH_SELECTOR.reagent("h2so4-conc"));
    expect(plan.to).toBe(COACH_SELECTOR.vessel("beaker"));
  });

  it("称量类步骤：点天平，不做拖拽路线", () => {
    const plan = buildCoachPlan({
      key: "exp01:1:step2-calibrate",
      type: "calibrate",
      label: "点天平：调平→软毛刷取放称量瓶→预热内校",
      vessels: VESSELS,
    });
    expect(plan.gesture).toBe("tap");
    expect(plan.from).toBeNull();
    expect(plan.to).toBe(COACH_SELECTOR.balance);
  });

  it("文案里没有器皿名时退回场景线索器皿", () => {
    const plan = buildCoachPlan({
      key: "exp01:4:step5-shake",
      type: "dilute",
      label: "洗瓶加到刻度下方→滴管定容→盖塞倒转摇匀",
      vessels: VESSELS,
      reagentId: "water",
      reagentName: "蒸馏水",
      cueVesselId: "volumetric",
    });
    expect(plan.to).toBe(COACH_SELECTOR.vessel("volumetric"));
  });
});

describe("vesselFromText", () => {
  it("最长匹配优先：容量瓶 100 mL 不会被当成别的器皿", () => {
    expect(vesselFromText("沿玻璃棒转入容量瓶，烧杯洗 3 次", VESSELS)).toBe("volumetric");
  });

  it("没有点名就返回 null，交给调用方兜底", () => {
    expect(vesselFromText("盖上塞子倒转摇匀", VESSELS)).toBeNull();
  });
});
