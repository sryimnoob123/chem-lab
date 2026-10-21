/**
 * lib/engine.test.ts —— 状态机行为测试（纯逻辑，无 DOM / 无 IO）。
 * 覆盖：走通 7 步、非法跳步、非法动作、重复提交幂等、陷阱事件、提示阶梯、
 *       事故终止、applyIncident 入账、状态不可变、确定性。
 */

import { describe, expect, it } from "vitest";

import {
  apply,
  applyIncident,
  getDefinition,
  getStep,
  initState,
  listExperimentIds,
} from "./engine";
import type {
  Action,
  ChoiceDefinition,
  ExperimentState,
  Event,
  HintLevel,
  StepDefinition,
} from "./engine.types";
import { exp09Definition } from "../experiments/exp09/definition";

const START = (): ExperimentState => initState("exp09");

function findChoice(choiceId: string): ChoiceDefinition {
  for (const step of exp09Definition.steps) {
    for (const choice of step.choices) {
      if (choice.choiceId === choiceId) return choice;
    }
  }
  throw new Error(`choice-not-found:${choiceId}`);
}

function findStep(choiceId: string): StepDefinition {
  for (const step of exp09Definition.steps) {
    if (step.choices.some((choice) => choice.choiceId === choiceId)) return step;
  }
  throw new Error(`step-not-found:${choiceId}`);
}

/** 用定义里的真实 type/competency 构造 Action（引擎以定义为准）。 */
function actionOf(choiceId: string, overrides: Partial<Action> = {}): Action {
  const choice = findChoice(choiceId);
  return { type: choice.type, choiceId, competency: choice.competency, ...overrides };
}

function act(state: ExperimentState, choiceId: string): { state: ExperimentState; events: Event[] } {
  return apply(state, actionOf(choiceId));
}

/** 走完前 n 步：先做该步全部非完成正确动作（满足前置），再提交 completesStep 动作。 */
function runSteps(count: number): { state: ExperimentState; all: Event[] } {
  let state = START();
  const all: Event[] = [];
  for (let index = 0; index < count; index += 1) {
    const step = exp09Definition.steps[index];
    for (const choice of step.choices) {
      if (choice.role !== "correct" || choice.completesStep) continue;
      const result = act(state, choice.choiceId);
      if (result.events.some((event) => event.kind === "invalid")) {
        throw new Error(`unexpected-invalid:${choice.choiceId}`);
      }
      state = result.state;
      all.push(...result.events);
    }
    const completes = step.choices.find((choice) => choice.role === "correct" && choice.completesStep);
    if (!completes) throw new Error(`no-completing-choice:${step.index}`);
    const result = act(state, completes.choiceId);
    if (result.events.some((event) => event.kind === "invalid")) {
      throw new Error(`unexpected-invalid:${completes.choiceId}`);
    }
    state = result.state;
    all.push(...result.events);
  }
  return { state, all };
}

function feedbackOf(events: Event[]): Event[] {
  return events.filter((event) => event.kind === "feedback");
}

function hintsOf(events: Event[]): { level: HintLevel; text: string }[] {
  return events.flatMap((event) =>
    event.kind === "hint" ? [{ level: event.level, text: event.text }] : [],
  );
}

function eventKinds(events: Event[]): string[] {
  return events.map((event) => event.kind);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/* ------------------------------------------------------------------ */

describe("initState / 定义注册", () => {
  it("exp09 初始状态：第 0 步、未完成、器材齐备、簿记为空", () => {
    const state = START();
    expect(state.expId).toBe("exp09");
    expect(state.stepIndex).toBe(0);
    expect(state.attemptOfStep).toBe(0);
    expect(state.done).toBe(false);
    expect(state.observations).toEqual([]);
    expect(state.violations).toEqual([]);
    expect(state.incidents).toEqual([]);
    expect(state.stepLog).toEqual([]);
    expect(Object.keys(state.entities)).toContain("balance-1");
    expect(Object.keys(state.entities)).toContain("burette-base");
    expect(getDefinition("exp09")?.steps).toHaveLength(7);
    expect(listExperimentIds()).toContain("exp09");
    expect(getStep(state)?.demoId).toBe("exp09-step1-naoh");
  });

  it("两次 initState 互不共享引用", () => {
    const a = START();
    const b = START();
    expect(a).not.toBe(b);
    expect(a.entities).not.toBe(b.entities);
    a.entities["balance-1"].reading = 99;
    expect(b.entities["balance-1"].reading).toBe(0);
  });
});

describe("正常流程", () => {
  it("按每步 completesStep 动作走通 7 步，最终 done", () => {
    const { state, all } = runSteps(7);
    expect(state.done).toBe(true);
    expect(state.stepIndex).toBe(6);
    expect(state.violations).toEqual([]);
    expect(state.incidents).toEqual([]);
    const stepCompletes = all.filter((event) => event.kind === "stepComplete");
    expect(stepCompletes).toHaveLength(7);
    expect(state.observations.length).toBeGreaterThanOrEqual(7);
  });

  it("非完成动作只推进本步内部进度（observation + stepLog），不进下一步", () => {
    const result = act(START(), "step1-weigh");
    expect(result.state.stepIndex).toBe(0);
    expect(result.state.attemptOfStep).toBe(0);
    expect(result.state.done).toBe(false);
    expect(result.state.observations).toHaveLength(1);
    expect(result.state.observations[0].text).toContain("NaOH 2.0 g");
    expect(result.state.stepLog).toEqual([{ stepIndex: 0, choiceId: "step1-weigh" }]);
    expect(eventKinds(result.events)).toContain("observation");
    expect(eventKinds(result.events)).toContain("stateChanged");
    expect(eventKinds(result.events)).not.toContain("stepComplete");
  });

  it("entityPatch 生效：装液后碱式滴定管有液、调零后读数为 0", () => {
    const atStep4 = runSteps(3).state;
    const clamped = act(atStep4, "step4-clamp");
    const filled = act(clamped.state, "step4-fill");
    expect(filled.state.entities["burette-base"].liquid?.substance).toBe("NaOH(aq)");
    expect(filled.state.entities["burette-base"].liquid?.level).toBe(50);
    const zeroed = act(filled.state, "step4-zero");
    expect(zeroed.state.entities["burette-base"].reading).toBe(0);
    expect(zeroed.state.stepIndex).toBe(4);
  });
});

describe("顺序保护 / 非法动作", () => {
  it("跳步动作返回 invalid 且 state 原引用不变", () => {
    const state = START();
    const result = act(state, "step3-wash");
    expect(result.events).toEqual([{ kind: "invalid", reason: "out-of-order:step3-wash" }]);
    expect(result.state).toBe(state);
    expect(result.state.stepIndex).toBe(0);
  });

  it("回退到已完成步骤返回 invalid 且 state 原引用不变", () => {
    const { state } = runSteps(1);
    const frozen = deepFreeze(JSON.parse(JSON.stringify(state)) as ExperimentState);
    const result = act(state, "step1-transfer");
    expect(result.events[0]).toEqual({ kind: "invalid", reason: "already-completed:step1-transfer" });
    expect(result.state).toBe(state);
    expect(state.stepIndex).toBe(frozen.stepIndex);
  });

  it("未知 choiceId → invalid", () => {
    const state = START();
    const result = apply(state, { type: "wash", choiceId: "step1-nope", competency: "S1" });
    expect(result.events).toEqual([{ kind: "invalid", reason: "unknown-choice:step1-nope" }]);
    expect(result.state).toBe(state);
  });

  it("动作原语与定义不匹配 → invalid type-mismatch，不改状态", () => {
    const state = START();
    const result = apply(state, { type: "titrate", choiceId: "step1-weigh", competency: "A1" });
    expect(result.events[0]).toEqual({ kind: "invalid", reason: "type-mismatch:weigh" });
    expect(result.state).toBe(state);
  });

  it("未知实验 id → invalid unknown-experiment", () => {
    const state: ExperimentState = { ...START(), expId: "exp99" };
    const result = apply(state, { type: "observe", choiceId: "step1-weigh", competency: "A1" });
    expect(result.events).toEqual([{ kind: "invalid", reason: "unknown-experiment:exp99" }]);
    expect(result.state).toBe(state);
  });
});

describe("重复提交幂等", () => {
  it("重复提交会推进步骤的正确动作：第二次 invalid，state 与第一次结果相同", () => {
    const primed = act(act(START(), "step1-weigh").state, "step1-dissolve").state;
    const first = act(primed, "step1-transfer");
    expect(first.state.stepIndex).toBe(1);
    const second = apply(first.state, actionOf("step1-transfer"));
    expect(second.events[0]).toEqual({ kind: "invalid", reason: "already-completed:step1-transfer" });
    expect(second.state).toBe(first.state);
    expect(second.state.stepIndex).toBe(1);
  });

  it("缺前置动作时结束本步的动作无效（必须先称量、再定容）", () => {
    const state = START();
    const result = act(state, "step1-transfer");
    expect(result.events[0]).toEqual({
      kind: "invalid",
      reason: "missing-prerequisite:step1-transfer:step1-weigh",
    });
    expect(result.state).toBe(state);
    expect(result.state.stepIndex).toBe(0);
  });

  it("同一步内重复提交未完成动作：第二次 inactive 且不重复记 observation", () => {
    const first = act(START(), "step1-weigh");
    const second = act(first.state, "step1-weigh");
    expect(second.events[0]).toEqual({ kind: "invalid", reason: "duplicate-action:step1-weigh" });
    expect(second.state).toBe(first.state);
    expect(second.state.observations).toHaveLength(1);
  });

  it("同一步重复提交陷阱动作：不重复扣分、attemptOfStep 不再增长", () => {
    const first = act(START(), "step1-bare-hands-naoh");
    const second = act(first.state, "step1-bare-hands-naoh");
    expect(second.events[0].kind).toBe("invalid");
    expect(second.state).toBe(first.state);
    expect(second.state.incidents).toHaveLength(1);
    expect(second.state.attemptOfStep).toBe(1);
  });

  it("相同输入两次得到深相等结果（确定性）", () => {
    const a = act(START(), "step1-bare-hands-naoh");
    const b = act(START(), "step1-bare-hands-naoh");
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });
});

describe("陷阱与事故", () => {
  it("L3 徒手取 NaOH：incident burn，不推进步骤，记录事故，输入状态未被修改", () => {
    const state = START();
    const snapshot = JSON.parse(JSON.stringify(state)) as ExperimentState;
    const result = act(state, "step1-bare-hands-naoh");

    const incident = result.events.find((event) => event.kind === "incident");
    expect(incident).toEqual({
      kind: "incident",
      incidentId: "exp09-H2",
      level: "L3",
      fx: "burn",
      terminate: false,
    });
    expect(result.events.some((event) => event.kind === "feedback" && event.severity === "danger")).toBe(true);
    expect(result.state.stepIndex).toBe(0);
    expect(result.state.done).toBe(false);
    expect(result.state.attemptOfStep).toBe(1);
    expect(result.state.incidents).toEqual([
      { stepIndex: 0, incidentId: "exp09-H2", level: "L3", terminate: false },
    ]);
    expect(result.state.violations).toEqual([]);
    // 输入状态不可变
    expect(state).toEqual(snapshot);
    expect(state.incidents).toHaveLength(0);
  });

  it("L4 水入酸：boil-over 事故终止实验，后续动作一律 invalid", () => {
    const atStep2 = runSteps(1).state;
    const result = act(atStep2, "step2-water-into-acid");
    const incident = result.events.find((event) => event.kind === "incident");
    expect(incident).toEqual({
      kind: "incident",
      incidentId: "exp09-H1",
      level: "L4",
      fx: "boil-over",
      terminate: true,
    });
    expect(result.state.done).toBe(true);
    expect(result.state.incidents[0].terminate).toBe(true);

    const after = act(result.state, "step2-add-water");
    expect(after.events).toEqual([{ kind: "invalid", reason: "experiment-terminated" }]);
    expect(after.state).toBe(result.state);
  });

  it("L1 陷阱：只记 violation（扣 3 分），无事故，不推进步骤", () => {
    const atStep5 = runSteps(4).state;
    const result = act(atStep5, "step5-excess-indicator");
    expect(result.events).toEqual(
      expect.arrayContaining([
        { kind: "violation", ruleId: "exp09-H11", deduct: 3, competency: "S2" },
      ]),
    );
    expect(result.state.incidents).toHaveLength(0);
    expect(result.state.violations).toEqual([
      { stepIndex: 4, ruleId: "exp09-H11", deduct: 3, competency: "S2" },
    ]);
    expect(result.state.stepIndex).toBe(4);
    expect(result.state.attemptOfStep).toBe(1);
  });
});

describe("提示阶梯", () => {
  it("同一步连续 3 次不同错误 → H0、H1、H2", () => {
    let state = START();
    const levels: HintLevel[] = [];
    for (const choiceId of ["step1-bare-hands-naoh", "step1-hot-dissolve", "step1-glass-stopper"]) {
      const result = act(state, choiceId);
      state = result.state;
      levels.push(...hintsOf(result.events).map((hint) => hint.level));
    }
    expect(levels).toEqual([0, 1, 2]);
    expect(state.attemptOfStep).toBe(3);
    expect(hintsOf(act(state, "step1-weigh").events)).toEqual([]);
  });

  it("连续 3 次同类错误（同 competency）额外给 H4 元认知提示", () => {
    let state = START();
    const inputs = ["exp09-X1", "exp09-X2", "exp09-X3"];
    const levelsPerRound: HintLevel[][] = [];
    for (const ruleId of inputs) {
      const result = applyIncident(state, {
        kind: "violation",
        ruleId,
        deduct: 3,
        competency: "A1",
        level: "L1",
        feedback: { severity: "warn", title: `规则 ${ruleId}` },
      });
      expect(result.state).not.toBe(state);
      state = result.state;
      levelsPerRound.push(hintsOf(result.events).map((hint) => hint.level));
    }
    expect(levelsPerRound[0]).toEqual([0]);
    expect(levelsPerRound[1]).toEqual([1]);
    expect(levelsPerRound[2]).toEqual([2, 4]);
  });
});

describe("applyIncident：规则层入账", () => {
  it("入账 violation：记录 + 事件 + attempt 递增；同一 (step, ruleId) 重复入账无效", () => {
    const state = START();
    const input = {
      kind: "violation" as const,
      ruleId: "exp09-R001",
      deduct: 2,
      competency: "A1" as const,
      level: "L1" as const,
      feedback: { severity: "warn" as const, title: "违反 S004" },
    };
    const first = applyIncident(state, input);
    expect(first.events).toEqual(
      expect.arrayContaining([{ kind: "violation", ruleId: "exp09-R001", deduct: 2, competency: "A1" }]),
    );
    expect(first.state.violations).toEqual([
      { stepIndex: 0, ruleId: "exp09-R001", deduct: 2, competency: "A1" },
    ]);
    expect(first.state.attemptOfStep).toBe(1);
    expect(first.state).not.toBe(state);

    const second = applyIncident(first.state, input);
    expect(second.events).toEqual([{ kind: "invalid", reason: "duplicate-violation:exp09-R001" }]);
    expect(second.state).toBe(first.state);
    expect(second.state.violations).toHaveLength(1);
  });

  it("入账 incident：记录事故，terminate 时直接 done", () => {
    const state = START();
    const result = applyIncident(state, {
      kind: "incident",
      incidentId: "exp09-X9",
      level: "L4",
      fx: "explosion",
      deduct: 20,
      competency: "A1",
      terminate: true,
    });
    expect(result.state.incidents).toEqual([
      { stepIndex: 0, incidentId: "exp09-X9", level: "L4", terminate: true },
    ]);
    expect(result.state.done).toBe(true);
    expect(result.events.some((event) => event.kind === "incident" && event.fx === "explosion")).toBe(true);
  });

  it("缺必填 id 时拒绝入账（unknown + 收窄，不用 any）", () => {
    const state = START();
    const noRule = applyIncident(state, { kind: "violation", deduct: 3, competency: "S1", level: "L1" });
    expect(noRule.events[0]).toEqual({ kind: "invalid", reason: "rule-id-required" });
    const noIncident = applyIncident(state, { kind: "incident", deduct: 8, competency: "S1", level: "L3" });
    expect(noIncident.events[0]).toEqual({ kind: "invalid", reason: "incident-id-required" });
    expect(noRule.state).toBe(state);
    expect(noIncident.state).toBe(state);
  });
});

describe("状态不可变", () => {
  it("深冻结的 state 也能安全 apply，原有字段引用不变", () => {
    const state = deepFreeze(START());
    const observationsBefore = state.observations;
    const entitiesBefore = state.entities;
    const result = act(state, "step1-weigh");
    expect(result.state).not.toBe(state);
    expect(state.observations).toBe(observationsBefore);
    expect(state.observations).toHaveLength(0);
    expect(state.stepLog).toEqual([]);
    expect(result.state.entities).not.toBe(entitiesBefore);
    expect(result.state.entities["balance-1"].reading).toBe(2);
    expect(entitiesBefore["balance-1"].reading).toBe(0);
  });

  it("事件 stateChanged 的 patch 只含真正变化的字段", () => {
    const result = act(START(), "step1-weigh");
    const changed = result.events.find((event) => event.kind === "stateChanged");
    expect(changed?.kind).toBe("stateChanged");
    if (changed?.kind === "stateChanged") {
      expect(Object.keys(changed.patch).sort()).toEqual(
        ["entities", "observations", "stepLog"].sort(),
      );
      expect(changed.patch.stepIndex).toBeUndefined();
      expect(changed.patch.done).toBeUndefined();
    }
  });
});

describe("完成态", () => {
  it("走完 7 步后不再接受任何动作", () => {
    const { state } = runSteps(7);
    const result = act(state, "step7-compute");
    expect(result.events).toEqual([{ kind: "invalid", reason: "experiment-terminated" }]);
    expect(result.state).toBe(state);
  });

  it("每步都至少有一个 completesStep 动作（流程不会卡死）", () => {
    for (const step of exp09Definition.steps) {
      const completes = step.choices.filter((choice) => choice.role === "correct" && choice.completesStep);
      expect(completes.length, `step ${step.index + 1}`).toBeGreaterThanOrEqual(1);
      expect(findStep(completes[0].choiceId).index).toBe(step.index);
    }
    // 反馈事件在所有被误用的路径上都是 feedback，而不是抛异常
    expect(feedbackOf(act(START(), "step1-bare-hands-naoh").events)).toHaveLength(1);
  });
});
