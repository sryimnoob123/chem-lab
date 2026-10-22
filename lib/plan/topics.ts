/**
 * 拼接实验 · 主题（P0）
 *
 * 学生先选一个主题，再在主题约束下从素材库拼方案 —— 空着画布问"我该做什么"答不出来，
 * 给一个真实情境就答得出来（用户 2026-10-22：「自己先选一个主题，然后让他去自己设计实验」）。
 *
 * 设计约束：
 * - 主题只描述「情境 + 目标 + 2~3 条硬约束」，不复制素材块信息（块仍在 pieces.ts）；
 * - **卡片上的每条约束都挂一条真实规则**（`TopicConstraint.ruleCode`），规则反过来也能
 *   指回素材块（`TopicRule.pieceId`）—— 不允许出现「卡片要 X，规则不管 X」；
 * - 主题按难度递进排列（入门 → 综合），level/difficulty 由数据决定，不靠文案形容；
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
  /** 这条约束落在哪一块上：点评要点、素材库置顶都靠它指到具体块 */
  pieceId: string;
  /**
   * true = 这一条管的是「不要用这块」（禁用块）。
   * 必选规则的责任块必须在 featured 里置顶；禁用块则相反，不进推荐列表。
   */
  forbidden?: boolean;
};

export type TopicConstraint = {
  /** 卡片上写给学生的那一句 */
  text: string;
  /** 由哪条规则判（必须存在于本主题 rules 里） */
  ruleCode: string;
};

export type TopicLevel = "入门" | "进阶" | "综合";

export type PlanTopic = {
  id: string;
  title: string;
  /** 一句话情境：谁、在什么场景下、做砸了会怎样 */
  scene: string;
  /** 这轮要产出什么 */
  goal: string;
  level: TopicLevel;
  /** 1~3，卡片上的难度刻度；与 level 一一对应 */
  difficulty: 1 | 2 | 3;
  /** 卡片上写给学生的 2~3 条硬约束（每条都由一条规则判） */
  constraints: readonly TopicConstraint[];
  /** 主题相关素材：素材库按这个顺序置顶（其余仍可选，用来做错） */
  featured: readonly string[];
  /** mock 点评的追问池：至少一条能推动学生改方案 */
  questions: readonly string[];
  rules: readonly TopicRule[];
};

const has = (plan: PlanInput, id: string): boolean => plan.pieces.includes(id);
const count = (plan: PlanInput, key: string): number => {
  const value = plan.params?.[key];
  return typeof value === "number" ? value : 0;
};

/**
 * 四个主题按难度从入门到综合排列。
 * 数组顺序就是卡片顺序：学生从第一张开始做，难度一档档往上走。
 */
export const PLAN_TOPICS: readonly PlanTopic[] = [
  {
    id: "topic-hcl-standard",
    title: "盐酸标准溶液的标定",
    scene:
      "实验员小陈下周要给三个班配滴定液，酸瓶上只写「37%」、开过封还吸过潮；浓度标不准，后面每一组滴定数据都白做。",
    goal: "交一份能照着做的标定方案：用基准物定出 c(HCl)，平行 3 份、极差 ≤0.2%，报 4 位有效数字。",
    level: "入门",
    difficulty: 1,
    constraints: [
      { text: "用无水 Na₂CO₃ 或 KHP 作基准物，不能拿浓盐酸直接当标准", ruleCode: "topic-standard-needs-primary" },
      { text: "盐酸只装酸式滴定管（玻璃活塞），碱式会漏液", ruleCode: "topic-standard-needs-acid-burette" },
      { text: "平行 3 份，极差 ≤0.2% 才取平均", ruleCode: "topic-standard-parallel-3" },
    ],
    featured: [
      "piece-weighing-bottle",
      "piece-analytical-balance",
      "piece-na2co3-primary",
      "piece-param-drying",
      "piece-step-weigh",
      "piece-step-dissolve",
      "piece-step-boil",
      "piece-step-rinse",
      "piece-burette-acid",
      "piece-step-degas",
      "piece-flask-250",
      "piece-methyl-orange",
      "piece-step-parallel",
      "piece-param-parallel",
      "piece-step-blank",
    ],
    questions: [
      "Na₂CO₃ 标 HCl 为什么要先煮沸 2 min 再补滴？不煮，算出的 c(HCl) 会偏高还是偏低？",
      "平行 3 份里有一份极差 0.4%，你先怀疑称量、滴定体积还是终点判读？",
    ],
    rules: [
      {
        code: "topic-standard-needs-primary",
        level: "block",
        label: "本主题必须用基准物质标定",
        check: (plan) => has(plan, "piece-na2co3-primary") || has(plan, "piece-khp"),
        hint: "加「无水 Na₂CO₃」或「邻苯二甲酸氢钾」当基准物",
        pieceId: "piece-na2co3-primary",
      },
      {
        code: "topic-standard-needs-acid-burette",
        level: "block",
        label: "标定盐酸必须用酸式滴定管",
        check: (plan) => has(plan, "piece-burette-acid"),
        hint: "把「酸式滴定管」放进方案（玻璃活塞，耐酸）",
        pieceId: "piece-burette-acid",
      },
      {
        code: "topic-standard-parallel-3",
        level: "warn",
        label: "平行测定 ≥3 份才够判断精密度",
        check: (plan) => has(plan, "piece-step-parallel") && count(plan, "parallelCount") >= 3,
        hint: "加「平行测定」步骤，并把平行次数设成 3",
        pieceId: "piece-step-parallel",
      },
    ],
  },
  {
    id: "topic-acid-acceptance",
    title: "新到浓盐酸验收（KHP 基准）",
    scene:
      "试剂库新到一车浓盐酸，标签写 37%；库管要签字入库，浓度签错，整学期的滴定都按错值算。",
    goal: "用 KHP 标定这批盐酸，报出实测 c(HCl) 与标签值的相对偏差，给出收货结论。",
    level: "进阶",
    difficulty: 2,
    constraints: [
      { text: "只认邻苯二甲酸氢钾（KHP）作基准物", ruleCode: "topic-acceptance-khp" },
      { text: "别再把 Na₂CO₃ 加进来：两套基准物的结果没法直接比", ruleCode: "topic-acceptance-single-standard" },
      { text: "收货结论要建立在平行 3 份 + 空白上", ruleCode: "topic-acceptance-parallel-blank" },
    ],
    featured: [
      "piece-khp",
      "piece-weighing-bottle",
      "piece-analytical-balance",
      "piece-param-drying",
      "piece-step-weigh",
      "piece-step-dissolve",
      "piece-step-rinse",
      "piece-burette-acid",
      "piece-step-degas",
      "piece-flask-250",
      "piece-step-parallel",
      "piece-param-parallel",
      "piece-step-blank",
    ],
    questions: [
      "KHP 的摩尔质量是 204.22 g/mol，你打算称多少克、让消耗体积落在滴定管的哪一段？",
      "实测比标签低 1.5%，你先怀疑配制、标定还是读数？怎么把这一项排除掉？",
    ],
    rules: [
      {
        code: "topic-acceptance-khp",
        level: "block",
        label: "本主题指定邻苯二甲酸氢钾为基准物",
        check: (plan) => has(plan, "piece-khp"),
        hint: "加「邻苯二甲酸氢钾（基准试剂）」",
        pieceId: "piece-khp",
      },
      {
        code: "topic-acceptance-single-standard",
        level: "warn",
        label: "两套基准物别混用：同一份报告只认一种",
        check: (plan) => !(has(plan, "piece-khp") && has(plan, "piece-na2co3-primary")),
        hint: "只留一种基准物，否则两份结果的可比性说不清",
        pieceId: "piece-na2co3-primary",
        forbidden: true,
      },
      {
        code: "topic-acceptance-parallel-blank",
        level: "block",
        label: "验收结论必须建立在平行 + 空白上",
        check: (plan) => has(plan, "piece-step-parallel") && has(plan, "piece-step-blank"),
        hint: "同时加「平行测定」和「空白试验」",
        pieceId: "piece-step-blank",
      },
    ],
  },
  {
    id: "topic-co2-blank",
    title: "CO₂ 干扰与终点判读专项",
    scene:
      "同一个纯碱样连测三次，结果一次比一次高；老实验员看了一眼说：水放了一夜，终点也判早了。",
    goal: "交一份只改这两处系统误差的方案：换水、煮沸、加空白，并把终点判据写死。",
    level: "进阶",
    difficulty: 2,
    constraints: [
      { text: "配液和空白都用新沸冷却的蒸馏水", ruleCode: "topic-co2-boiled-water" },
      { text: "样品煮沸驱 CO₂，空白同法处理", ruleCode: "topic-co2-boil-and-blank" },
      { text: "终点写清颜色 + 30 s 不褪，最后半滴靠壁洗入", ruleCode: "topic-co2-endpoint" },
    ],
    featured: [
      "piece-boiled-water",
      "piece-step-boil",
      "piece-step-blank",
      "piece-flask-250",
      "piece-burette-acid",
      "piece-step-rinse",
      "piece-phenolphthalein",
      "piece-methyl-orange",
      "piece-step-near-endpoint",
      "piece-step-half-drop",
      "piece-param-endpoint",
    ],
    questions: [
      "空白里没加样品却有读数，这个体积是从哪来的？",
      "终点 20 s 就褪色，你会补滴，还是把这一份重做？依据是什么？",
    ],
    rules: [
      {
        code: "topic-co2-boiled-water",
        level: "block",
        label: "必须用新沸冷却的蒸馏水",
        check: (plan) => has(plan, "piece-boiled-water"),
        hint: "加「新沸冷却蒸馏水」：敞口放置的水会重新溶入 CO₂",
        pieceId: "piece-boiled-water",
      },
      {
        code: "topic-co2-boil-and-blank",
        level: "block",
        label: "煮沸驱 CO₂ 与空白试验都要做",
        check: (plan) => has(plan, "piece-step-boil") && has(plan, "piece-step-blank"),
        hint: "两块都加上：一个管样品，一个管空白",
        pieceId: "piece-step-boil",
      },
      {
        code: "topic-co2-endpoint",
        level: "warn",
        label: "终点判据要写清颜色与稳定时间",
        check: (plan) => has(plan, "piece-param-endpoint") && has(plan, "piece-step-half-drop"),
        hint: "加「终点判据」参数块和「半滴操作」：最后半滴决定 0.02 mL",
        pieceId: "piece-param-endpoint",
      },
    ],
  },
  {
    id: "topic-soda-alkalinity",
    title: "工业纯碱总碱度测定",
    scene:
      "质检科老周收下一车工业纯碱，车间等着这批料进反应釜；总碱度按 Na₂CO₃ 计报低 1%，整车退货。",
    goal: "交一份双指示剂法方案：测出 V₁、V₂，扣掉空白，给出以 Na₂CO₃ 计的总碱度。",
    level: "综合",
    difficulty: 3,
    constraints: [
      { text: "酚酞在前、甲基橙在后，不能颠倒也不能混加", ruleCode: "topic-alkalinity-dual-indicator" },
      { text: "第二终点前必须煮沸驱 CO₂，否则终点判早", ruleCode: "topic-alkalinity-boil" },
      { text: "做空白试验，扣掉水和指示剂耗掉的酸", ruleCode: "topic-alkalinity-blank" },
    ],
    featured: [
      "piece-flask-250",
      "piece-burette-acid",
      "piece-step-rinse",
      "piece-step-degas",
      "piece-phenolphthalein",
      "piece-step-near-endpoint",
      "piece-step-half-drop",
      "piece-step-boil",
      "piece-methyl-orange",
      "piece-step-blank",
      "piece-param-endpoint",
      "piece-step-parallel",
    ],
    questions: [
      "加完甲基橙后 V₂ 为什么不是 V₁ 的简单相加？V₁、V₂ 各对应哪部分碱？",
      "空白占了 V₂ 的 3%，你会把它扣掉还是重做？依据是什么？",
    ],
    rules: [
      {
        code: "topic-alkalinity-dual-indicator",
        level: "block",
        label: "总碱度必须酚酞 + 甲基橙双指示剂",
        check: (plan) => has(plan, "piece-phenolphthalein") && has(plan, "piece-methyl-orange"),
        hint: "两块指示剂都要：先酚酞到微红消失，再甲基橙到黄→橙",
        pieceId: "piece-methyl-orange",
      },
      {
        code: "topic-alkalinity-boil",
        level: "block",
        label: "必须煮沸驱尽 CO₂",
        check: (plan) => has(plan, "piece-step-boil"),
        hint: "加「煮沸驱 CO₂」步骤：否则碳酸转成 CO₂ 逸出，第二步终点判早",
        pieceId: "piece-step-boil",
      },
      {
        code: "topic-alkalinity-blank",
        level: "warn",
        label: "必须有空白试验做校正",
        check: (plan) => has(plan, "piece-step-blank"),
        hint: "加「空白试验」：蒸馏水里溶的 CO₂ 会让结果系统性偏高",
        pieceId: "piece-step-blank",
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
      // 与基础规则一致，passed 存 code：评分卡靠 shortLabel(code) 出短名
      passed.push(rule.code);
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
