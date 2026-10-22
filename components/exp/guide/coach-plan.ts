/**
 * coach-plan.ts —— 演示引导「这一步该从哪拖到哪」的纯函数（无 React）。
 *
 * 引导只做一件事：把当前建议动作翻译成一条可画出来的路线 ——
 *   起点元素选择器 → 终点元素选择器 + 一句动作名 + 一句「手怎么动」。
 * 具体像素由组件量 DOM，这里只给选择器，便于单测（不碰浏览器）。
 *
 * 选择器口径与场景已有的 data-demo-id 对齐（scene-stage / reagent-rack / tool-tray）。
 */

import type { ActionType } from "@/lib/engine.types";

export type CoachGesture = "drag" | "tap";

export interface CoachVesselLike {
  id: string;
  label: string;
}

export interface CoachPlan {
  /** 换一步换一个 key：引导从这一步重新开始 */
  key: string;
  /** 气泡第一行：这一动做什么 */
  action: string;
  /** 气泡第二行：手怎么动（AGENTS 9.9 允许的「操作方式」） */
  how: string;
  gesture: CoachGesture;
  /** 起点选择器（tap 时为 null） */
  from: string | null;
  /** 终点选择器 */
  to: string;
  /** 这一动落在哪台器皿上（演示代做时要传给动作层） */
  vesselId: string | null;
  /** 这一动手上该拿的工具（演示代做时传给动作层） */
  toolId: string | null;
}

export interface CoachPlanInput {
  key: string;
  type: ActionType | string | undefined;
  label: string;
  /** 台面上摆着的器皿（id + 中文 label），用来把文案里的名字对到具体器皿 */
  vessels: readonly CoachVesselLike[];
  reagentId?: string | null;
  reagentName?: string | null;
  /** 场景里的线索器皿（scene 自己算出来的目标） */
  cueVesselId?: string | null;
  /** 这一步定义里的完整做法：常写着「移取 25.00 mL 放入锥形瓶」，比标签更准 */
  stepHow?: string;
  /** 台面上摆着的工具（id + 中文 label），用来把文案里的名字对到具体工具 */
  tools?: readonly CoachVesselLike[];
}

export const COACH_SELECTOR = {
  vessel: (id: string) => `[data-demo-id="demo-scene-vessel-${id}"]`,
  reagent: (id: string) => `[data-demo-id="demo-scene-reagent-${id}"]`,
  tool: (id: string) => `[data-demo-id="demo-tool-${id}"]`,
  sink: '[data-demo-id="demo-scene-sink"]',
  balance: '[data-demo-id="demo-scene-instrument-balance"]',
  ph: '[data-demo-id="demo-scene-instrument-ph"]',
  board: '[data-demo-id="demo-scene-board"]',
  cue: '[data-cue="true"]',
} as const;

/** 能「拿起来倒进去」的动作原语（与 workbench 的 REAGENT_TYPES 同源口径）。 */
const POUR_TYPES: ReadonlySet<string> = new Set<string>([
  "dissolve",
  "dilute",
  "addDrops",
  "titrate",
  "heat",
  "evaporate",
]);

/** 需要手上拿着器皿/工具去操作的动作原语。 */
const TOOL_TYPES: ReadonlySet<string> = new Set<string>(["transfer", "wash"]);

/** 点仪器就能做的动作原语。 */
const TAP_TYPES: ReadonlySet<string> = new Set<string>([
  "calibrate",
  "compute",
  "weigh",
  "readInstrument",
  "observe",
]);

/** 器皿 label 里的量程/空格不参与匹配：只留汉字（与 vessel-targets 同口径）。 */
function hanOnly(text: string): string {
  return text.replace(/[^\u4e00-\u9fa5]/g, "");
}

/** 文案里点名的器皿：最长匹配优先，避免「量筒」吃掉「容量瓶」。 */
export function vesselFromText(
  text: string | undefined,
  vessels: readonly CoachVesselLike[],
): string | null {
  if (!text) return null;
  const body = hanOnly(text);
  if (!body) return null;
  const hit = [...vessels]
    .filter((vessel) => {
      const word = hanOnly(vessel.label);
      return word.length >= 2 && body.includes(word);
    })
    .sort((a, b) => hanOnly(b.label).length - hanOnly(a.label).length)[0];
  return hit?.id ?? null;
}

function labelOf(vessels: readonly CoachVesselLike[], id: string | null): string {
  if (!id) return "器皿";
  return vessels.find((vessel) => vessel.id === id)?.label ?? "器皿";
}

/**
 * 当前建议动作 → 引导路线。
 * 顺序：定义文案里点名的器皿 → 场景线索器皿 → 空（退到台面中央）。
 */
export function buildCoachPlan(input: CoachPlanInput): CoachPlan {
  const { key, type, label, vessels, reagentId, reagentName, cueVesselId, stepHow, tools = [] } =
    input;

  const text = `${stepHow ?? ""} ${label}`;
  const named = vesselFromText(text, vessels) ?? vesselFromText(label, vessels);
  /**
   * 溶解只可能在烧杯里做（容量瓶不能搅拌/加热）。
   * 第 4 步的文案后面还会写「转入容量瓶」，最长匹配会指到容量瓶 ——
   * 和 vessel-targets 同口径：这一步手上要动的仍是烧杯。
   */
  const vesselId =
    (type === "dissolve" && vessels.some((vessel) => vessel.id === "beaker")
      ? "beaker"
      : (named ?? cueVesselId)) ?? null;
  const vesselName = labelOf(vessels, vesselId);
  const toVessel = vesselId ? COACH_SELECTOR.vessel(vesselId) : COACH_SELECTOR.cue;
  // 文案里点名的工具（移液管 / 量筒 / 玻璃棒…）优先；没点名就按动作原语兜底。
  const namedTool = vesselFromText(text, tools);
  const toolId =
    namedTool ??
    (type === "transfer"
      ? (tools.find((tool) => tool.id === "pipette")?.id ?? null)
      : type === "dilute"
        ? (tools.find((tool) => tool.id === "wash-bottle")?.id ?? null)
        : null);
  const toolLabel = tools.find((tool) => tool.id === toolId)?.label ?? null;

  if (type === "wash") {
    return {
      key,
      gesture: "drag",
      from: vesselId ? COACH_SELECTOR.vessel(vesselId) : COACH_SELECTOR.cue,
      to: COACH_SELECTOR.sink,
      action: `把${vesselName}拖进洗涤槽`,
      how: "按住器皿，拖进槽里松手",
      vesselId,
      toolId: null,
    };
  }

  if (type && (POUR_TYPES.has(type) || type === "transfer") && reagentId) {
    return {
      key,
      gesture: "drag",
      from: COACH_SELECTOR.reagent(reagentId),
      to: toVessel,
      action: `拿起${reagentName ?? "试剂"}，拖到${vesselName}`,
      how: "按住瓶身拖动，松手就倒进去",
      vesselId,
      toolId: null,
    };
  }

  if (type && (TOOL_TYPES.has(type) || POUR_TYPES.has(type)) && toolId) {
    return {
      key,
      gesture: "drag",
      from: COACH_SELECTOR.tool(toolId),
      to: toVessel,
      action: `拿${toolLabel ?? "工具"}，对准${vesselName}`,
      how: "按住工具，拖到器皿上松手",
      vesselId,
      toolId,
    };
  }

  if (type === "calibrate") {
    return {
      key,
      gesture: "tap",
      from: null,
      to: COACH_SELECTOR.balance,
      action: "点天平：调平，再做内校",
      how: "先看水平泡，再按内校键",
      vesselId,
      toolId: null,
    };
  }

  if (type === "compute" || type === "weigh" || type === "readInstrument") {
    return {
      key,
      gesture: "tap",
      from: null,
      to: COACH_SELECTOR.balance,
      action: "点天平，读一次示数",
      how: "等示数稳住再记",
      vesselId,
      toolId: null,
    };
  }

  if (type === "observe") {
    return {
      key,
      gesture: "tap",
      from: null,
      to: toVessel,
      action: `点一下${vesselName}观察`,
      how: "看清楚再决定下一步",
      vesselId,
      toolId: null,
    };
  }

  // 兜底：指到台面上，别把学生晾在原地
  return {
    key,
    gesture: "tap",
    from: null,
    to: COACH_SELECTOR.board,
    action: label.trim() || "看这一步要做什么",
    how: "在台面上操作",
    vesselId,
    toolId: null,
  };
}

