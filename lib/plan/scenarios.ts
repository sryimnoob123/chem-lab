/**
 * 三种结果的对照演示（2026-10-24）
 *
 * 用户口径（任务书交付二第 4 条）：好的（可行）/ 故障的 / 坏的（危险或不可行）都要**演出来**，
 * 让学生一眼看出区别 —— 不是看三个分数，是看三段流程跑出来的样子。
 *
 * 做法：三套预制方案 + 一句话结论，交给 `/plan` 里已有的 `PlanReplay` 演（同一套 7 种动作）。
 * 为什么不用随机生成：演示要可复现，同一按钮每次演出必须一样，否则现场说不清「刚才那个是怎么回事」。
 *
 * 三套的差别是**故意挑的三类错误**：
 *   ① 全对：参考方案，21 条规则全过；
 *   ② 有故障：数值口径错（读数分辨率 0.01→0.1、终点静置 30→10 秒）—— 照样能做完，但结果会系统性偏；
 *   ③ 危险/不可行：稀释顺序反了（把水倒进浓硫酸）+ 不在通风橱 + 基准物不干燥 —— 前者会溅酸，后两者数据作废。
 */

import { REFERENCE_PLAN, type PlanInput } from "./pieces";

export type ScenarioTone = "ok" | "warn" | "danger";

export type PlanScenario = {
  id: "good" | "flaw" | "danger";
  tone: ScenarioTone;
  /** 按钮上的两个字：可行 / 故障 / 危险 */
  label: string;
  /** 一句话结论（演完后显示在进度条上方） */
  line: string;
  /** 这条结论在讲哪一类错误（演示时学生先看这个） */
  why: string;
  plan: PlanInput;
};

/** 参考方案里去掉基准物「干燥器」这一块 —— 基准物没干燥，标定浓度直接偏 */
function withoutDesiccator(): string[] {
  return REFERENCE_PLAN.pieces.filter((id) => id !== "piece-desiccator");
}

export const PLAN_SCENARIOS: readonly PlanScenario[] = [
  {
    id: "good",
    tone: "ok",
    label: "可行",
    line: "21 条规则全过，能一路做到结果。",
    why: "该有的器材、试剂、参数都在，顺序也对。",
    plan: { pieces: [...REFERENCE_PLAN.pieces], params: { ...REFERENCE_PLAN.params } },
  },
  {
    id: "flaw",
    tone: "warn",
    label: "故障",
    line: "能做，但数据会系统性偏。",
    why: "终点只静置 10 秒、终点颜色判据没选 —— 流程没崩，读数不可信。",
    plan: {
      pieces: [...REFERENCE_PLAN.pieces],
      /* 只挑 warn 级的两条：静置时间不足 + 终点判据没选。
         `readingResolution` 看上去更像「小错」，但它挂的是 block 规则（reading-two-decimals），
         放进来就成了「不可行」，跟「故障」这一档要表达的意思相反。 */
      params: { ...REFERENCE_PLAN.params, endpointHoldSec: 10, endpoint: "unspecified" },
    },
  },
  {
    id: "danger",
    tone: "danger",
    label: "危险",
    line: "不可执行：稀释顺序反了，会溅酸。",
    why: "把水倒进浓硫酸（acidOrder=water-into-acid），而且不在通风橱里操作。",
    plan: {
      pieces: withoutDesiccator(),
      params: { ...REFERENCE_PLAN.params, acidOrder: "water-into-acid", hood: false },
    },
  },
];

export function getScenario(id: string): PlanScenario | undefined {
  return PLAN_SCENARIOS.find((item) => item.id === id);
}
