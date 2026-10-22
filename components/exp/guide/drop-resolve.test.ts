import { describe, expect, it } from "vitest";
import type { ChoiceDefinition, StepDefinition } from "@/lib/engine.types";
import { POUR_MS, REJECT_MS, SNAP_MS, nextReagentId, reagentTokens, resolveDrop } from "./drop-resolve";

function choice(overrides: Partial<ChoiceDefinition> & Pick<ChoiceDefinition, "choiceId" | "label" | "type">): ChoiceDefinition {
  return {
    role: "correct",
    competency: "S2",
    demoId: `demo-${overrides.choiceId}`,
    completesStep: false,
    ...overrides,
  };
}

function step(choices: ChoiceDefinition[]): StepDefinition {
  return {
    index: 0,
    title: "测试步",
    scene: "滴定台",
    demoId: "demo-step",
    judge: { criterion: "判据", competency: ["S2"] },
    hints: { h0: "h0", h1: "h1", h2: "h2", h3: "h3" },
    accepts: choices.map((item) => item.choiceId),
    choices,
  };
}

describe("resolveDrop", () => {
  it("加酚酞：本步正确动作与试剂对得上 → 接受", () => {
    const target = choice({
      choiceId: "step5-indicator",
      label: "加 2 滴酚酞，轻摇锥形瓶使混匀",
      type: "addDrops",
      params: { drops: 2, indicator: "phenolphthalein" },
    });
    const verdict = resolveDrop(step([target]), "phenolphthalein", new Set());
    expect(verdict).toEqual({
      kind: "accept",
      choiceId: "step5-indicator",
      label: "加 2 滴酚酞，轻摇锥形瓶使混匀",
    });
  });

  it("前置动作没做完 → 拒收并点名缺的那一步", () => {
    const target = choice({
      choiceId: "step5-indicator",
      label: "加 2 滴酚酞",
      type: "addDrops",
      requires: ["step5-pipette"],
    });
    const pipette = choice({ choiceId: "step5-pipette", label: "移取 HCl 25.00 mL", type: "transfer" });
    const verdict = resolveDrop(step([pipette, target]), "phenolphthalein", new Set());
    expect(verdict.kind).toBe("reject");
    if (verdict.kind !== "reject") return;
    expect(verdict.line).toContain("移取 HCl");
  });

  it("只有陷阱动作和这瓶试剂相关 → 拒收并给一句为什么", () => {
    const trap = choice({
      choiceId: "step5-excess-indicator",
      label: "加 5~6 滴酚酞使颜色明显加深",
      type: "addDrops",
      role: "trap",
      hazard: {
        ruleId: "exp09-H11",
        level: "L1",
        deduct: 3,
        competency: "S2",
        terminate: false,
        feedback: {
          severity: "warn",
          title: "指示剂过量：终点提前 0.02~0.05 mL",
          why: "指示剂本身是弱酸。",
          correct: "2 滴即可。",
        },
      },
    });
    const verdict = resolveDrop(step([trap]), "phenolphthalein", new Set());
    expect(verdict.kind).toBe("reject");
    if (verdict.kind !== "reject") return;
    expect(verdict.line).toContain("指示剂过量");
  });

  it("本步不加试剂（读数步）→ 拒收并提示该做的动作", () => {
    const read = choice({
      choiceId: "step6-read-end",
      label: "粉红色 30 s 不褪即为终点，立即读终读数",
      type: "readInstrument",
    });
    const verdict = resolveDrop(step([read]), "naoh", new Set());
    expect(verdict.kind).toBe("reject");
    if (verdict.kind !== "reject") return;
    expect(verdict.line).toContain("读数");
  });

  it("试剂名与文案对得上（蒸馏水 → 加水溶解）", () => {
    const dissolve = choice({
      choiceId: "step2-dissolve",
      label: "加 40 mL 蒸馏水溶解粗盐",
      type: "dissolve",
    });
    expect(resolveDrop(step([dissolve]), "water", new Set()).kind).toBe("accept");
  });

  it("token 归一化：下标化学式能对上（Na₂CO₃ → na2co3）", () => {
    const tokens = reagentTokens("na2co3-solid");
    expect(tokens).toContain("na2co3");
    const dissolve = choice({
      choiceId: "step1-weigh",
      label: "称取 Na₂CO₃ 试样",
      type: "dissolve",
    });
    expect(resolveDrop(step([dissolve]), "na2co3-solid", new Set()).kind).toBe("accept");
  });

  it("时序与 style 口径一致：吸附 160 / 倒入 1160 / 拒收 240", () => {
    expect(SNAP_MS).toBe(160);
    // 倒入动画 2026-10-22 加长到 1160ms（= pour.tsx 的 TOTAL_MS）：
    // 飞行 290 + 倾转 180 + 液柱与液滴 + 飞回 250，700ms 演不完"举瓶倒水"这一段。
    expect(POUR_MS).toBe(1160);
    expect(REJECT_MS).toBe(240);
  });
});

describe("nextReagentId（场景指引：下一步该用哪瓶）", () => {
  const RACK = ["naoh", "hcl", "phenolphthalein", "methylOrange"] as const;

  it("本步正确动作提到某瓶试剂 → 点亮那一瓶", () => {
    const titrate = choice({ choiceId: "step5-titrate", label: "用氢氧化钠滴定至终点", type: "titrate" });
    expect(nextReagentId(step([titrate]), new Set(), RACK)).toBe("naoh");
  });

  it("本步做过了 / 前置没满足 → 不点亮（拿不准就不指引）", () => {
    const titrate = choice({ choiceId: "step5-titrate", label: "用氢氧化钠滴定至终点", type: "titrate" });
    expect(nextReagentId(step([titrate]), new Set(["step5-titrate"]), RACK)).toBeNull();

    const gated = choice({
      choiceId: "step5-titrate",
      label: "用氢氧化钠滴定至终点",
      type: "titrate",
      requires: ["step4-dye"],
    });
    expect(nextReagentId(step([gated]), new Set(), RACK)).toBeNull();
  });

  it("只有陷阱动作匹配时不点亮（保持与 resolveDrop 同一套匹配）", () => {
    const trap = choice({
      choiceId: "step1-hands",
      label: "直接用手拿氢氧化钠固体",
      type: "addDrops",
      role: "trap",
    });
    expect(nextReagentId(step([trap]), new Set(), RACK)).toBeNull();
  });

  it("没有可倒动作（读数/称量）→ 不点亮", () => {
    const read = choice({ choiceId: "step2-read", label: "读取滴定管读数", type: "readInstrument" });
    expect(nextReagentId(step([read]), new Set(), RACK)).toBeNull();
  });
});
