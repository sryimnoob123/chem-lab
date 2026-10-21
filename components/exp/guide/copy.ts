/**
 * components/exp/guide/copy.ts —— 引导式操作台的短文案工具（纯函数，无 React）。
 *
 * 铁律：用户可见的每条反馈 ≤18 字，且尽量带数字（"称样 1.0599 g · 偏差 +0.0001 g"）。
 * 这里只做"从引擎事件/定义里压字"，不含任何判定逻辑。
 */

import type { ActionParams, ActionType, FeedbackSeverity, IncidentLevel } from "@/lib/engine.types";

/** 动作原语 → 动作名（用于"现在该称量了""下一步：滴定 →"）。 */
export const ACTION_VERB: Readonly<Record<ActionType, string>> = {
  wash: "洗涤",
  weigh: "称量",
  dissolve: "溶解",
  transfer: "转移",
  dilute: "稀释",
  heat: "加热",
  evaporate: "蒸发",
  filter: "过滤",
  centrifuge: "离心",
  washPrecipitate: "洗沉淀",
  addDrops: "滴加",
  titrate: "滴定",
  readInstrument: "读数",
  observe: "观察",
  assemble: "装配",
  calibrate: "校准",
  compute: "计算",
};

/** 参数键 → 显示单位（只用于拼"5.0 mL""1.0599 g"这类短数字）。 */
const PARAM_UNIT: Readonly<Record<string, string>> = {
  volume: "mL",
  mass: "g",
  drops: "滴",
  trials: "次",
  waitSeconds: "s",
  holdSeconds: "s",
  initialReading: "mL",
  finalReading: "mL",
  meanVolume: "mL",
  range: "mL",
  ratio: "",
  relativeRange: "%",
};

/** 取第一个分句（标题/判据通常"结论：解释"两段，引导只要前半句）。 */
export function firstClause(text: string): string {
  const first = text.split(/[：:，,；;。→]/)[0]?.trim();
  return first && first.length > 0 ? first : text.trim();
}

/** 截断到 limit 字，超了用省略号。 */
export function clip(text: string, limit: number): string {
  const value = text.trim();
  return value.length > limit ? `${value.slice(0, Math.max(1, limit - 1))}…` : value;
}

/** 建议动作卡的动作名：动作短语，≤18 字。 */
export function guideName(label: string, limit = 18): string {
  return clip(firstClause(label), limit);
}

/** "一句为什么"：判据第一分句，≤18 字。 */
export function whyLine(criterion: string, limit = 18): string {
  return clip(firstClause(criterion), limit);
}

/** "现在该称量了"里的动作词。 */
export function nowDoing(type: ActionType): string {
  return ACTION_VERB[type];
}

/** 下一步引导条：`下一步：滴定 →`（用动作词，不用长标签，保证一眼读得完）。 */
export function nextLine(type: ActionType | undefined, label?: string): string {
  const verb = type ? ACTION_VERB[type] : label ? guideName(label, 12) : "继续";
  return `下一步：${verb} →`;
}

/** 进度点：done / current / todo。 */
export type StepDotState = "done" | "current" | "todo";

export interface ResultTextInput {
  outcome: "success" | "failure";
  type?: ActionType;
  params?: ActionParams;
  observationText?: string;
  observationValue?: number;
  /** 失败时的短标题（already ≤20 字） */
  shortTitle: string;
  /** 失败时的正确做法（压到 18 字） */
  correct?: string;
  deduction: number;
  severity?: FeedbackSeverity;
  level?: IncidentLevel;
}

export interface ResultText {
  line: string;
  /** 失败时给一句"正确做法"；成功不给第二行，保持安静 */
  line2?: string;
}

/** 从参数/观测里挑一个数字片段。 */
function numericFragment(params: ActionParams | undefined, value: number | undefined): string | undefined {
  if (params) {
    for (const key of ["mass", "volume", "drops", "trials", "holdSeconds", "waitSeconds"]) {
      const raw = params[key];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        const unit = PARAM_UNIT[key] ?? "";
        return `${raw}${unit ? ` ${unit}` : ""}`;
      }
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
  return undefined;
}

/**
 * 结果条文案（第一行 ≤18 字）。
 * 成功：观测短句 + 数字（"认领单已核对签字 · 15"）
 * 失败：原因 + 扣分（"纤维残留 · −2 分"）
 */
export function resultText(input: ResultTextInput): ResultText {
  if (input.outcome === "failure") {
    const reason = clip(firstClause(input.shortTitle), 10);
    const line = clip(`${reason} · −${input.deduction} 分`, 18);
    const line2 = input.correct ? clip(firstClause(input.correct), 18) : undefined;
    return line2 ? { line, line2 } : { line };
  }

  const clause = input.observationText ? firstClause(input.observationText) : "";
  const number = numericFragment(input.params, input.observationValue);
  if (clause.length > 0) {
    const line = number ? `${clip(clause, 10)} · ${number}` : clip(clause, 18);
    return { line: clip(line, 18) };
  }
  const verb = input.type ? ACTION_VERB[input.type] : "操作";
  return { line: clip(`${verb}完成`, 18) };
}
