/**
 * components/exp/guide/mission-copy.ts —— 任务看板的一句话文案（纯函数，无 React）。
 *
 * 看板只给「大致目标 + 简单流程」，细则留给学生自己试。
 * 目标句压缩自 docs/实验库/expNN.md §2「实验目的」：只留可交付成果，不写机理。
 */

import { clip } from "./copy";

/** 一句话目标（≤20 字）：每个实验的"做到什么算完成"。 */
export const MISSION_GOALS: Readonly<Record<string, string>> = {
  exp01: "称准 Na₂CO₃，配成 100 mL",
  exp02: "把粗盐提纯成试剂级 NaCl",
  exp03: "稀释 4 个浓度点，测出醋酸 Kₐ",
  exp04: "沉淀、离心、溶解，看清平衡移动",
  exp05: "装好原电池，测 4 组电动势",
  exp06: "滴到沉淀恰好溶解，看颜色复原",
  exp07: "分开并检出常见阳离子",
  exp08: "天平练习：固定质量与递减法",
  exp09: "三次平行滴定，极差 ≤0.2%",
  exp10: "标定 HCl，测纯碱总碱度",
};

/** 当前一步一句指引的上限（字）。提示句短，操作说明要能说清"手上怎么动"。 */
export const MISSION_GUIDE_MAX = 20;
/** 操作说明（动作名 + 执行方式）的上限：20 字装不下「称量瓶连盖粗称：点天平…」 */
export const MISSION_HOW_MAX = 42;

/** 目标句：有预设用预设，没有就按步骤数推一句（不编化学内容）。 */
export function missionGoal(expId: string, title: string, total: number): string {
  const fixed = MISSION_GOALS[expId];
  if (fixed) return fixed;
  return `${total} 步完成「${clip(title, 10)}」`;
}

/**
 * 进度行：`第 2/7 步 · 现在该称量了`。
 * ⚠️ 格式被 scripts/walk-steps.mjs 用「第 N/」解析，别改斜杠前的写法。
 */
export function missionProgress(stepNo: number, total: number, verb: string): string {
  return `第 ${stepNo}/${total} 步 · 现在该${verb}了`;
}

/**
 * 第四行：优先用当前提示（同屏只有这一条），没有就退回本步任务名。
 * 提示句压到 20 字；操作说明（含「动作名：怎么做」）放宽到 42 字 ——
 * 卡片删掉后这一行是唯一的「下一步做什么」，截断等于没说（2026-10-22）。
 */
export function missionGuide(hint: string | undefined, stepTitle: string, limit = MISSION_GUIDE_MAX): string {
  const source = hint && hint.trim().length > 0 ? hint : stepTitle;
  return clip(source.trim(), limit);
}
