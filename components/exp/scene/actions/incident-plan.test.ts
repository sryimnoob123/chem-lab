import { describe, expect, it } from "vitest";
import { SCENE_VESSELS } from "@/lib/scene/palette";
import { planIncident, vesselFromText } from "./incident-plan";

/**
 * 事故演出的参数推导：真操作与错误演示都读这一份，
 * 所以这里断言的是「哪条陷阱 → 哪台器皿、哪种起手、哪种炸法」。
 */

const VESSELS = SCENE_VESSELS.map((vessel) => ({ id: vessel.id, label: vessel.label }));

describe("vesselFromText", () => {
  it("从陷阱文案里认出器皿（量程后缀不影响）", () => {
    expect(vesselFromText("把容量瓶、量筒放进 105 ℃ 烘箱烘干", VESSELS)).toBe("volumetric");
    expect(vesselFromText("拿玻璃棒在容量瓶里搅洗", VESSELS)).toBe("volumetric");
    expect(vesselFromText("把水沿壁倒入盛浓硫酸的烧杯", VESSELS)).toBe("beaker");
  });

  it("认不出来就返回 null（宁可不演，也不硬塞到不相干的器皿上）", () => {
    expect(vesselFromText("用嘴吸液", VESSELS)).toBeNull();
    expect(vesselFromText("", VESSELS)).toBeNull();
  });
});

describe("planIncident", () => {
  const trap = (over: Partial<{ choiceId: string; type: "wash" | "dilute" | "weigh"; label: string; fx?: string; op?: "pour" | "heat" | "stir" | "poke" }>) => ({
    choiceId: over.choiceId ?? "t1",
    type: over.type ?? "wash",
    label: over.label ?? "拿玻璃棒在容量瓶里搅洗",
    hazard: {
      ruleId: "r1",
      level: "L3" as const,
      deduct: 8,
      competency: "S2" as const,
      terminate: false,
      feedback: { severity: "danger" as const, title: "瓶壁裂纹" },
      ...(over.fx ? { fx: over.fx as "glass-break" } : {}),
      ...(over.op ? { op: over.op } : {}),
    },
  });

  it("器皿上的事故：给出 fx / op / 落点 / 起手台词", () => {
    const plan = planIncident({
      choice: trap({ fx: "glass-break", op: "poke" }),
      vessels: VESSELS,
      fromVesselId: null,
    });
    expect(plan).toMatchObject({
      fx: "glassBreak",
      op: "poke",
      vesselId: "volumetric",
      from: null,
    });
    expect(plan?.caption).toBe("玻璃棒在器皿里捅洗…");
  });

  it("op 缺省时按动作原语兜底（加热 → heat，倒液 → pour）", () => {
    expect(planIncident({ choice: trap({ type: "wash", fx: "glass-break" }), vessels: VESSELS })?.op).toBe("poke");
    expect(
      planIncident({ choice: trap({ type: "dilute", label: "把水倒进烧杯", fx: "explosion" }), vessels: VESSELS })?.op,
    ).toBe("pour");
  });

  it("落点优先级：点中的器皿 > 陷阱文案点名的器皿 > 本步亮着的器皿", () => {
    const choice = trap({ type: "dilute", label: "把水倒进烧杯", fx: "explosion" });
    // 真操作点的是锥形瓶 → 事故长在锥形瓶上
    expect(planIncident({ choice, vessels: VESSELS, vesselId: "flask", cueVesselId: "beaker" })?.vesselId).toBe("flask");
    // 演示不传点中的器皿 → 陷阱文案说「烧杯」就演烧杯，不被本步器皿盖掉
    expect(planIncident({ choice, vessels: VESSELS, cueVesselId: "volumetric" })?.vesselId).toBe("beaker");
    // 文案没点名、也不传点中的器皿 → 退回本步器皿
    expect(
      planIncident({ choice: trap({ fx: "glass-break", op: "stir", label: "搅洗" }), vessels: VESSELS, cueVesselId: "beaker" })
        ?.vesselId,
    ).toBe("beaker");
    // 倒液来源：上一台器皿（不等于落点才算）
    expect(
      planIncident({ choice, vessels: VESSELS, fromVesselId: "tube-a" })?.from,
    ).toBe("tube-a");
  });

  it("不在器皿上发生的事故、没有特效的陷阱 → 不演（回退覆盖层/只出说明）", () => {
    expect(planIncident({ choice: trap({ fx: "device-accident" }), vessels: VESSELS })).toBeNull();
    expect(planIncident({ choice: trap({ fx: "heavy-metal" }), vessels: VESSELS })).toBeNull();
    expect(planIncident({ choice: trap({}), vessels: VESSELS })).toBeNull();
    expect(planIncident({ choice: null, vessels: VESSELS })).toBeNull();
  });

  it("同一份参数两次结果一致（纯函数，可直接重放）", () => {
    const input = { choice: trap({ fx: "glass-break", op: "heat" as const }), vessels: VESSELS };
    expect(planIncident(input)).toEqual(planIncident(input));
  });
});
