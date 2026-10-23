/**
 * 拼接方案的**本地点评**（离线 / mock provider）。
 *
 * 这是全站唯一的离线点评实现：客户端先渲染它（不白屏、不等网络），
 * 服务端在没凭据、超时、限流、坏 JSON 时也回退到它（`llm-assess.ts`）。
 * 纯函数、不读 env、不发网络，所以能直接进 client bundle。
 *
 * 约束：
 * - 每条 point 必须指到具体 `pieceId` 或 `ruleId`，不写"方案很好，继续加油"；
 * - 三类 good / risk / todo 各管一件事：做对了什么、哪里会掉分、下一步改哪；
 * - questions 最多 2 条，优先用主题自带的追问池（每条都能推动学生改方案）。
 */

import { PIECES_BY_ID, type PlanInput } from "./pieces";
import type { PlanIssue, PlanReport } from "./rules";
import type { PlanTopic } from "./topics";

export type AssessPointKind = "good" | "risk" | "todo";

export type AssessPoint = {
  kind: AssessPointKind;
  /** 指到具体素材块 */
  pieceId?: string;
  /** 指到具体规则 */
  ruleId?: string;
  text: string;
};

/**
 * 通道名：
 *   mock —— 本地点评（无凭据 / 云端失败）
 *   coze —— 扣子 v3/chat（PAT 或企业 JWT）
 *   ark  —— OpenAI 兼容端点（方舟 / DeepSeek / 自建网关）
 *   sdk  —— 扣子编程运行时 SDK（平台内零配置，见 lib/ai/sdk-llm.ts）
 */
export type AssessProvider = "mock" | "coze" | "ark" | "sdk";

/** 云端没给出结果的原因：UI 只用它写一行小字，不改渲染结构 */
export type AssessFallback = "timeout" | "rate-limit" | "http" | "empty" | "error" | "network";

export type LlmAssessResult = {
  provider: AssessProvider;
  text: string;
  points: AssessPoint[];
  questions: string[];
  /** 只有「试过云端但失败」才出现 */
  fallback?: AssessFallback;
  /** points 是模型给的还是本地规则给的（模型坏 JSON 时用本地兜底） */
  pointsFrom?: "model" | "local";
  /**
   * 模型给的分（0~100）。用户 2026-10-23 定：拼接方案**由 AI 评分**，规则不再当最终分。
   * 没有（离线 / 模型没给 / 坏 JSON）就留空，前端回落规则分并标注来源。
   */
  score?: number;
  /** 分项得分（模型给，最多 4 条）；没有就不显示分项 */
  dimensions?: AssessDimension[];
  /** 方案总结：AI 用自己的话复述学生拼了什么流程（学生看得懂「我刚才做了啥」） */
  summary?: string;
  /** 分数来自模型还是规则 */
  scoreFrom?: "model" | "rule";
  /**
   * 点评文字的来源。
   * 参考项目「实验合并」的做法（2026-10-23 复核）：分数由确定性脚本算，
   * 模型只负责把「哪里对、哪里不行」讲成人话 —— 分稳、输出短、也快。
   * 我们两端都留：`PLAN_SCORE_SOURCE=rule`（默认）时模型不给分，只写点评。
   */
  commentSource?: "model" | "local";
};

/** 分项得分：一项 = 一个维度（顺序 / 完整 / 参数 / 安全） */
export type AssessDimension = { name: string; score: number; note?: string };

/** 片段小知识库：good 要点用它说明"为什么这块留得住" */
const PIECE_NOTES: Readonly<Record<string, string>> = {
  "piece-analytical-balance": "分析天平 0.1 mg，基准物称量才记得住 4 位有效数字",
  "piece-burette-acid": "盐酸走酸式滴定管，玻璃活塞不会被酸腐蚀",
  "piece-burette-base": "碱式滴定管是橡胶管 + 玻璃珠，装酸会老化漏液",
  "piece-pipette-25": "移液管取 25.00 mL 比量筒精确两个数量级",
  "piece-volumetric-250": "容量瓶定容到刻度，稀释倍数才说得清",
  "piece-flask-250": "锥形瓶承接、锥底便于旋摇，也方便衬白瓷板比色",
  "piece-cylinder-10": "量筒只用来量取浓盐酸的粗体积，不参与定量",
  "piece-weighing-bottle": "称量瓶差减法，瓶盖随开随盖，基准物不吸潮",
  "piece-desiccator": "干燥器把基准物冷到室温再称，避免热称偏轻",
  "piece-na2co3-primary": "无水 Na₂CO₃ 摩尔质量大、称量相对误差小，是标定 HCl 的常规选择",
  "piece-khp": "KHP 稳定、易纯化，作基准物能把称量误差压下去",
  "piece-hcl-conc": "浓盐酸 37% 只能稀释成近似浓度，本身不能当标准液",
  "piece-naoh-sat": "NaOH 饱和液静置后取清液，碳酸盐先沉掉",
  "piece-phenolphthalein": "酚酞管第一终点：微红刚好消失",
  "piece-methyl-orange": "甲基橙管第二终点：黄→橙且 30 s 不褪",
  "piece-mixed-indicator": "混合指示剂变色更锐，标定终点更好判",
  "piece-boiled-water": "新沸冷却的水赶掉了溶入的 CO₂，配液和空白都要用它",
  "piece-step-rinse": "洗涤后用待装液润洗 3 次，内壁水膜才不会稀释溶液",
  "piece-step-weigh": "差减法称量，m₁−m₂ 就是实际取用量",
  "piece-step-dissolve": "溶解后定量转移、洗 3 次，样品一点不留在烧杯里",
  "piece-step-dilute": "定容后倒转摇匀 ≥10 次，浓度才均匀",
  "piece-step-degas": "排尽尖嘴气泡再调 0.00 mL，读数才不会跳",
  "piece-step-near-endpoint": "近终点逐滴加入、边加边摇，避免局部过量",
  "piece-step-half-drop": "半滴挂管尖、靠壁洗入，最后 0.02 mL 才拿得准",
  "piece-step-boil": "煮沸驱 CO₂：碳酸转成 CO₂ 逸出，第二步终点才不会判早",
  "piece-step-parallel": "平行 3 份才看得出精密度，单次结果没有说服力",
  "piece-step-blank": "空白把水和指示剂耗掉的酸扣掉，是系统误差的常规处理",
  "piece-param-conc": "先配近似浓度再标定，比直接配准现实",
  "piece-param-sample": "称样量控制在滴定管 1/2~2/3，读数的相对误差最小",
  "piece-param-endpoint": "终点判据写死颜色和稳定时间，换个人也能判一致",
  "piece-param-parallel": "平行次数与极差上限写进方案，精密度才有判据",
  "piece-param-drying": "270~300 ℃ 干燥 1 h，基准物不带水再称",
};

/** 基础规则 → 通常的责任片段（点评要指到块上） */
const RULE_PIECE: Readonly<Record<string, string>> = {
  "std-primary-standard": "piece-na2co3-primary",
  "analytical-balance": "piece-analytical-balance",
  "burette-rinse": "piece-step-rinse",
  "burette-degas-zero": "piece-step-degas",
  "primary-standard-dried": "piece-param-drying",
  "parallel-min-and-range": "piece-step-parallel",
  "parallel-same-batch": "piece-step-parallel",
  "no-mouth-pipetting": "piece-pipette-25",
  "flask-receiving": "piece-flask-250",
  "half-drop-touch-wall": "piece-step-half-drop",
  "near-endpoint-dropwise": "piece-step-near-endpoint",
  "indicator-1-2-drops": "piece-phenolphthalein",
  "endpoint-hold-30s": "piece-param-endpoint",
  "endpoint-color-criterion": "piece-param-endpoint",
  "standardization-boil-co2": "piece-step-boil",
  "blank-test": "piece-step-blank",
  "acid-base-burette-match": "piece-burette-acid",
  "total-alkalinity-dual-indicator": "piece-methyl-orange",
  "conc-acid-into-water": "piece-hcl-conc",
  "naoh-co2-free-water": "piece-boiled-water",
  "reading-two-decimals": "piece-burette-acid",
};

/** 没选主题时的追问池（主题会覆盖它） */
const GENERIC_QUESTIONS: readonly string[] = [
  "这个方案里哪一步的误差最大？你用什么办法把它压到 0.2% 以内？",
  "如果平行两份的极差超过 0.4%，你会先重做哪一份、为什么？",
];

export function pieceTitle(id: string): string {
  return PIECES_BY_ID[id]?.title ?? id;
}

function noteOf(id: string): string {
  return PIECE_NOTES[id] ?? PIECES_BY_ID[id]?.sub ?? "";
}

/** 该条问题应该指到哪一块：主题规则优先，其次基础规则映射 */
function pieceOfRule(ruleId: string, topic: PlanTopic | undefined): string | undefined {
  return topic?.rules.find((rule) => rule.code === ruleId)?.pieceId ?? RULE_PIECE[ruleId];
}

function sortIssues(issues: readonly PlanIssue[]): PlanIssue[] {
  return [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "block" ? -1 : 1));
}

/**
 * 本地点评：确定性输出，但**具体到片段**。
 * good ≤2 条、risk ≤2 条、todo 1 条；每条都带 pieceId 或 ruleId。
 */
export function mockAssess(plan: PlanInput, report: PlanReport, topic?: PlanTopic): LlmAssessResult {
  const points: AssessPoint[] = [];
  const issues = sortIssues(report.issues);

  // ① 做对了什么：主题推荐的块优先，其次按方案顺序
  const goodOrder = topic
    ? [...topic.featured.filter((id) => plan.pieces.includes(id)), ...plan.pieces]
    : [...plan.pieces];
  const goodIds: string[] = [];
  for (const id of goodOrder) {
    if (goodIds.includes(id) || !PIECES_BY_ID[id]) continue;
    if (plan.pieces.includes(id)) goodIds.push(id);
    if (goodIds.length === 2) break;
  }
  for (const id of goodIds) {
    points.push({ kind: "good", pieceId: id, text: `「${pieceTitle(id)}」留对了：${noteOf(id)}。` });
  }

  // ② 哪里会掉分：硬约束优先，指到责任块
  for (const issue of issues.slice(0, 2)) {
    const pieceId = pieceOfRule(issue.ruleId, topic);
    const missing = pieceId !== undefined && !plan.pieces.includes(pieceId);
    points.push({
      kind: "risk",
      ruleId: issue.ruleId,
      pieceId,
      text: pieceId
        ? missing
          ? `还缺「${pieceTitle(pieceId)}」：${issue.text} —— ${issue.hint}`
          : `问题出在「${pieceTitle(pieceId)}」：${issue.text} —— ${issue.hint}`
        : `${issue.text} —— ${issue.hint}`,
    });
  }

  // ③ 下一步只给一个动作，且一定落在某一快上；不复述上一条的整段理由
  const firstRisk = points.find((point) => point.kind === "risk");
  const topIncomplete = topic?.rules.find((rule) => !rule.check(plan));
  const nextIssue = issues[0];
  if (firstRisk?.pieceId) {
    const missing = !plan.pieces.includes(firstRisk.pieceId);
    points.push({
      kind: "todo",
      pieceId: firstRisk.pieceId,
      ruleId: firstRisk.ruleId,
      text: missing
        ? `下一步：把「${pieceTitle(firstRisk.pieceId)}」加进来，评分卡会立刻变。`
        : `下一步：改「${pieceTitle(firstRisk.pieceId)}」这一块，把这条判据补上。`,
    });
  } else if (topIncomplete) {
    points.push({
      kind: "todo",
      pieceId: topIncomplete.pieceId,
      ruleId: topIncomplete.code,
      text: `下一步：${topIncomplete.hint}（改「${pieceTitle(topIncomplete.pieceId)}」这一块）。`,
    });
  } else if (nextIssue) {
    const pieceId = pieceOfRule(nextIssue.ruleId, topic);
    points.push({
      kind: "todo",
      pieceId,
      ruleId: nextIssue.ruleId,
      text: `下一步：${nextIssue.hint}${pieceId ? `（先看「${pieceTitle(pieceId)}」）` : ""}。`,
    });
  } else {
    const anchor = topic?.featured.find((id) => plan.pieces.includes(id)) ?? plan.pieces[0] ?? "piece-step-weigh";
    points.push({
      kind: "todo",
      pieceId: anchor,
      text: `下一步：把这份方案带进操作台，从「${pieceTitle(anchor)}」开始，每步记读数与终点颜色。`,
    });
  }

  // 结论先行：一句能不能做，再点最要紧的一处
  const head = report.feasible
    ? report.warnCount > 0
      ? `方案能执行，但有 ${report.warnCount} 处会掉分。`
      : `方案能执行，规则 ${report.score} 分。`
    : `方案现在做不了：${report.blockCount} 条硬约束没过。`;
  // 结论 = 一句能不能做 + 先动哪一块；细节留给下面的 risk 要点，不在结论里重复整段理由
  const tail = firstRisk
    ? firstRisk.pieceId
      ? `先处理「${pieceTitle(firstRisk.pieceId)}」。`
      : "先看下面第一条。"
    : report.feasible && report.warnCount === 0
      ? "结构和顺序都对，可以进操作台验证。"
      : "";

  const questions = (topic?.questions.length ? topic.questions : GENERIC_QUESTIONS)
    .filter((question) => typeof question === "string" && question.trim().length > 0)
    .slice(0, 2);

  return {
    provider: "mock",
    text: `${head}${tail}`,
    points,
    questions,
    pointsFrom: "local",
  };
}
