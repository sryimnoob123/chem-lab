import { describe, expect, it } from "vitest";
import { exp09Definition } from "@/experiments/exp09/definition";
import { DEMO_STEPS, getDemoStep } from "./steps";

describe("7 步双分支演示数据", () => {
  it("7 步全部来自 exp09 definition，步号连续", () => {
    expect(DEMO_STEPS).toHaveLength(7);
    expect(DEMO_STEPS.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(DEMO_STEPS.map((s) => s.title)).toEqual(exp09Definition.steps.map((s) => s.title));
  });

  it("每步至少有 1 个规范操作和 1 个风险操作", () => {
    for (const step of DEMO_STEPS) {
      expect(step.choices.filter((c) => c.ok).length, `第 ${step.index} 步缺 correct`).toBeGreaterThan(0);
      expect(step.choices.filter((c) => !c.ok).length, `第 ${step.index} 步缺 trap`).toBeGreaterThan(0);
    }
  });

  it("失败分支两行文案都非空：错在哪 + 为什么", () => {
    for (const step of DEMO_STEPS) {
      for (const trap of step.choices.filter((c) => !c.ok)) {
        expect(trap.title.trim().length, `${trap.id} 缺“错在哪”`).toBeGreaterThan(0);
        expect(trap.detail.trim().length, `${trap.id} 缺“为什么”`).toBeGreaterThan(0);
      }
    }
  });

  it("成功分支文案非空（label 或 definition 的 observation）", () => {
    for (const step of DEMO_STEPS) {
      for (const ok of step.choices.filter((c) => c.ok)) {
        expect(ok.title.trim().length).toBeGreaterThan(0);
        expect(ok.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("第 2 步“水入酸”是 L4 终止，且只允许重新演示", () => {
    const step2 = getDemoStep(2);
    expect(step2).toBeDefined();
    const traps = step2?.choices.filter((c) => !c.ok) ?? [];
    const l4 = traps.find((t) => t.terminate);
    expect(l4, "第 2 步应有 terminate 的 trap").toBeDefined();
    expect(l4?.level).toBe("L4");
    expect(l4?.fx).toBe("boilOver");
    // 其余步骤不得有终止项
    const otherTerminates = DEMO_STEPS.filter((s) => s.index !== 2).flatMap((s) => s.choices.filter((c) => c.terminate));
    expect(otherTerminates).toEqual([]);
  });

  it("definition 里有 fx 的陷阱都映射到场景特效用例（camelCase）", () => {
    const withFx = DEMO_STEPS.flatMap((s) => s.choices.filter((c) => !c.ok && c.fx));
    expect(withFx.length).toBeGreaterThan(0);
    for (const trap of withFx) {
      expect(["explosion", "toxicGas", "fire", "boilOver", "burn", "glassBreak", "heavyMetal", "deviceAccident"]).toContain(trap.fx);
    }
  });
});
