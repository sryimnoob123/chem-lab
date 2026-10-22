/**
 * lib/engine.ts —— 通用实验状态机（纯函数：无 IO、无 React、无随机数）。
 *
 * ┌─ 职责边界 ─────────────────────────────────────────────────────────────┐
 * │ 引擎“不认识对错”：它只执行**实验定义里的数据**（experiments/<id>/definition.ts）。 │
 * │ - apply(state, action)   顺序保护 + 幂等 + 状态转移 + 产出事件；           │
 * │ - applyIncident(state, e) 规则层的动态判定（lib/rules/**、lib/safety/**）   │
 * │   产出 violation / incident 后喂回来入账（同一 (stepIndex,id) 只记一次）。 │
 * │ 陷阱动作的后果在定义里声明（hazard），apply 直接产出对应事件；规则层如另有  │
 * │ 动态判定，用 applyIncident 追加，不会重复扣分。                            │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * 契约：docs/接口契约.md（签名固定 `apply(state, action) => { state, events }`）。
 * 经验约定（写进注释，供 UI / 规则层 / 时间线使用）：
 * - 非法请求一律返回 `{ kind: "invalid" }` 且 **state 原引用返回**（不改状态、可做幂等判断）；
 * - 事件顺序：feedback → observation → hint → violation/incident → stepComplete → stateChanged；
 * - `attemptOfStep` 只在**出错**时 +1，正确完成后清零；
 * - 提示阶梯：本步第 1 次错 H0、第 2 次 H1、第 3 次 H2、第 4 次起 H3；
 *   连续 3 次同类错误（跨步同 competency，按 violation 记录）额外补 H4；
 * - 幂等键：`state.stepLog`（可选簿记）里的 (stepIndex, choiceId)，重复提交返回 invalid；
 * - 新实验只需在 DEFINITIONS 里加一行（本文件归 engine-core 所有，跨轨道改这里先找 owner）。
 */

import { exp01Definition } from "../experiments/exp01/definition";
import { exp02Definition } from "../experiments/exp02/definition";
import { exp03Definition } from "../experiments/exp03/definition";
import { exp04Definition } from "../experiments/exp04/definition";
import { exp08Definition } from "../experiments/exp08/definition";
import { exp09Definition } from "../experiments/exp09/definition";
import { exp05Definition } from "../experiments/exp05/definition";
import { exp06Definition } from "../experiments/exp06/definition";
import { exp07Definition } from "../experiments/exp07/definition";
import { exp10Definition } from "../experiments/exp10/definition";
import type {
  Action,
  ChoiceDefinition,
  CompetencyCode,
  EntityState,
  Event,
  ExperimentDefinition,
  ExperimentState,
  FeedbackCopy,
  HintLevel,
  IncidentInput,
  IncidentRecord,
  StepDefinition,
  StepLogEntry,
  ViolationRecord,
} from "./engine.types";

export * from "./engine.types";

/** apply / applyIncident 的统一返回。 */
export interface ApplyResult {
  state: ExperimentState;
  events: Event[];
}

/** 已注册的实验定义。新实验在此追加一行。 */
const DEFINITIONS: Readonly<Record<string, ExperimentDefinition>> = {
  [exp01Definition.id]: exp01Definition,
  [exp02Definition.id]: exp02Definition,
  [exp03Definition.id]: exp03Definition,
  [exp04Definition.id]: exp04Definition,
  [exp08Definition.id]: exp08Definition,
  [exp09Definition.id]: exp09Definition,
  [exp05Definition.id]: exp05Definition,
  [exp06Definition.id]: exp06Definition,
  [exp07Definition.id]: exp07Definition,
  [exp10Definition.id]: exp10Definition,
};

/* ------------------------------------------------------------------ *
 * 查询辅助
 * ------------------------------------------------------------------ */

export function listExperimentIds(): string[] {
  return Object.keys(DEFINITIONS);
}

export function getDefinition(expId: string): ExperimentDefinition | undefined {
  return DEFINITIONS[expId];
}

export function getStep(state: ExperimentState): StepDefinition | undefined {
  return DEFINITIONS[state.expId]?.steps[state.stepIndex];
}

/** 新建一次实验运行的初始状态（深拷贝，调用之间不共享引用）。 */
export function initState(expId: string): ExperimentState {
  const definition = DEFINITIONS[expId];
  if (!definition) throw new Error(`unknown-experiment:${expId}`);
  return definition.createState();
}

/* ------------------------------------------------------------------ *
 * apply —— 状态机主入口
 * ------------------------------------------------------------------ */

export function apply(state: ExperimentState, action: Action): ApplyResult {
  const definition = DEFINITIONS[state.expId];
  if (!definition) return invalid(state, `unknown-experiment:${state.expId}`);
  if (state.done) return invalid(state, "experiment-terminated");

  const step = definition.steps[state.stepIndex];
  if (!step) return invalid(state, "experiment-complete");

  const located = locateChoice(definition, action.choiceId);
  if (!located) return invalid(state, `unknown-choice:${action.choiceId}`);
  if (located.step.index > step.index) return invalid(state, `out-of-order:${action.choiceId}`);
  if (located.step.index < step.index) return invalid(state, `already-completed:${action.choiceId}`);

  const choice = located.choice;
  if (choice.type !== action.type) return invalid(state, `type-mismatch:${choice.type}`);
  if (isPerformed(state, step.index, choice.choiceId)) return invalid(state, `duplicate-action:${choice.choiceId}`);

  const missingPrerequisite = (choice.requires ?? []).find((id) => !isPerformed(state, step.index, id));
  if (missingPrerequisite) {
    return invalid(state, `missing-prerequisite:${choice.choiceId}:${missingPrerequisite}`);
  }

  return choice.role === "trap" ? applyTrap(state, step, choice) : applyCorrect(state, definition, step, choice);
}

/* ------------------------------------------------------------------ *
 * applyIncident —— 规则层动态判定入账
 * ------------------------------------------------------------------ */

export function applyIncident(state: ExperimentState, input: IncidentInput): ApplyResult {
  if (input.kind === "incident" && !input.incidentId) return invalid(state, "incident-id-required");
  if (input.kind === "violation" && !input.ruleId) return invalid(state, "rule-id-required");

  const atStep = input.atStep ?? state.stepIndex;
  if (isRecorded(state, input.kind, atStep, input.kind === "incident" ? input.incidentId : input.ruleId)) {
    return invalid(state, `duplicate-${input.kind}:${input.kind === "incident" ? input.incidentId : input.ruleId}`);
  }

  const events: Event[] = [];
  if (input.feedback) events.push(feedbackEvent(input.feedback));

  const attemptOfStep = state.attemptOfStep + 1;
  const step = getStep(state);
  if (step) events.push(...hintEvents(step, attemptOfStep, input.competency, state.violations));

  const next: ExperimentState = {
    ...state,
    attemptOfStep,
    violations: state.violations,
    incidents: state.incidents,
    done: state.done,
  };

  if (input.kind === "incident" && input.incidentId) {
    const record: IncidentRecord = {
      stepIndex: atStep,
      incidentId: input.incidentId,
      level: input.level,
      terminate: input.terminate ?? false,
      deduct: input.deduct ?? 0,
    };
    next.incidents = [...state.incidents, record];
    events.push({
      kind: "incident",
      incidentId: input.incidentId,
      level: input.level,
      fx: input.fx ?? "device-accident",
      terminate: record.terminate,
      deduct: input.deduct ?? 0,
    });
    if (record.terminate) next.done = true;
  } else if (input.ruleId) {
    const record: ViolationRecord = {
      stepIndex: atStep,
      ruleId: input.ruleId,
      deduct: input.deduct,
      competency: input.competency,
    };
    next.violations = [...state.violations, record];
    events.push({ kind: "violation", ruleId: input.ruleId, deduct: input.deduct, competency: input.competency });
  }

  events.push(...stateChangedEvents(state, next));
  return { state: next, events };
}

/* ------------------------------------------------------------------ *
 * 分支
 * ------------------------------------------------------------------ */

function applyCorrect(
  state: ExperimentState,
  definition: ExperimentDefinition,
  step: StepDefinition,
  choice: ChoiceDefinition,
): ApplyResult {
  const events: Event[] = [feedbackEvent(choice.feedback ?? { severity: "info", title: choice.label })];

  const observations = choice.observation
    ? [...state.observations, { stepIndex: step.index, text: choice.observation.text, value: choice.observation.value }]
    : state.observations;
  if (choice.observation) {
    events.push({ kind: "observation", text: choice.observation.text, value: choice.observation.value });
  }

  const entities = applyEntityPatch(state.entities, choice.entityPatch);
  const advances = choice.completesStep;
  const lastStepIndex = definition.steps.length - 1;
  const done = advances && step.index >= lastStepIndex;

  const next: ExperimentState = {
    ...state,
    stepIndex: advances && !done ? step.index + 1 : step.index,
    attemptOfStep: advances ? 0 : state.attemptOfStep,
    entities,
    observations,
    violations: state.violations,
    incidents: state.incidents,
    done: state.done || done,
    stepLog: advances ? state.stepLog ?? [] : appendStepLog(state, step.index, choice.choiceId),
  };

  if (advances) events.push({ kind: "stepComplete", stepIndex: step.index });
  events.push(...stateChangedEvents(state, next));
  return { state: next, events };
}

function applyTrap(state: ExperimentState, step: StepDefinition, choice: ChoiceDefinition): ApplyResult {
  const consequence = choice.hazard;
  if (!consequence) return invalid(state, `definition-broken:${choice.choiceId}`);

  const attemptOfStep = state.attemptOfStep + 1;
  const events: Event[] = [feedbackEvent(consequence.feedback)];
  events.push(...hintEvents(step, attemptOfStep, consequence.competency, state.violations));

  const next: ExperimentState = {
    ...state,
    attemptOfStep,
    entities: state.entities,
    observations: state.observations,
    violations: state.violations,
    incidents: state.incidents,
    done: state.done || consequence.terminate,
    stepLog: appendStepLog(state, step.index, choice.choiceId),
  };

  // 只要有 fx 就按「事故」处理并播特效。
  // 原来是 `fx && incidentId` 双条件，而 exp01 没有 incidents 记录文件、陷阱只声明了 fx，
  // 于是全部掉进 else 分支变成普通扣分 —— 屏幕上什么都不发生，学生只看到「−N 分」。
  // incidentId 缺省回落到 ruleId；记录查不到时 UI 会回落到 feedback 文案，不影响展示。
  if (consequence.fx) {
    const incidentId = consequence.incidentId ?? consequence.ruleId;
    next.incidents = [
      ...state.incidents,
      {
        stepIndex: step.index,
        incidentId,
        level: consequence.level,
        terminate: consequence.terminate,
        deduct: consequence.deduct,
      },
    ];
    events.push({
      kind: "incident",
      incidentId,
      level: consequence.level,
      fx: consequence.fx,
      terminate: consequence.terminate,
      // exp01 没有 lib/safety/incidents/exp01.ts，getIncident() 查不到记录，
      // UI 的 `record?.deduct ?? 0` 会把 −5 显示成 −0；扣分随事件带出去兜底。
      deduct: consequence.deduct,
    });
  } else {
    next.violations = [
      ...state.violations,
      {
        stepIndex: step.index,
        ruleId: consequence.ruleId,
        deduct: consequence.deduct,
        competency: consequence.competency,
      },
    ];
    events.push({
      kind: "violation",
      ruleId: consequence.ruleId,
      deduct: consequence.deduct,
      competency: consequence.competency,
    });
  }

  events.push(...stateChangedEvents(state, next));
  return { state: next, events };
}

/* ------------------------------------------------------------------ *
 * 纯函数小工具
 * ------------------------------------------------------------------ */

function invalid(state: ExperimentState, reason: string): ApplyResult {
  return { state, events: [{ kind: "invalid", reason }] };
}

interface LocatedChoice {
  step: StepDefinition;
  choice: ChoiceDefinition;
}

function locateChoice(definition: ExperimentDefinition, choiceId: string): LocatedChoice | undefined {
  for (const step of definition.steps) {
    for (const choice of step.choices) {
      if (choice.choiceId === choiceId) return { step, choice };
    }
  }
  return undefined;
}

function appendStepLog(state: ExperimentState, stepIndex: number, choiceId: string): StepLogEntry[] {
  const entry: StepLogEntry = { stepIndex, choiceId };
  return [...(state.stepLog ?? []), entry];
}

function isPerformed(state: ExperimentState, stepIndex: number, choiceId: string): boolean {
  return (state.stepLog ?? []).some((entry) => entry.stepIndex === stepIndex && entry.choiceId === choiceId);
}

function isRecorded(
  state: ExperimentState,
  kind: "violation" | "incident",
  stepIndex: number,
  id: string | undefined,
): boolean {
  if (!id) return false;
  if (kind === "incident") {
    return state.incidents.some((record) => record.stepIndex === stepIndex && record.incidentId === id);
  }
  return state.violations.some((record) => record.stepIndex === stepIndex && record.ruleId === id);
}

function applyEntityPatch(
  entities: Record<string, EntityState>,
  patch: ChoiceDefinition["entityPatch"],
): Record<string, EntityState> {
  if (!patch) return entities;
  const next: Record<string, EntityState> = { ...entities };
  for (const [entityId, delta] of Object.entries(patch)) {
    const previous = next[entityId];
    if (!previous) continue;
    next[entityId] = { ...previous, ...delta };
  }
  return next;
}

function feedbackEvent(copy: FeedbackCopy): Event {
  return {
    kind: "feedback",
    severity: copy.severity,
    title: copy.title,
    ...(copy.why === undefined ? {} : { why: copy.why }),
    ...(copy.correct === undefined ? {} : { correct: copy.correct }),
    ...(copy.refs === undefined ? {} : { refs: copy.refs }),
  };
}

function hintEvents(
  step: StepDefinition,
  attemptOfStep: number,
  competency: CompetencyCode,
  violations: readonly ViolationRecord[],
): Event[] {
  const ladder: readonly string[] = [step.hints.h0, step.hints.h1, step.hints.h2, step.hints.h3];
  const index = Math.min(Math.max(attemptOfStep, 1) - 1, ladder.length - 1);
  const level = index as HintLevel;
  const text = ladder[index] ?? ladder[ladder.length - 1] ?? step.hints.h0;
  const events: Event[] = [{ kind: "hint", level, text }];

  if (step.hints.h4 && isRepeatedCompetency(violations, competency)) {
    events.push({ kind: "hint", level: 4, text: step.hints.h4 });
  }
  return events;
}

/** 连续 3 次同类错误：最近 2 条记录与本次同 competency。 */
function isRepeatedCompetency(violations: readonly ViolationRecord[], competency: CompetencyCode): boolean {
  if (violations.length < 2) return false;
  return violations.slice(-2).every((record) => record.competency === competency);
}

function stateChangedEvents(previous: ExperimentState, next: ExperimentState): Event[] {
  const patch: Partial<ExperimentState> = {};
  if (next.stepIndex !== previous.stepIndex) patch.stepIndex = next.stepIndex;
  if (next.attemptOfStep !== previous.attemptOfStep) patch.attemptOfStep = next.attemptOfStep;
  if (next.entities !== previous.entities) patch.entities = next.entities;
  if (next.observations !== previous.observations) patch.observations = next.observations;
  if (next.violations !== previous.violations) patch.violations = next.violations;
  if (next.incidents !== previous.incidents) patch.incidents = next.incidents;
  if (next.done !== previous.done) patch.done = next.done;
  if (next.stepLog !== previous.stepLog) patch.stepLog = next.stepLog;
  if (Object.keys(patch).length === 0) return [];
  return [{ kind: "stateChanged", patch }];
}
