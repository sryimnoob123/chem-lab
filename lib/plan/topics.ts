/**
 * 拼接实验 · 主题（P0）
 *
 * 学生先选一个主题，再在主题约束下从素材库拼方案 —— 空着画布问"我该做什么"答不出来，
 * 给一个真实情境就答得出来（用户 2026-10-22：「自己先选一个主题，然后让他去自己设计实验」）。
 *
 * 设计约束：
 * - 主题只描述「情境 + 目标 + 2~3 条硬约束」，不复制素材块信息（块仍在 pieces.ts）；
 * - 主题专属校验是纯函数，叠在 21 条基础规则之上，扣分口径一致（block −12 / warn −5）；
 * - 主题全部落在本实验（HCl 标定 / 纯碱总碱度）的素材范围内 —— 素材库没有 EDTA、
 *   没有缓冲对，硬造一个"水的总硬度"主题，学生拼到一半就会发现没有对应块。
 */

import type { PlanInput } from "./pieces";
import type { PlanIssue, PlanReport, RuleLevel } from "./rules";

export type TopicRule = {
  /** 稳定 code，进 API 与日志；加前缀避免和基础规则重名 */
  code: string;
  /** 老师能直接读懂的一句话判据 */
  label: string;
  level: RuleLevel;
  /** true = 通过 */
  check: (plan: PlanInput) => boolean;
  hint: string;
};

export type PlanTopic = {
  id: string;
  title: string;
  /** 一句话情境：谁、在什么场景下、为什么做 */
  scene: string;
  /** 要做出什么 */
  goal: string;
  /** 卡片上写给学生的 2~3 条硬约束（与 rules 对应，措辞面向学生） */
  constraints: readonly string[];
  /** 主题相关素材：素材库里置顶 + 预先高亮（其余仍可选，用来做错） */
  featured: readonly string[];
  rules: readonly TopicRule[];
};

const has = (plan: PlanInput, id: string): boolean => plan.pieces.includes(id);
const count = (plan: PlanInput, key: string): number => {
  const value = plan.params?.[key];
  return typeof value === "number" ? value : 0;
};

export const PLAN_TOPICS: readonly PlanTopic[] = [
  {
    id: "topic-hcl-standard",
    title: "盐酸标准溶液的标定",
    scene: "实验台上一瓶浓盐酸标签模糊，浓度不能直接信；下周的滴定全要用它。",
    goal: "用基准物质标定出 c(HCl)，平行 3 份，相对偏差 ≤0.2%。",
    constraints: [
      "必须用基准物质（无水 Na₂CO₃ 或 KHP）标定，不能拿浓盐酸当标准",
      "必须用酸式滴定管（玻璃活塞），碱式会漏液",
      "平行测定不少于 3 份",
    ],
    featured: [
      "piece-analytical-balance",
      "piece-burette-acid",
      "piece-weighing-bottle",
      "piece-na2co3-primary",
      "piece-khp",
      "piece-step-rinse",
      "piece-step-weigh",
      "piece-step-dissolve",
      "piece-step-dilute",
      "piece-step-parallel",
      "piece-param-parallel",
    ],
    rules: [
      {
        code: "topic-standard-needs-primary",
        level: "block",
        label: "本主题必须用基准物质标定",
        check: (plan) => has(plan, "piece-na2co3-primary") || has(plan, "piece-khp"),
        hint: "加「无水 Na₂CO₃」或「邻苯二甲酸氢钾」当基准物",
      },
      {
        code: "topic-standard-needs-acid-burette",
        level: "block",
        label: "标定盐酸必须用酸式滴定管",
        check: (plan) => has(plan, "piece-burette-acid"),
        hint: "把「酸式滴定管」放进方案（玻璃活塞，耐酸）",
      },
      {
        code: "topic-standard-parallel-3",
        level: "warn",
        label: "平行测定 ≥3 份才够判断精密度",
        check: (plan) => has(plan, "piece-step-parallel") && count(plan, "parallelCount") >= 3,
        hint: "加「平行测定」步骤，并把平行次数设成 3",
      },
    ],
  },
  {
    id: "topic-soda-alkalinity",
    title: "工业纯碱总碱度测定",
    scene: "厂里送来一批工业纯碱，要看这批货的总碱度（以 Na₂CO₃ 计）能不能交差。",
    goal: "双指示剂法测出 V₁、V₂，算出总碱度，并用空白试验校正。",
    constraints: [
      "必须双指示剂法：酚酞在前、甲基橙在后，不能颠倒或混加",
      "必须煮沸驱 CO₂（否则第二步终点偏早）",
      "必须做空白试验，扣掉蒸馏水带来的碱量",
    ],
    featured: [
      "piece-flask-250",
      "piece-burette-acid",
      "piece-phenolphthalein",
      "piece-methyl-orange",
      "piece-step-near-endpoint",
      "piece-step-half-drop",
      "piece-step-boil",
      "piece-step-blank",
      "piece-param-endpoint",
    ],
    rules: [
      {
        code: "topic-alkalinity-dual-indicator",
        level: "block",
        label: "总碱度必须酚酞 + 甲基橙双指示剂",
        check: (plan) => has(plan, "piece-phenolphthalein") && has(plan, "piece-methyl-orange"),
        hint: "两块指示剂都要：先酚酞到微红消失，再甲基橙到黄→橙",
      },
      {
        code: "topic-alkalinity-boil",
        level: "block",
        label: "必须煮沸驱尽 CO₂",
        check: (plan) => has(plan, "piece-step-boil"),
        hint: "加「煮沸驱 CO₂」步骤：否则碳酸转成 CO₂ 逸出，第二步终点判早",
      },
      {
        code: "topic-alkalinity-blank",
        level: "warn",
        label: "必须有空白试验做校正",
        check: (plan) => has(plan, "piece-step-blank"),
        hint: "加「空白试验」：蒸馏水里溶的 CO₂ 会让结果系统性偏高",
      },
    ],
  },
  {
    id: "topic-acid-acceptance",
    title: "新到浓盐酸验收（KHP 基准）",
    scene: "试剂库新到一批浓盐酸，标签写 37%，得抽检浓度对不对得上。",
    goal: "用邻苯二甲酸氢钾标定这批盐酸，算出实测浓度并与标签值比对。",
    constraints: [
      "本主题指定 KHP 作基准物（不与 Na₂CO₃ 混用）",
      "必须平行 3 份 + 空白，验收结论才站得住",
      "必须记录实测 c(HCl) 与标签值的相对偏差",
    ],
    featured: [
      "piece-khp",
      "piece-burette-acid",
      "piece-analytical-balance",
      "piece-weighing-bottle",
      "piece-step-parallel",
      "piece-step-blank",
      "piece-param-conc",
      "piece-param-parallel",
    ],
    rules: [
      {
        code: "topic-acceptance-khp",
        level: "block",
        label: "本主题指定邻苯二甲酸氢钾为基准物",
        check: (plan) => has(plan, "piece-khp"),
        hint: "加「邻苯二甲酸氢钾（基准试剂）」",
      },
      {
        code: "topic-acceptance-single-standard",
        level: "warn",
        label: "两套基准物别混用：同一份报告只认一种",
        check: (plan) => !(has(plan, "piece-khp") && has(plan, "piece-na2co3-primary")),
        hint: "只留一种基准物，否则两份结果的可比性说不清",
      },
      {
        code: "topic-acceptance-parallel-blank",
        level: "block",
        label: "验收结论必须建立在平行 + 空白上",
        check: (plan) => has(plan, "piece-step-parallel") && has(plan, "piece-step-blank"),
        hint: "同时加「平行测定」和「空白试验」",
      },
    ],
  },
  {
    id: "topic-co2-blank",
    title: "CO₂ 干扰与终点判读专项",
    scene: "上次测定结果偏高，怀疑蒸馏水里溶了 CO₂，终点也判早了。",
    goal: "用同一套器材把「水中的 CO₂」和「终点判读」这两个系统误差摁住。",
    constraints: [
      "必须用新沸冷却蒸馏水",
      "必须煮沸驱 CO₂ + 空白试验",
      "终点判据必须写清颜色（微红刚好消失 / 黄→橙 30 s 不褪）",
    ],
    featured: [
      "piece-boiled-water",
      "piece-step-boil",
      "piece-step-blank",
      "piece-step-half-drop",
      "piece-phenolphthalein",
      "piece-methyl-orange",
      "piece-param-endpoint",
    ],
    rules: [
      {
        code: "topic-co2-boiled-water",
        level: "block",
        label: "必须用新沸冷却的蒸馏水",
        check: (plan) => has(plan, "piece-boiled-water"),
        hint: "加「新沸冷却蒸馏水」：敞口放置的水会重新溶入 CO₂",
      },
      {
        code: "topic-co2-boil-and-blank",
        level: "block",
        label: "煮沸驱 CO₂ 与空白试验都要做",
        check: (plan) => has(plan, "piece-step-boil") && has(plan, "piece-step-blank"),
        hint: "两块都加上：一个管样品，一个管空白",
      },
      {
        code: "topic-co2-endpoint",
        level: "warn",
        label: "终点判据要写清颜色与稳定时间",
        check: (plan) => has(plan, "piece-param-endpoint") && has(plan, "piece-step-half-drop"),
        hint: "加「终点判据」参数块和「半滴操作」：最后半滴决定 0.02 mL",
      },
    ],
  },
];

export function getTopic(id: string | null | undefined): PlanTopic | undefined {
  if (!id) return undefined;
  return PLAN_TOPICS.find((topic) => topic.id === id);
}

/** 主题专属校验：返回的问题与基础规则同形状，UI 不用分两套渲染。 */
export function topicReport(plan: PlanInput, topic: PlanTopic | undefined): {
  issues: PlanIssue[];
  passed: string[];
  byRule: Record<string, boolean>;
  failed: TopicRule[];
} {
  const issues: PlanIssue[] = [];
  const passed: string[] = [];
  const byRule: Record<string, boolean> = {};
  const failed: TopicRule[] = [];
  if (!topic) return { issues, passed, byRule, failed };

  for (const rule of topic.rules) {
    const ok = rule.check(plan);
    byRule[rule.code] = ok;
    if (ok) {
      passed.push(rule.label);
      continue;
    }
    failed.push(rule);
    issues.push({ ruleId: rule.code, level: rule.level, text: rule.label, hint: rule.hint });
  }
  return { issues, passed, byRule, failed };
}

const DEDUCT: Record<RuleLevel, number> = { block: 12, warn: 5 };

/**
 * 把主题约束叠到基础报告上：一张评分卡、一套灯，不出现"两套分数"。
 * 扣分口径与基础规则一致（block −12 / warn −5，最低 0）。
 */
export function applyTopic(report: PlanReport, plan: PlanInput, topic: PlanTopic | undefined): PlanReport {
  if (!topic) return report;
  const extra = topicReport(plan, topic);
  if (extra.issues.length === 0) {
    return { ...report, passed: [...report.passed, ...extra.passed], byRule: { ...report.byRule, ...extra.byRule } };
  }
  const issues = [...extra.issues, ...report.issues];
  const blockCount = issues.filter((i) => i.level === "block").length;
  const warnCount = issues.filter((i) => i.level === "warn").length;
  const deduction = issues.reduce((sum, i) => sum + DEDUCT[i.level], 0);
  return {
    issues,
    passed: [...report.passed, ...extra.passed],
    byRule: { ...report.byRule, ...extra.byRule },
    score: Math.max(0, 100 - deduction),
    feasible: blockCount === 0,
    blockCount,
    warnCount,
  };
}
