/**
 * experiments/exp09/definition.test.ts —— 实验定义的结构校验。
 * 目标：规格 §6（7 步动作表）/ §7（事故表）/ 接口契约 §1、§2、§10 都能在这里对上，
 * 保证 UI、规则层、时间线拿到的定义是自洽的，不会等到页面里才发现缺动作/缺陷阱。
 */

import { describe, expect, it } from "vitest";

import {
  ACTION_TYPES,
  type ActionType,
  type ChoiceDefinition,
  type CompetencyCode,
  type IncidentLevel,
  type StepDefinition,
} from "../../lib/engine.types";
import { EXP09_STEP_DEMO_IDS, exp09Definition } from "./definition";

/** docs/实验库/exp09.md §6 最后一列（逐字抄，改规格才改这里）。 */
const SPEC_DEMO_IDS = [
  "exp09-step1-naoh",
  "exp09-step2-hcl",
  "exp09-step3-wash",
  "exp09-step4-fill",
  "exp09-step5-pipette",
  "exp09-step6-titrate",
  "exp09-step7-compute",
] as const;

const SPEC_COMPETENCIES: CompetencyCode[] = ["K1", "K2", "S1", "S2", "A1"];

/** 判分表（契约 §5，固定）：L1 2~3 / L2 5 / L3 8~10 / L4 15~20。 */
const LEVEL_SCORE: Record<IncidentLevel, readonly [number, number]> = {
  L1: [2, 3],
  L2: [5, 5],
  L3: [8, 10],
  L4: [15, 20],
};

const allChoices = (): ChoiceDefinition[] => exp09Definition.steps.flatMap((step) => [...step.choices]);
const allSteps = (): StepDefinition[] => [...exp09Definition.steps];
const allTraps = (): ChoiceDefinition[] => allChoices().filter((choice) => choice.role === "trap");

describe("实验定义骨架", () => {
  it("expId / 标题 / 能力点与规格一致", () => {
    expect(exp09Definition.id).toBe("exp09");
    expect(exp09Definition.title).toBe("酸碱标准溶液的配制与浓度比较");
    expect([...exp09Definition.competencies]).toEqual(SPEC_COMPETENCIES);
  });

  it("7 步、index 连续且与数组下标一致", () => {
    expect(exp09Definition.steps).toHaveLength(7);
    exp09Definition.steps.forEach((step, position) => {
      expect(step.index).toBe(position);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.scene.length).toBeGreaterThan(0);
    });
  });

  it("步级 data-demo-id 与规格 §6 最后一列逐字一致", () => {
    expect([...EXP09_STEP_DEMO_IDS]).toEqual([...SPEC_DEMO_IDS]);
    expect(exp09Definition.steps.map((step) => step.demoId)).toEqual([...SPEC_DEMO_IDS]);
  });

  it("动作级 data-demo-id 符合契约 §10 命名且全局唯一", () => {
    const ids = allChoices().map((choice) => choice.demoId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^demo-op-step[1-7]-[a-z0-9-]+$/);
    const stepIds = exp09Definition.steps.map((step) => step.demoId);
    expect(new Set([...stepIds, ...ids]).size).toBe(stepIds.length + ids.length);
  });
});

describe("每步动作白名单", () => {
  it("每步至少 2 个动作、至少 1 个陷阱、至少 1 个能结束本步的正确动作", () => {
    for (const step of exp09Definition.steps) {
      const label = `步骤 ${step.index + 1}`;
      expect(step.choices.length, label).toBeGreaterThanOrEqual(2);
      expect(step.choices.some((choice) => choice.role === "trap"), label).toBe(true);
      expect(
        step.choices.some((choice) => choice.role === "correct" && choice.completesStep),
        label,
      ).toBe(true);
    }
  });

  it("accepts 与 choices 完全一致（无遗漏、无幽灵动作）", () => {
    for (const step of allSteps()) {
      const choiceIds = step.choices.map((choice) => choice.choiceId).sort();
      expect([...step.accepts].sort(), `步骤 ${step.index + 1}`).toEqual(choiceIds);
      expect(new Set(step.accepts).size).toBe(step.accepts.length);
    }
  });

  it("choiceId 全局唯一、动作原语合法", () => {
    const ids = allChoices().map((choice) => choice.choiceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const choice of allChoices()) {
      expect(ACTION_TYPES, choice.choiceId).toContain(choice.type as ActionType);
      expect(choice.label.length).toBeGreaterThan(0);
      expect(SPEC_COMPETENCIES).toContain(choice.competency);
    }
  });

  it("每步有判据与提示阶梯 H0~H3，H4 为元认知提示", () => {
    for (const step of allSteps()) {
      const label = `步骤 ${step.index + 1}`;
      expect(step.judge.criterion.length, label).toBeGreaterThan(8);
      expect(step.judge.competency.length, label).toBeGreaterThanOrEqual(1);
      for (const code of step.judge.competency) expect(SPEC_COMPETENCIES).toContain(code);
      expect(step.hints.h0.length, label).toBeGreaterThan(0);
      expect(step.hints.h1.length, label).toBeGreaterThan(0);
      expect(step.hints.h2.length, label).toBeGreaterThan(0);
      expect(step.hints.h3.length, label).toBeGreaterThan(0);
      expect(step.hints.h4?.length ?? 0, label).toBeGreaterThan(0);
    }
  });

  it("结束本步的动作都声明了前置动作，且前置都在同一步白名单里", () => {
    for (const step of allSteps()) {
      for (const choice of step.choices) {
        if (choice.role !== "correct" || !choice.completesStep) continue;
        expect(choice.requires?.length ?? 0, choice.choiceId).toBeGreaterThan(0);
        for (const prerequisite of choice.requires ?? []) {
          expect(step.accepts, choice.choiceId).toContain(prerequisite);
          expect(prerequisite, choice.choiceId).not.toBe(choice.choiceId);
        }
      }
      // 非完成动作不得反过来要求完成动作，否则流程卡死
      const completing = new Set(
        step.choices.filter((choice) => choice.completesStep).map((choice) => choice.choiceId),
      );
      for (const choice of step.choices) {
        for (const prerequisite of choice.requires ?? []) {
          if (choice.completesStep) continue;
          expect(completing.has(prerequisite), choice.choiceId).toBe(false);
        }
      }
    }
  });

  it("步骤声明的能力点覆盖规格 §1 的 5 个能力点", () => {
    const covered = new Set<CompetencyCode>();
    for (const step of allSteps()) for (const code of step.judge.competency) covered.add(code);
    for (const choice of allChoices()) covered.add(choice.competency);
    for (const code of SPEC_COMPETENCIES) expect([...covered]).toContain(code);
  });
});

describe("陷阱与事故表（规格 §7）", () => {
  it("每个陷阱都有后果声明，正确动作不得带后果", () => {
    for (const trap of allTraps()) {
      expect(trap.hazard, trap.choiceId).toBeDefined();
      expect(trap.completesStep).toBe(false);
      expect(trap.hazard?.feedback.title.length ?? 0, trap.choiceId).toBeGreaterThan(0);
      expect(trap.hazard?.feedback.why?.length ?? 0, trap.choiceId).toBeGreaterThan(0);
      expect(trap.hazard?.feedback.correct?.length ?? 0, trap.choiceId).toBeGreaterThan(0);
      expect(trap.hazard?.feedback.refs?.length ?? 0, trap.choiceId).toBeGreaterThan(0);
    }
    for (const choice of allChoices().filter((item) => item.role === "correct")) {
      expect(choice.hazard, choice.choiceId).toBeUndefined();
    }
  });

  it("事故 id / 等级 / 扣分符合判分表，L4 必须 terminate", () => {
    for (const trap of allTraps()) {
      const consequence = trap.hazard;
      if (!consequence) throw new Error(`missing-hazard:${trap.choiceId}`);
      expect(consequence.ruleId).toMatch(/^exp09-H\d+$/);
      expect(consequence.ruleId).toBe(consequence.incidentId ?? consequence.ruleId);
      const [min, max] = LEVEL_SCORE[consequence.level];
      expect(consequence.deduct, consequence.ruleId).toBeGreaterThanOrEqual(min);
      expect(consequence.deduct, consequence.ruleId).toBeLessThanOrEqual(max);
      if (consequence.level === "L4") expect(consequence.terminate, consequence.ruleId).toBe(true);
      if (consequence.terminate) expect(consequence.level, consequence.ruleId).toBe("L4");
      if (consequence.fx) expect(consequence.incidentId, consequence.ruleId).toBeDefined();
      if (consequence.level === "L1" || consequence.level === "L2") expect(consequence.fx).toBeUndefined();
    }
  });

  it("事故清单数量与规格一致：L4×1 / L3×3 / L2×6 / L1×4", () => {
    const byLevel = (level: IncidentLevel): number =>
      allTraps().filter((trap) => trap.hazard?.level === level).length;
    expect(byLevel("L4")).toBe(1);
    expect(byLevel("L3")).toBe(3);
    expect(byLevel("L2")).toBe(6);
    expect(byLevel("L1")).toBe(4);
    expect(allTraps()).toHaveLength(14);
  });

  it("唯一 L4 是步 2 的水入酸，视觉键 boil-over 且终止实验", () => {
    const l4 = allTraps().filter((trap) => trap.hazard?.level === "L4");
    expect(l4).toHaveLength(1);
    expect(l4[0].choiceId).toBe("step2-water-into-acid");
    expect(l4[0].hazard?.ruleId).toBe("exp09-H1");
    expect(l4[0].hazard?.fx).toBe("boil-over");
    expect(l4[0].hazard?.terminate).toBe(true);
    expect(l4[0].type).toBe("dilute");
  });

  it("要有 fx 的陷阱出现在步 1/2/4 的关键事故上", () => {
    const fxById = new Map(
      allTraps()
        .filter((trap) => trap.hazard?.fx)
        .map((trap) => [trap.hazard?.incidentId, trap.hazard?.fx]),
    );
    expect(fxById.get("exp09-H1")).toBe("boil-over");
    expect(fxById.get("exp09-H2")).toBe("burn");
    expect(fxById.get("exp09-H3")).toBe("glass-break");
    expect(fxById.get("exp09-H4")).toBe("device-accident");
  });
});

describe("createState", () => {
  it("返回新状态：第 0 步、未完成、器材齐全、簿记为空", () => {
    const state = exp09Definition.createState();
    expect(state.expId).toBe("exp09");
    expect(state.stepIndex).toBe(0);
    expect(state.attemptOfStep).toBe(0);
    expect(state.done).toBe(false);
    expect(state.stepLog).toEqual([]);
    expect(state.observations).toEqual([]);
    expect(state.violations).toEqual([]);
    expect(state.incidents).toEqual([]);
    expect(Object.keys(state.entities).length).toBeGreaterThanOrEqual(10);
  });

  it("每次调用都是深拷贝（不共享 entities / liquid）", () => {
    const first = exp09Definition.createState();
    const second = exp09Definition.createState();
    expect(first.entities).not.toBe(second.entities);
    first.entities["beaker-100"].liquid = { substance: "X", level: 1, color: "#000", opacity: 1 };
    first.entities["flask-1"].note = "改过";
    expect(second.entities["beaker-100"].liquid).toBeUndefined();
    expect(second.entities["flask-1"].note).not.toBe("改过");
    // 初始器材种类覆盖契约 EntityKind 的关键几类
    const kinds = new Set(Object.values(second.entities).map((entity) => entity.kind));
    for (const kind of ["balance", "beaker", "burette", "flask", "pipette", "cylinder", "stand", "wash"]) {
      expect([...kinds]).toContain(kind);
    }
  });
});
