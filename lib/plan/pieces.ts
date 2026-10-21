/**
 * 拼接式方案设计 —— 素材块库（apparatus / reagent / step / param）
 *
 * 学生在画布上把这些块拖进流程线拼出实验方案（实验 10《盐酸标准溶液的标定与工业纯碱总碱度的测定》），
 * 本地规则引擎（`lib/plan/rules.ts`）逐条验证，纯前端、零网络、可解释。
 *
 * 块 id 是规则与 API 的唯一契约：`POST /api/design/validate { pieces: string[] }`（契约 §9）。
 * `demoId` 按契约 §10 命名：`demo-design-piece-<slug>`。
 */

export type PieceKind = "apparatus" | "reagent" | "step" | "param";

export interface PlanPiece {
  /** piece-… 全局唯一，规则只看这个 */
  id: string;
  kind: PieceKind;
  /** 画布上的一行大字 */
  title: string;
  /** 副标题：规格/精度/化学依据，一行说清 */
  sub: string;
  /** UI 分类筛选与规则提示用，不做判定 */
  tags: string[];
  /** data-demo-id（契约 §10） */
  demoId: string;
}

/** 学生提交的方案（画布状态的最小投影） */
export interface PlanInput {
  /** 已放入画布的块 id；顺序即流程顺序 */
  pieces: readonly string[];
  /** 参数块的取值，如 { dryTemp: 280, parallelCount: 3 } */
  params?: Readonly<Record<string, string | number | boolean>>;
}

export const PIECE_KINDS: readonly PieceKind[] = ["apparatus", "reagent", "step", "param"];

export const PIECES: readonly PlanPiece[] = [
  // ── 器材 9 ──────────────────────────────────────────────────────────
  {
    id: "piece-analytical-balance", kind: "apparatus",
    title: "分析天平", sub: "200 g / 0.1 mg，称量前调水平、预热、内校后回零", tags: ["称量", "0.1 mg", "基准物"],
    demoId: "demo-design-piece-analytical-balance",
  },
  {
    id: "piece-burette-acid", kind: "apparatus",
    title: "酸式滴定管", sub: "50 mL，玻璃活塞，分度 0.1 mL、估读 0.01 mL", tags: ["滴定", "酸液", "读数"],
    demoId: "demo-design-piece-burette-acid",
  },
  {
    id: "piece-burette-base", kind: "apparatus",
    title: "碱式滴定管", sub: "50 mL，橡胶管+玻璃珠，碱液专用", tags: ["滴定", "碱液"],
    demoId: "demo-design-piece-burette-base",
  },
  {
    id: "piece-pipette-25", kind: "apparatus",
    title: "移液管 25.00 mL", sub: "A 级 ±0.03 mL，必须配洗耳球、润洗 3 次", tags: ["移液", "润洗", "禁口吸"],
    demoId: "demo-design-piece-pipette",
  },
  {
    id: "piece-volumetric-250", kind: "apparatus",
    title: "容量瓶 250 mL", sub: "刻度至 0.1 mL，定容后倒转摇匀 ≥10 次", tags: ["定容", "摇匀"],
    demoId: "demo-design-piece-volumetric-flask",
  },
  {
    id: "piece-flask-250", kind: "apparatus",
    title: "锥形瓶 250 mL", sub: "滴定承接容器，锥底便于旋摇、衬白瓷板比色", tags: ["承接", "滴定"],
    demoId: "demo-design-piece-conical-flask",
  },
  {
    id: "piece-cylinder-10", kind: "apparatus",
    title: "量筒 10 mL", sub: "±0.1 mL，量取约 8.5 mL 浓盐酸", tags: ["量取", "浓盐酸"],
    demoId: "demo-design-piece-cylinder",
  },
  {
    id: "piece-weighing-bottle", kind: "apparatus",
    title: "称量瓶（扁形）", sub: "40×25 mm，差减法称量，瓶盖随开随盖", tags: ["称量", "基准物", "防吸湿"],
    demoId: "demo-design-piece-weighing-bottle",
  },
  {
    id: "piece-desiccator", kind: "apparatus",
    title: "干燥器", sub: "内装变色硅胶，基准物冷却至室温并防吸湿", tags: ["干燥", "恒重"],
    demoId: "demo-design-piece-desiccator",
  },

  // ── 试剂 8 ──────────────────────────────────────────────────────────
  {
    id: "piece-na2co3-primary", kind: "reagent",
    title: "无水 Na₂CO₃（基准试剂）", sub: "≥99.95%，M=105.99 g/mol，标定 HCl 首选", tags: ["基准物", "标定 HCl"],
    demoId: "demo-design-piece-sodium-carbonate",
  },
  {
    id: "piece-khp", kind: "reagent",
    title: "邻苯二甲酸氢钾（基准试剂）", sub: "KHP，M=204.22 g/mol，标定 NaOH 用", tags: ["基准物", "标定 NaOH"],
    demoId: "demo-design-piece-potassium-hydrogen-phthalate",
  },
  {
    id: "piece-hcl-conc", kind: "reagent",
    title: "浓盐酸 37%", sub: "ρ≈1.19 g/mL、c≈12 mol/L，通风橱内原瓶取用", tags: ["腐蚀", "通风橱", "酸入水"],
    demoId: "demo-design-piece-concentrated-hcl",
  },
  {
    id: "piece-naoh-sat", kind: "reagent",
    title: "NaOH 饱和溶液", sub: "须用新沸冷却水稀释，排除 CO₃²⁻ 干扰", tags: ["碱", "CO₂", "饱和液"],
    demoId: "demo-design-piece-naoh-saturated",
  },
  {
    id: "piece-phenolphthalein", kind: "reagent",
    title: "酚酞 0.2%（乙醇）", sub: "变色 pH 8.2~10.0，第一终点「微红刚好消失」", tags: ["指示剂", "第一终点", "双指示剂"],
    demoId: "demo-design-piece-phenolphthalein",
  },
  {
    id: "piece-methyl-orange", kind: "reagent",
    title: "甲基橙 0.1%（水）", sub: "变色 pH 3.1~4.4，黄→橙，第二终点/标定终点", tags: ["指示剂", "第二终点", "标定"],
    demoId: "demo-design-piece-methyl-orange",
  },
  {
    id: "piece-mixed-indicator", kind: "reagent",
    title: "甲基红-溴甲酚绿", sub: "变色 pH≈5.1（红→绿），盐酸标定可用", tags: ["指示剂", "混合", "标定"],
    demoId: "demo-design-piece-mixed-indicator",
  },
  {
    id: "piece-boiled-water", kind: "reagent",
    title: "新沸冷却蒸馏水", sub: "驱除溶解 CO₂，配 NaOH 与稀溶液专用", tags: ["CO₂", "水", "无碳酸"],
    demoId: "demo-design-piece-boiled-water",
  },

  // ── 步骤 10 ─────────────────────────────────────────────────────────
  {
    id: "piece-step-rinse", kind: "step",
    title: "洗涤与润洗", sub: "洗涤→自来水→蒸馏水 3 次→待装液润洗 3 次（每次约 5 mL）", tags: ["润洗", "滴定管", "移液管"],
    demoId: "demo-design-piece-rinse",
  },
  {
    id: "piece-step-weigh", kind: "step",
    title: "基准物差减法称量", sub: "称量瓶连盖称 m₁，转移后复称 m₂，差值即取用量", tags: ["差减法", "称量", "4 位有效数字"],
    demoId: "demo-design-piece-weigh",
  },
  {
    id: "piece-step-dissolve", kind: "step",
    title: "溶解与定量转移", sub: "加约 50 mL 水溶解，玻璃棒引流、洗 3 次全量转入", tags: ["溶解", "转移", "定量"],
    demoId: "demo-design-piece-dissolve",
  },
  {
    id: "piece-step-dilute", kind: "step",
    title: "定容摇匀", sub: "定容至刻度、盖塞倒转摇匀 ≥10 次再移取", tags: ["定容", "摇匀"],
    demoId: "demo-design-piece-dilute",
  },
  {
    id: "piece-step-degas", kind: "step",
    title: "排气泡与调零", sub: "装液至零刻度上方，放液冲出尖嘴气泡，再调至 0.00 mL", tags: ["排气泡", "调零", "滴定管"],
    demoId: "demo-design-piece-degas",
  },
  {
    id: "piece-step-near-endpoint", kind: "step",
    title: "滴定至近终点", sub: "先快后慢；近终点逐滴加入，边加边旋摇", tags: ["滴定", "逐滴", "旋摇"],
    demoId: "demo-design-piece-near-endpoint",
  },
  {
    id: "piece-step-half-drop", kind: "step",
    title: "半滴操作", sub: "半滴挂在管尖、靠瓶内壁，用洗瓶吹入并摇匀", tags: ["半滴", "靠壁", "洗入"],
    demoId: "demo-design-piece-half-drop",
  },
  {
    id: "piece-step-boil", kind: "step",
    title: "煮沸驱 CO₂", sub: "微沸 2 min、瓶口朝无人侧，冷却至室温后补滴", tags: ["CO₂", "煮沸", "冷却"],
    demoId: "demo-design-piece-boil",
  },
  {
    id: "piece-step-parallel", kind: "step",
    title: "平行测定", sub: "≥3 份平行，相对平均偏差 ≤0.3%、极差 ≤0.2%", tags: ["平行", "精密度"],
    demoId: "demo-design-piece-parallel",
  },
  {
    id: "piece-step-blank", kind: "step",
    title: "空白试验", sub: "不加试样同法滴定，扣掉指示剂与试剂耗酸", tags: ["空白", "校正", "系统误差"],
    demoId: "demo-design-piece-blank",
  },

  // ── 参数 5 ──────────────────────────────────────────────────────────
  {
    id: "piece-param-conc", kind: "param",
    title: "c(HCl) ≈ 0.1 mol/L", sub: "由称样量与 20~35 mL 消耗体积反推，不直接配准", tags: ["浓度", "近似浓度"],
    demoId: "demo-design-piece-param-concentration",
  },
  {
    id: "piece-param-sample", kind: "param",
    title: "称样量 0.14~0.16 g ×3", sub: "准至 0.0001 g，保证 V(HCl) 落在滴定管 1/2~2/3", tags: ["称样量", "有效数字"],
    demoId: "demo-design-piece-param-sample-mass",
  },
  {
    id: "piece-param-endpoint", kind: "param",
    title: "终点判据", sub: "甲基橙黄→橙；酚酞微红刚好消失；均需 30 s 不褪", tags: ["终点", "颜色", "判据"],
    demoId: "demo-design-piece-param-endpoint",
  },
  {
    id: "piece-param-parallel", kind: "param",
    title: "平行次数 2~3 份", sub: "不少于 2 份，推荐 3 份；极差 ≤0.2% 才可取平均", tags: ["平行", "极差"],
    demoId: "demo-design-piece-param-parallel",
  },
  {
    id: "piece-param-drying", kind: "param",
    title: "基准物干燥制度", sub: "270~300 ℃ 干燥 1 h，置干燥器冷至室温再称", tags: ["干燥", "恒重", "270~300 ℃"],
    demoId: "demo-design-piece-param-drying",
  },
];

export const PIECES_BY_ID: Readonly<Record<string, PlanPiece>> = Object.freeze(
  Object.fromEntries(PIECES.map((p) => [p.id, p])),
);

export function getPiece(id: string): PlanPiece | undefined {
  return PIECES_BY_ID[id];
}

export function piecesByKind(kind: PieceKind): PlanPiece[] {
  return PIECES.filter((p) => p.kind === kind);
}

export function hasPiece(plan: PlanInput, id: string): boolean {
  return plan.pieces.includes(id);
}

/** 一份「满 100 分」的参考方案：演示、单测基线、反例都从它出发 */
export const REFERENCE_PLAN: PlanInput = {
  pieces: [
    "piece-analytical-balance", "piece-burette-acid", "piece-pipette-25",
    "piece-volumetric-250", "piece-flask-250", "piece-cylinder-10",
    "piece-weighing-bottle", "piece-desiccator",
    "piece-na2co3-primary", "piece-hcl-conc", "piece-boiled-water",
    "piece-phenolphthalein", "piece-methyl-orange",
    "piece-step-rinse", "piece-step-weigh", "piece-step-dissolve", "piece-step-dilute",
    "piece-step-degas", "piece-step-near-endpoint", "piece-step-half-drop",
    "piece-step-boil", "piece-step-parallel", "piece-step-blank",
    "piece-param-conc", "piece-param-sample", "piece-param-endpoint",
    "piece-param-parallel", "piece-param-drying",
  ],
  params: {
    acidOrder: "acid-into-water",
    hood: true,
    pipetteAid: "rubber-bulb",
    indicatorOrder: "phenolphthalein-first",
    indicatorDrops: 2,
    readingResolution: 0.01,
    endpointHoldSec: 30,
    endpoint: "methyl-orange-yellow-to-orange",
    parallelCount: 3,
    parallelRangePct: 0.1,
    sameBatch: true,
    halfDrop: "touch-wall-rinse",
    dryTemp: 280,
    dryHours: 1,
  },
};
