/**
 * 拼接式方案设计 —— 本地规则引擎（18 条指定 + 3 条补充，共 21 条）
 *
 * 判据来源：`docs/实验库/exp10.md` §3（原理与计量关系）、§6（分步动作）、§7（事故点），
 * 以及 `docs/接口契约.md` §9（`/api/design/validate` 的返回形状）。
 * 纯函数：不读全局、不发网络、无随机；同一 plan 永远得到同一份报告。
 *
 * 评分（产品口径）：满分 100，block −12、warn −5，最低 0；`feasible = 没有任何 block`。
 */

import { getPiece, hasPiece, type PlanInput } from "./pieces";

export type RuleLevel = "block" | "warn";

export interface PlanRule {
  /** 稳定英文 code，进 API 与日志 */
  code: string;
  /** 老师能直接读懂的一句话判据 */
  label: string;
  level: RuleLevel;
  /** 返回 true = 通过 */
  check: (plan: PlanInput) => boolean;
  /** 修复提示（UI 显示在违规项下方） */
  hint: string;
}

export interface PlanIssue {
  /** 与契约 §9 的 issues[].ruleId 对齐 */
  ruleId: string;
  level: RuleLevel;
  text: string;
  hint: string;
}

export interface PlanReport {
  issues: PlanIssue[];
  passed: string[];
  /** 每条规则是否通过（UI 画 21 盏灯） */
  byRule: Record<string, boolean>;
  score: number;
  feasible: boolean;
  blockCount: number;
  warnCount: number;
}

const str = (plan: PlanInput, key: string): string | undefined => {
  const v = plan.params?.[key];
  return typeof v === "string" ? v : undefined;
};
const num = (plan: PlanInput, key: string): number | undefined => {
  const v = plan.params?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};
const bool = (plan: PlanInput, key: string): boolean | undefined => {
  const v = plan.params?.[key];
  return typeof v === "boolean" ? v : undefined;
};

export const RULES: readonly PlanRule[] = [
  {
    code: "std-primary-standard", level: "block",
    label: "HCl 标定必须用基准物质（无水 Na₂CO₃ 或 KHP），不能拿浓度未知的浓盐酸当标准",
    hint: "加入「无水 Na₂CO₃（基准试剂）」块，用差减法称 3 份。",
    check: (p) => hasPiece(p, "piece-na2co3-primary") || hasPiece(p, "piece-khp"),
  },
  {
    code: "total-alkalinity-dual-indicator", level: "block",
    label: "总碱度必须双指示剂法：酚酞在前（V₁）、甲基橙在后（V₂），不能颠倒或混加",
    hint: "同时放入酚酞与甲基橙两块；顺序必须「先酚酞、后甲基橙」。",
    check: (p) =>
      hasPiece(p, "piece-phenolphthalein") &&
      hasPiece(p, "piece-methyl-orange") &&
      !["reversed", "mixed"].includes(str(p, "indicatorOrder") ?? ""),
  },
  {
    code: "endpoint-color-criterion", level: "warn",
    label: "终点必须写清颜色判据：酚酞「微红刚好消失」、甲基橙「黄→橙」并维持 30 s 不褪",
    hint: "勾选「终点判据」参数块，并选定颜色变化方向。",
    check: (p) =>
      hasPiece(p, "piece-param-endpoint") &&
      (str(p, "endpoint") ?? "unspecified") !== "unspecified",
  },
  {
    code: "burette-rinse", level: "block",
    label: "滴定管必须洗涤并用待装液润洗 3 次，否则内壁水膜稀释溶液、浓度系统性偏低",
    hint: "把「洗涤与润洗」步骤块拖到装液之前。",
    check: (p) => hasPiece(p, "piece-step-rinse"),
  },
  {
    code: "burette-degas-zero", level: "block",
    label: "装液后必须排尽尖嘴气泡并调至 0.00 mL，气泡逸出会让读数跳变 0.05~0.3 mL",
    hint: "加入「排气泡与调零」步骤块。",
    check: (p) => hasPiece(p, "piece-step-degas"),
  },
  {
    code: "primary-standard-dried", level: "block",
    label: "基准物须在 270~300 ℃ 干燥 1 h 并置干燥器冷至室温；受潮或热称都会让 m 偏大",
    hint: "加入「基准物干燥制度」参数块，设 dryTemp 270~300、dryHours ≥1。",
    check: (p) => {
      const t = num(p, "dryTemp");
      const h = num(p, "dryHours");
      return hasPiece(p, "piece-param-drying") && t !== undefined && t >= 270 && t <= 300 && h !== undefined && h >= 1;
    },
  },
  {
    code: "analytical-balance", level: "block",
    label: "必须用分析天平（0.1 mg），托盘天平只有 0.1 g，有效数字不够",
    hint: "加入「分析天平」块；称量前调水平、预热 ≥30 min、内校回零。",
    check: (p) => hasPiece(p, "piece-analytical-balance"),
  },
  {
    code: "parallel-min-and-range", level: "block",
    label: "平行测定不少于 2 份（推荐 3 份），且极差 ≤0.2% 才能取平均",
    hint: "加入「平行测定」步骤块与「平行次数 2~3 份」参数块，份数 ≥2、极差 ≤0.2%。",
    check: (p) => {
      const n = num(p, "parallelCount");
      const range = num(p, "parallelRangePct");
      return (
        hasPiece(p, "piece-step-parallel") &&
        n !== undefined && n >= 2 &&
        range !== undefined && range >= 0 && range <= 0.2
      );
    },
  },
  {
    code: "conc-acid-into-water", level: "block",
    label: "浓盐酸只能「酸入水、沿壁、边加边搅拌」，且全程在通风橱内；水入酸会局部过热、酸雾喷溅",
    hint: "参数 acidOrder 选 acid-into-water，hood 设 true，并配护目镜+丁腈手套。",
    check: (p) =>
      !hasPiece(p, "piece-hcl-conc") ||
      (str(p, "acidOrder") === "acid-into-water" && bool(p, "hood") === true),
  },
  {
    code: "naoh-co2-free-water", level: "block",
    label: "NaOH 溶液必须用新沸冷却的蒸馏水配制，否则溶解 CO₂ 生成 CO₃²⁻，标定值偏低",
    hint: "加入「新沸冷却蒸馏水」块；不要用放置过夜的蒸馏水。",
    check: (p) => !hasPiece(p, "piece-naoh-sat") || hasPiece(p, "piece-boiled-water"),
  },
  {
    code: "no-mouth-pipetting", level: "block",
    label: "移液必须用洗耳球，严禁口吸；腐蚀性液体直接吸入口腔不可逆",
    hint: "参数 pipetteAid 选 rubber-bulb，并把洗耳球放在手边。",
    check: (p) =>
      !hasPiece(p, "piece-pipette-25") || str(p, "pipetteAid") === "rubber-bulb",
  },
  {
    code: "flask-receiving", level: "block",
    label: "滴定必须用锥形瓶承接，锥底便于旋摇、可衬白瓷板比色判终点",
    hint: "加入「锥形瓶 250 mL」块；每人 6 只（标定 3 + 滴定 3）。",
    check: (p) => hasPiece(p, "piece-flask-250"),
  },
  {
    code: "half-drop-touch-wall", level: "warn",
    label: "半滴必须挂管尖后靠瓶内壁，用洗瓶吹入并摇匀，否则局部过量、终点提前",
    hint: "加入「半滴操作」块，参数 halfDrop 选 touch-wall-rinse。",
    check: (p) =>
      hasPiece(p, "piece-step-half-drop") && str(p, "halfDrop") === "touch-wall-rinse",
  },
  {
    code: "near-endpoint-dropwise", level: "warn",
    label: "近终点必须逐滴加入并边加边摇，成线流会造成局部过量、终点反复",
    hint: "加入「滴定至近终点」步骤块。",
    check: (p) => hasPiece(p, "piece-step-near-endpoint"),
  },
  {
    code: "indicator-1-2-drops", level: "warn",
    label: "指示剂每次 1~2 滴即可；加太多本身耗酸且颜色过深、终点拖后",
    hint: "参数 indicatorDrops 设 1 或 2（酚酞、甲基橙各 2 滴）。",
    check: (p) => {
      const d = num(p, "indicatorDrops");
      return d !== undefined && d >= 1 && d <= 2;
    },
  },
  {
    code: "parallel-same-batch", level: "warn",
    label: "平行各份必须同批试剂、同支滴定管、同一人操作，否则不平行不可比",
    hint: "参数 sameBatch 设 true；中途换试剂或换管须从头重做。",
    check: (p) => bool(p, "sameBatch") === true,
  },
  {
    code: "reading-two-decimals", level: "block",
    label: "滴定管读数须三位一线、估读到 0.01 mL（记两位小数），否则有效数字不成立",
    hint: "参数 readingResolution 设 0.01；初读数如实记录并参与计算。",
    check: (p) => num(p, "readingResolution") === 0.01,
  },
  {
    code: "endpoint-hold-30s", level: "warn",
    label: "终点须维持 30 s 不褪色再判读；刚变色就读会把「假终点」当成结果",
    hint: "参数 endpointHoldSec 设 ≥30，计时后再读终读数。",
    check: (p) => {
      const t = num(p, "endpointHoldSec");
      return t !== undefined && t >= 30;
    },
  },
  // ── 以下 3 条是本层补充的真实约束 ──────────────────────────────────
  {
    code: "standardization-boil-co2", level: "block",
    label: "Na₂CO₃ 标定 HCl 必须煮沸 2 min 驱尽 CO₂，否则 H₂CO₃ 缓冲使终点返黄、V 偏小",
    hint: "加入「煮沸驱 CO₂」块：微沸 2 min、瓶口朝无人侧、冷却后补滴。",
    check: (p) => hasPiece(p, "piece-step-boil"),
  },
  {
    code: "blank-test", level: "warn",
    label: "应做空白试验校正指示剂与蒸馏水耗酸，否则系统误差直接进结果",
    hint: "加入「空白试验」块：不加试样同法滴定，从 V 中扣掉空白值。",
    check: (p) => hasPiece(p, "piece-step-blank"),
  },
  {
    code: "acid-base-burette-match", level: "block",
    label: "酸液用酸式（玻璃活塞）滴定管、碱液用碱式（橡胶管+玻璃珠）滴定管，不可混用",
    hint: "HCl 配「酸式滴定管」，NaOH 配「碱式滴定管」；碱装酸式管会腐蚀磨口致活塞崩裂。",
    check: (p) =>
      (!hasPiece(p, "piece-hcl-conc") || hasPiece(p, "piece-burette-acid")) &&
      (!hasPiece(p, "piece-naoh-sat") || hasPiece(p, "piece-burette-base")),
  },
];

export const RULES_BY_CODE: Readonly<Record<string, PlanRule>> = Object.freeze(
  Object.fromEntries(RULES.map((r) => [r.code, r])),
);

export const BLOCK_DEDUCT = 12;
export const WARN_DEDUCT = 5;
export const MAX_SCORE = 100;

/** 跑全部规则，产出可解释报告（确定性，无副作用） */
export function validate(plan: PlanInput): PlanReport {
  const issues: PlanIssue[] = [];
  const passed: string[] = [];
  const byRule: Record<string, boolean> = {};

  for (const rule of RULES) {
    let ok = false;
    try {
      ok = rule.check(plan) === true;
    } catch {
      ok = false; // 单条规则异常不许拖垮整份报告
    }
    byRule[rule.code] = ok;
    if (ok) {
      passed.push(rule.code);
    } else {
      issues.push({ ruleId: rule.code, level: rule.level, text: rule.label, hint: rule.hint });
    }
  }

  const blockCount = issues.filter((i) => i.level === "block").length;
  const warnCount = issues.length - blockCount;
  const deducted = blockCount * BLOCK_DEDUCT + warnCount * WARN_DEDUCT;

  return {
    issues,
    passed,
    byRule,
    score: Math.max(0, MAX_SCORE - deducted),
    feasible: blockCount === 0,
    blockCount,
    warnCount,
  };
}

/** 契约 §9 `/api/design/validate` 的响应体（路由层直接返回） */
export function toApiResult(report: PlanReport): {
  ok: boolean;
  score: number;
  issues: Array<{ ruleId: string; level: RuleLevel; text: string }>;
} {
  return {
    ok: report.feasible,
    score: report.score,
    issues: report.issues.map((i) => ({ ruleId: i.ruleId, level: i.level, text: i.text })),
  };
}

/** 方案里是否有未知块 id（UI 侧上报 400 用） */
export function unknownPieces(plan: PlanInput): string[] {
  return plan.pieces.filter((id) => getPiece(id) === undefined);
}
