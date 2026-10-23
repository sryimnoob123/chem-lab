/**
 * 拼接实验的评分标准（单一来源）。
 *
 * 为什么单独一个文件：这套 rubric 同时被三处用 ——
 *   1. AI 提示词（lib/plan/llm-assess.ts 的 buildPrompt 拼进去）
 *   2. 前端展示（分项名称与权重）
 *   3. 文档（docs/拼接实验-AI评分标准.md 贴同一份文字）
 * 写在一处才不会「提示词里一套、文档里一套、界面上一套」。
 *
 * 分工（用户 2026-10-23 定，融合了交接文档的原始需求）：
 *   - 规则引擎（lib/plan/rules.ts）→ 硬约束底线：违反硬约束或不可执行，无论如何不超过 59 分
 *   - AI → ① 先把方案总结成人话（学生拼了什么、顺序是什么）
 *          ② 按下面 5 个维度给分（0~100），加权成总分
 *          ③ 指出改哪一处最划算
 *   AI 的分不能突破规则底线（capScoreByReport 负责），无凭据时回落规则分。
 */

export type RubricDimension = {
  /** 维度名（≤4 字，界面直接显示） */
  name: string;
  /** 权重（合计 100） */
  weight: number;
  /** 判据：给 AI 看的同时也是教师看的说明书 */
  criteria: string;
  /** 给满分需要做到的 */
  full: string;
  /** 常见扣分点 */
  lose: string;
};

export const PLAN_RUBRIC: readonly RubricDimension[] = [
  {
    name: "完整性",
    weight: 30,
    criteria: "流程必需的环节是否齐全：基准物 → 称量 → 溶解/转移 → 定容 → 润洗 → 装液 → 排气调零 → 滴定 → 平行 → 记录",
    full: "上述环节一块不缺；缺一块就是缺一个可执行环节",
    lose: "缺基准物、缺平行测定、缺润洗、缺排气泡、缺终点判据 —— 每缺一项扣 8~12 分",
  },
  {
    name: "顺序",
    weight: 25,
    criteria: "块的先后是否符合操作规程（顺序即流程）",
    full: "先洗涤后装液、先排气后调零、先稀释后定容、平行样在前计算在后",
    lose: "把定容排在溶解前、把调零排在装液前、指示剂加在滴定之后 —— 每处 6~10 分",
  },
  {
    name: "参数",
    weight: 20,
    criteria: "数值与器材规格是否说得通：浓度、平行次数与极差、干燥温度与时间、读数精度、指示剂滴数",
    full: "浓度落在合理区间、平行 ≥3 份且极差 ≤0.2%、基准物 270~300 ℃ 干 1 h、读数到 0.01 mL",
    lose: "浓度离谱、平行只做 1 份、极差写成 5%、干燥温度写成 105 ℃ —— 每处 5~10 分",
  },
  {
    name: "安全规范",
    weight: 15,
    criteria: "是否遵守本课的硬性安全操作",
    full: "酸入水、通风柜内取浓酸、移液用洗耳球、废液进指定容器、玻璃活塞对酸",
    lose: "水入浓酸、口吸移液、碱式管装酸、废液随手倒 —— 每处 10~15 分（这类通常已被规则判硬约束）",
  },
  {
    name: "记录与表达",
    weight: 10,
    criteria: "方案有没有交代清楚「记什么、怎么判、算到几位」",
    full: "写出记录项（初读数/终读数/体积）、终点判据（颜色变化 + 保持时间）、结果保留 4 位有效数字",
    lose: "只写「滴定至终点」不写判据、不写平行数据表、有效数字不交代 —— 每处 3~5 分",
  },
] as const;

/** 各维度满分时的锚点，供 prompt 引用（避免模板里写死数字） */
export function rubricLines(): string[] {
  return PLAN_RUBRIC.map(
    (d, i) =>
      `${i + 1}. ${d.name}（占 ${d.weight}%）：${d.criteria}。做到：${d.full}。常见扣分：${d.lose}`,
  );
}

/** 权重合计校验（改 rubric 时测试会盯着这个） */
export const RUBRIC_WEIGHT_TOTAL = PLAN_RUBRIC.reduce((sum, d) => sum + d.weight, 0);
