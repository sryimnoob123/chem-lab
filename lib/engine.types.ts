/**
 * 接口契约的 TypeScript 投影（唯一权威：docs/接口契约.md）。
 * 这里只放**类型**与纯数据形状；所有运行时逻辑在 lib/engine.ts。
 *
 * 谁在消费这些类型：
 * - lib/engine.ts           状态机
 * - experiments/<id>/      实验定义
 * - lib/rules/**           规则层（产出 violation / incident，再喂给 applyIncident）
 * - lib/safety/**          事故表（Incident）
 * - 组件 / 服务端时间线      Event、TimelineRow
 *
 * 契约变更流程：先改 docs/接口契约.md，再改这里，并在 .team/DECISIONS.md 记一行。
 */

/* ------------------------------------------------------------------ *
 * 1. 动作原语（只能从这 17 个里来）
 * ------------------------------------------------------------------ */

export type ActionType =
  | "wash"
  | "weigh"
  | "dissolve"
  | "transfer"
  | "dilute"
  | "heat"
  | "evaporate"
  | "filter"
  | "centrifuge"
  | "washPrecipitate"
  | "addDrops"
  | "titrate"
  | "readInstrument"
  | "observe"
  | "assemble"
  | "calibrate"
  | "compute";

/** 运行时校验用（定义文件测试、UI 选项池）。与 ActionType 同源，改一处即可。 */
export const ACTION_TYPES: readonly ActionType[] = [
  "wash",
  "weigh",
  "dissolve",
  "transfer",
  "dilute",
  "heat",
  "evaporate",
  "filter",
  "centrifuge",
  "washPrecipitate",
  "addDrops",
  "titrate",
  "readInstrument",
  "observe",
  "assemble",
  "calibrate",
  "compute",
];

/* ------------------------------------------------------------------ *
 * 2. 能力点
 * ------------------------------------------------------------------ */

export type KnowledgeCode = `K${1 | 2 | 3 | 4 | 5}`;
export type SkillCode = `S${1 | 2 | 3 | 4 | 5}`;
export type LiteracyCode = `A${1 | 2 | 3}`;
export type CompetencyCode = KnowledgeCode | SkillCode | LiteracyCode;

/* ------------------------------------------------------------------ *
 * 3. 动作
 * ------------------------------------------------------------------ */

export type ActionParams = Record<string, number | string | boolean>;

export interface Action {
  type: ActionType;
  /** 定义文件里的唯一 id */
  choiceId: string;
  /** 体积/浓度/滴数/时间等 */
  params?: ActionParams;
  /** 该动作判定哪个能力点（定义文件里也有一份，引擎以定义文件为准） */
  competency: CompetencyCode;
}

/* ------------------------------------------------------------------ *
 * 4. 实验状态
 * ------------------------------------------------------------------ */

export type EntityKind =
  | "burette"
  | "flask"
  | "beaker"
  | "cylinder"
  | "pipette"
  | "volumetric"
  | "tube"
  | "balance"
  | "wash"
  | "stand"
  | "lamp";

export interface EntityState {
  id: string;
  kind: EntityKind;
  liquid?: { substance: string; level: number; color: string; opacity: number };
  precipitate?: { substance: string; amount: number; color: string };
  gas?: { substance: string; amount: number };
  bubbles?: boolean;
  /** mL / g / pH */
  reading?: number;
  note?: string;
}

export interface Observation {
  stepIndex: number;
  text: string;
  value?: number;
}

export interface ViolationRecord {
  stepIndex: number;
  ruleId: string;
  deduct: number;
  competency: CompetencyCode;
}

export interface IncidentRecord {
  stepIndex: number;
  incidentId: string;
  level: IncidentLevel;
  terminate: boolean;
  /**
   * 本起事故扣多少分。可选：exp01 没有 lib/safety/incidents 记录文件，
   * 分数只能从 hazard 带下来，否则 UI 会显示成「−0 分」。
   */
  deduct?: number;
}

/**
 * 引擎内部簿记：本步已经执行过的动作 choiceId（幂等键）。
 * 契约 §3 未列出，属于"状态存储形状的细节"（实现自由），故做成**可选字段**，
 * 别人手写 ExperimentState 字面量时不填也不会类型报错。
 * 语义：同一 stepIndex 下同一 choiceId 只允许生效一次，重复提交一律 invalid。
 */
export interface StepLogEntry {
  stepIndex: number;
  choiceId: string;
}

export interface ExperimentState {
  expId: string;
  /** 0-based */
  stepIndex: number;
  /** 本步第几次尝试（驱动提示阶梯） */
  attemptOfStep: number;
  entities: Record<string, EntityState>;
  observations: Observation[];
  violations: ViolationRecord[];
  incidents: IncidentRecord[];
  done: boolean;
  /** 见 StepLogEntry：幂等簿记，可选。 */
  stepLog?: StepLogEntry[];
}

/* ------------------------------------------------------------------ *
 * 5. 事故 / 视觉键 / 提示阶梯
 * ------------------------------------------------------------------ */

/** 偏差 / 数据作废 / 事故 / 危险事故 */
export type IncidentLevel = "L1" | "L2" | "L3" | "L4";

export type FxKey =
  | "boil-over"
  | "explosion"
  | "toxic-gas"
  | "burn"
  | "glass-break"
  | "fire"
  | "heavy-metal"
  | "device-accident";

export interface Incident {
  /** exp01-I1 */
  id: string;
  trigger: (state: ExperimentState, action: Action) => boolean;
  level: IncidentLevel;
  fx: FxKey;
  title: string;
  /** 为什么错（原理，1~2 句） */
  why: string;
  /** 真实后果 */
  consequence: string;
  /** 正确做法（分步） */
  correct: string;
  /** 规范条目 S001… */
  refs: string[];
  /** L1 2~3 / L2 5 / L3 8~10 / L4 15~20 */
  deduct: number;
  /** L4 一律 true */
  terminate: boolean;
  competency: CompetencyCode;
}

/** 0 只给后果；1 指向性问题；2 概念提示；3 动作演示；4 元认知（连续 3 次同类错误） */
export type HintLevel = 0 | 1 | 2 | 3 | 4;

/* ------------------------------------------------------------------ *
 * 6. 事件（引擎输出，UI 只消费）
 * ------------------------------------------------------------------ */

export type FeedbackSeverity = "info" | "warn" | "danger";

export interface FeedbackCopy {
  severity: FeedbackSeverity;
  title: string;
  why?: string;
  correct?: string;
  refs?: string[];
}

export type Event =
  | { kind: "invalid"; reason: string } // 跳步/不合法，不改状态
  | {
      kind: "feedback";
      severity: FeedbackSeverity;
      title: string;
      why?: string;
      correct?: string;
      refs?: string[];
    }
  | { kind: "hint"; level: HintLevel; text: string }
  | { kind: "stepComplete"; stepIndex: number }
  | { kind: "violation"; ruleId: string; deduct: number; competency: CompetencyCode }
  | { kind: "incident"; incidentId: string; level: IncidentLevel; fx: FxKey; terminate: boolean; deduct: number }
  | { kind: "observation"; text: string; value?: number }
  | { kind: "stateChanged"; patch: Partial<ExperimentState> };

/* ------------------------------------------------------------------ *
 * 7. 时间线（落库形态，契约 §8）
 * ------------------------------------------------------------------ */

export interface TimelineRow {
  runId: string;
  stepIndex: number;
  /** 同一步内的序号，用于幂等 */
  seq: number;
  actionType: ActionType;
  choiceId: string;
  competency: CompetencyCode;
  correct: boolean;
  deduct: number;
  incidentId?: string;
  /** JSON 字符串（读数/体积等） */
  payload?: string;
}

/* ------------------------------------------------------------------ *
 * 8. 实验定义（引擎的输入数据，不是契约的一部分，但唯一入口）
 * ------------------------------------------------------------------ */

/** 数值判据，供报告层/规则层复用；引擎本身不判对错。 */
export interface JudgeTolerance {
  paramKey: string;
  expected: number;
  unit: string;
  tolerance: number;
}

export interface StepJudge {
  /** 判据一句话，直接可上 UI / 报告 */
  criterion: string;
  /** 本步判定哪些能力点 */
  competency: readonly CompetencyCode[];
  tolerance?: JudgeTolerance;
}

export interface StepHints {
  /** 第 1 次错 */
  h0: string;
  /** 第 2 次错 */
  h1: string;
  /** 第 3 次错 */
  h2: string;
  /** 第 4 次错 */
  h3: string;
  /** 连续 3 次同类错误（跨步同 competency） */
  h4?: string;
}

/**
 * 陷阱动作的后果声明。
 * - 有 fx（真实视觉事故）→ 引擎产出 incident 事件 + IncidentRecord；
 * - 无 fx（纯文字+音效）→ 引擎产出 violation 事件 + ViolationRecord。
 * 规则层如另有动态判定，用 applyIncident 追加；同一 (stepIndex,id) 只会记一次。
 */
export interface ChoiceHazard {
  /** exp09-H1 …，与 docs/实验库/<exp>.md §7 一致 */
  ruleId: string;
  /** 对外事故 id（有 fx 时必填），与 lib/safety/incidents/<exp>.ts 对齐 */
  incidentId?: string;
  level: IncidentLevel;
  /** 无特效事故留空 */
  fx?: FxKey;
  deduct: number;
  competency: CompetencyCode;
  terminate: boolean;
  feedback: FeedbackCopy;
}

export interface EntityPatch {
  [entityId: string]: Partial<Omit<EntityState, "id" | "kind">>;
}

export interface ChoiceDefinition {
  choiceId: string;
  /** UI 按钮文案 */
  label: string;
  type: ActionType;
  role: "correct" | "trap";
  competency: CompetencyCode;
  /** data-demo-id（契约 §10：demo-op-<role>-<n>） */
  demoId: string;
  /** 正确动作：执行后是否结束本步 */
  completesStep: boolean;
  /**
   * 前置动作 choiceId（同一步内必须先执行过），用于"必须先称量再定容"这类硬顺序。
   * 缺前置时 apply 返回 invalid(missing-prerequisite)，不改状态。
   */
  requires?: readonly string[];
  params?: ActionParams;
  observation?: { text: string; value?: number };
  entityPatch?: EntityPatch;
  /** 正确动作的反馈；缺省用 label 生成 info */
  feedback?: FeedbackCopy;
  /** 陷阱动作的后果；role === "trap" 时必填 */
  hazard?: ChoiceHazard;
}

export interface StepDefinition {
  /** 0-based，必须与数组下标一致 */
  index: number;
  title: string;
  scene: string;
  /** 场景级 data-demo-id，必须与 docs/实验库/<exp>.md §6 最后一列完全一致 */
  demoId: string;
  judge: StepJudge;
  hints: StepHints;
  /** 可用动作白名单（= 本步 choices 的 choiceId 全集） */
  accepts: readonly string[];
  choices: readonly ChoiceDefinition[];
}

export interface ExperimentDefinition {
  id: string;
  title: string;
  /** 本实验覆盖的能力点（顺序即报告雷达图顺序） */
  competencies: readonly CompetencyCode[];
  steps: readonly StepDefinition[];
  /** 纯函数工厂：返回一份全新的初始状态（不得共享引用） */
  createState: () => ExperimentState;
}

/** 规则层 → 引擎 的追加判定输入（applyIncident 用） */
export interface IncidentInput {
  kind: "violation" | "incident";
  /** violation 必填 */
  ruleId?: string;
  /** incident 必填 */
  incidentId?: string;
  /** L1 2~3 / L2 5 / L3 8~10 / L4 15~20 */
  deduct: number;
  competency: CompetencyCode;
  level: IncidentLevel;
  fx?: FxKey;
  terminate?: boolean;
  feedback?: FeedbackCopy;
  /** 记录到哪一步，默认 state.stepIndex */
  atStep?: number;
}
