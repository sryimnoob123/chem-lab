/**
 * 素材块 → 回放动作。
 *
 * 学生拼完方案后要能「看见自己做的实验」：按他排的顺序，每块演一个动作，
 * 液体颜色、液面、指针这些化学反馈跟着动作走 —— 这比直接跳出一个分数更有教学价值。
 *
 * 映射按 id 精确写（31 块逐个对），不用关键词猜：
 * 关键词一改文案就会悄悄错配（比如「滴定管润洗」既是润洗又是滴定管）。
 */

import type { PlanPiece } from "./pieces";

export type MotionKind =
  /** 天平称量：药品落盘、指针归零 */
  | "weigh"
  /** 倾倒：瓶口倾斜、液流、受体液面上升 */
  | "pour"
  /** 定量转移/定容：液面升到刻度线 */
  | "transfer"
  /** 滴定：管尖逐滴、锥形瓶颜色渐变 */
  | "titrate"
  /** 加指示剂：一滴落下、液体轻微变色 */
  | "indicate"
  /** 旋摇/煮沸/润洗：器皿摇动 */
  | "swirl"
  /** 读数/判据：刻度与数字 */
  | "read";

const BY_ID: Record<string, MotionKind> = {
  // 器材
  "piece-analytical-balance": "weigh",
  "piece-weighing-bottle": "weigh",
  "piece-desiccator": "weigh",
  "piece-burette-acid": "titrate",
  "piece-burette-base": "titrate",
  "piece-pipette-25": "transfer",
  "piece-volumetric-250": "transfer",
  "piece-cylinder-10": "pour",
  "piece-flask-250": "swirl",
  // 试剂
  "piece-na2co3-primary": "weigh",
  "piece-khp": "weigh",
  "piece-hcl-conc": "pour",
  "piece-naoh-sat": "pour",
  "piece-boiled-water": "pour",
  "piece-phenolphthalein": "indicate",
  "piece-methyl-orange": "indicate",
  "piece-mixed-indicator": "indicate",
  // 步骤
  "piece-step-rinse": "swirl",
  "piece-step-weigh": "weigh",
  "piece-step-dissolve": "pour",
  "piece-step-dilute": "transfer",
  "piece-step-degas": "swirl",
  "piece-step-near-endpoint": "titrate",
  "piece-step-half-drop": "titrate",
  "piece-step-boil": "swirl",
  "piece-step-parallel": "titrate",
  "piece-step-blank": "titrate",
  // 参数
  "piece-param-conc": "read",
  "piece-param-sample": "read",
  "piece-param-endpoint": "read",
  "piece-param-parallel": "read",
  "piece-param-drying": "read",
};

/**
 * 兜底：映射表漏了某块时按 kind 给一个中庸动作（不会白屏，也不会演错戏）。
 * 新增块时应该补进 BY_ID —— rubric/回放测试会盯着「每个块都能拿到动作」。
 */
export function motionOf(piece: PlanPiece | undefined, id?: string): MotionKind {
  if (id && BY_ID[id]) return BY_ID[id];
  if (!piece) return "swirl";
  return BY_ID[piece.id] ?? (piece.kind === "param" ? "read" : piece.kind === "reagent" ? "pour" : "swirl");
}

/** 每个动作演多久（ms）。称量与滴定最需要看清，给长一点。 */
export const MOTION_MS: Record<MotionKind, number> = {
  weigh: 1700,
  pour: 1500,
  transfer: 1600,
  titrate: 1900,
  indicate: 1300,
  swirl: 1400,
  read: 1200,
};

/** 动作的旁白（一句，说这一块在做什么，不给学生额外讲义） */
export const MOTION_CAPTION: Record<MotionKind, string> = {
  weigh: "称取基准物",
  pour: "把溶液倒进容器",
  transfer: "定量转移并定容",
  titrate: "逐滴加入，看颜色转折",
  indicate: "加入指示剂",
  swirl: "旋摇摇匀",
  read: "读数并记录",
};
