import { apply, applyIncident, getDefinition, initState } from "@/lib/engine";
import type {
  Action,
  ChoiceDefinition,
  ExperimentState,
  FeedbackSeverity,
  FxKey,
  HintLevel,
  IncidentLevel,
  StepDefinition,
} from "@/lib/engine.types";
import { detectFirstIncident, getIncident } from "@/lib/safety/registry";
import {
  appendError,
  clearCompetencyHistory,
  isDeductibleHint,
  levelForStepAttempt,
  type HintErrorRecord,
  type HintUsage,
} from "@/lib/pedagogy/hints";
import { computeOperationScore } from "@/lib/pedagogy/scoring";

export interface WorkbenchEvent {
  outcome: "success" | "failure";
  severity: FeedbackSeverity;
  /** 成功 = 为什么对；失败 = 完整事故/违规标题 */
  title: string;
  /** 失败分支事件条第一行：错在哪（≤20 字） */
  shortTitle: string;
  /** 触发这次反馈的步骤号（1 基）；成功后 state 已前进，不能用当前步号。 */
  stepNumber: number;
  why?: string;
  correct?: string;
  deduction: number;
  level?: IncidentLevel;
  fx?: FxKey;
  fxSeq?: number;
  terminate: boolean;
  incident: boolean;
}

export interface RevealedHint {
  level: HintLevel;
  text: string;
  shouldDeduct: boolean;
}

export interface WorkbenchState {
  exp: ExperimentState;
  /** 每一步进入时的快照；重做本步只回到这里。 */
  stepStart: ExperimentState;
  event: WorkbenchEvent | null;
  hint: RevealedHint | null;
  hintHistory: HintErrorRecord[];
  hintUsages: HintUsage[];
  finished: boolean;
  /** 最近一次点击的选项，用来只给被点的按钮挂反馈类。 */
  lastChoiceId: string | null;
  /** 每次动作 +1，用来重放器皿动画和数字 pop。 */
  feedbackSeq: number;
  /** 重做本步 +1，用来把焦点移回动作区。 */
  retrySeq: number;
  /** 连续正确次数（正反馈 StreakPill 用）；出错/事故/重做都归零。 */
  streak: number;
}

export type WorkbenchAction =
  | { type: "choose"; choiceId: string; label: string }
  | { type: "hint" }
  | { type: "retry" }
  | { type: "reset" };

export function createWorkbenchState(expId: string): WorkbenchState {
  const exp = initState(expId);
  return {
    exp,
    stepStart: structuredClone(exp),
    event: null,
    hint: null,
    hintHistory: [],
    hintUsages: [],
    finished: false,
    lastChoiceId: null,
    feedbackSeq: 0,
    retrySeq: 0,
    streak: 0,
  };
}

export function currentStep(state: ExperimentState): StepDefinition | undefined {
  return getDefinition(state.expId)?.steps[state.stepIndex];
}

export function workbenchReducer(
  state: WorkbenchState,
  action: WorkbenchAction,
): WorkbenchState {
  const definition = getDefinition(state.exp.expId);
  if (!definition) return state;

  if (action.type === "reset") return createWorkbenchState(state.exp.expId);

  if (action.type === "retry") {
    // L4 终止是例外：不能在本步重做，只能从终止页重新演示整个实验。
    if (state.exp.done) return state;
    const stepIndex = state.exp.stepIndex;
    return {
      ...state,
      exp: structuredClone(state.stepStart),
      event: null,
      hint: null,
      hintHistory: state.hintHistory.filter((record) => record.stepIndex < stepIndex),
      hintUsages: state.hintUsages.filter((usage) => usage.stepIndex < stepIndex),
      finished: false,
      lastChoiceId: null,
      feedbackSeq: state.feedbackSeq + 1,
      retrySeq: state.retrySeq + 1,
      streak: 0,
    };
  }

  if (state.exp.done) return state;

  const step = definition.steps[state.exp.stepIndex];
  if (!step) return state;

  if (action.type === "hint") {
    return revealHint(state, step);
  }

  const choice = step.choices.find((item) => item.choiceId === action.choiceId);
  if (!choice) return state;

  return runChoice(state, step, choice);
}

function runChoice(
  state: WorkbenchState,
  step: StepDefinition,
  choice: ChoiceDefinition,
): WorkbenchState {
  const engineAction: Action = {
    type: choice.type,
    choiceId: choice.choiceId,
    competency: choice.competency,
  };

  const dynamicHit = detectFirstIncident(state.exp.expId, state.exp, engineAction);
  let result = apply(state.exp, engineAction);
  const invalid = result.events.find((event) => event.kind === "invalid");

  if (invalid) {
    const title = invalidText(invalid.reason);
    return {
      ...state,
      event: {
        outcome: "failure",
        severity: "warn",
        title,
        shortTitle: truncateHeadline(title),
        stepNumber: step.index + 1,
        why: "这个动作没有进入引擎；先看前置动作或当前步骤。",
        deduction: 0,
        terminate: false,
        incident: false,
      },
      lastChoiceId: choice.choiceId,
      feedbackSeq: state.feedbackSeq + 1,
      streak: 0,
    };
  }

  const alreadyAccounted = result.events.some(
    (event) => event.kind === "incident" || event.kind === "violation",
  );

  if (dynamicHit && !alreadyAccounted) {
    result = applyIncident(result.state, {
      kind: "incident",
      incidentId: dynamicHit.id,
      level: dynamicHit.level,
      deduct: dynamicHit.deduct,
      competency: dynamicHit.competency,
      fx: dynamicHit.fx,
      terminate: dynamicHit.terminate,
      feedback: {
        severity: dynamicHit.terminate ? "danger" : "warn",
        title: dynamicHit.title,
        why: dynamicHit.why,
        correct: dynamicHit.correct,
        refs: dynamicHit.refs,
      },
    });
  }

  const event = buildEvent(step, choice, result.events, result.state.incidents.length);
  const wrong = choice.role === "trap" || event?.incident === true || event?.deduction !== 0;

  let hintHistory = state.hintHistory;
  if (wrong) {
    hintHistory = appendError(hintHistory, {
      competency: choice.competency,
      stepIndex: state.exp.stepIndex,
    });
  } else if (choice.role === "correct") {
    hintHistory = clearCompetencyHistory(hintHistory, choice.competency);
  }

  const advanced = result.state.stepIndex !== state.exp.stepIndex;

  return {
    ...state,
    exp: result.state,
    stepStart: advanced ? structuredClone(result.state) : state.stepStart,
    event,
    hint: null,
    hintHistory,
    finished: result.state.done,
    lastChoiceId: choice.choiceId,
    feedbackSeq: state.feedbackSeq + 1,
    streak: wrong ? 0 : state.streak + 1,
  };
}

function buildEvent(
  step: StepDefinition,
  choice: ChoiceDefinition,
  events: ReturnType<typeof apply>["events"],
  fxSeq: number,
): WorkbenchEvent | null {
  const feedback = events.find((event) => event.kind === "feedback");
  const incident = events.find((event) => event.kind === "incident");
  const violation = events.find((event) => event.kind === "violation");
  const observation = events.find((event) => event.kind === "observation");

  if (incident) {
    const record = getIncident(incident.incidentId);
    const title = record?.title ?? feedback?.title ?? "实验事故";
    return {
      outcome: "failure",
      severity: incident.level === "L3" || incident.level === "L4" ? "danger" : "warn",
      title,
      shortTitle: truncateHeadline(title),
      stepNumber: step.index + 1,
      why: record?.why ?? feedback?.why,
      correct: record?.correct ?? feedback?.correct,
      deduction: record?.deduct ?? 0,
      level: incident.level,
      fx: incident.fx,
      fxSeq,
      terminate: incident.terminate,
      incident: true,
    };
  }

  if (violation) {
    const title = feedback?.title ?? "操作违规，已记录扣分";
    return {
      outcome: "failure",
      severity: feedback?.severity ?? "warn",
      title,
      shortTitle: truncateHeadline(title),
      stepNumber: step.index + 1,
      why: feedback?.why,
      correct: feedback?.correct,
      deduction: violation.deduct,
      level: choice.hazard?.level,
      terminate: false,
      incident: false,
    };
  }

  const why = feedback?.why ?? observation?.text ?? choice.observation?.text ?? step.judge.criterion;

  return {
    outcome: "success",
    severity: "info",
    title: "这一步对了",
    shortTitle: "操作正确",
    stepNumber: step.index + 1,
    why,
    correct: feedback?.correct,
    deduction: 0,
    terminate: false,
    incident: false,
  };
}

function revealHint(state: WorkbenchState, step: StepDefinition): WorkbenchState {
  const stepErrors = state.hintHistory.filter((record) => record.stepIndex === step.index).length;
  const level = levelForStepAttempt(Math.max(1, stepErrors));
  const competency = step.judge.competency[0] ?? "S1";
  const usage: HintUsage = { competency, stepIndex: step.index, level };
  const seen = state.hintUsages.some(
    (item) => item.stepIndex === usage.stepIndex && item.level === usage.level,
  );

  return {
    ...state,
    hint: {
      level,
      text: hintText(step, level),
      shouldDeduct: isDeductibleHint(level),
    },
    hintUsages: seen ? state.hintUsages : [...state.hintUsages, usage],
  };
}

export function hintText(step: StepDefinition, level: HintLevel): string {
  switch (level) {
    case 0:
      return step.hints.h0;
    case 1:
      return step.hints.h1;
    case 2:
      return step.hints.h2;
    case 3:
      return step.hints.h3;
    default:
      return step.hints.h4 ?? step.hints.h3;
  }
}

export function operationScore(state: WorkbenchState) {
  return computeOperationScore({
    violations: state.exp.violations,
    incidents: state.exp.incidents.map((record) => ({
      ...record,
      deduct: getIncident(record.incidentId)?.deduct ?? 0,
    })),
    hints: state.hintUsages,
  });
}

function invalidText(reason: string): string {
  if (reason.startsWith("missing-prerequisite")) return "这一步的前置动作还没做完，先按顺序来。";
  if (reason.startsWith("duplicate-action")) return "这个动作已经做过了，不用重复。";
  if (reason.startsWith("experiment-complete")) return "实验已经完成，可以交卷了。";
  return "这个动作现在还不能做。";
}

/** 事件条第一行“错在哪”：取标题第一个分句，≤20 字。 */
export function truncateHeadline(text: string, limit = 20): string {
  const first = text.split(/[：:，,；;。]/)[0]?.trim() || text.trim();
  return first.length > limit ? `${first.slice(0, limit - 1)}…` : first;
}
