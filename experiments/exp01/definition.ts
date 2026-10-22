/**
 * experiments/exp01/definition.ts —— 实验 01《仪器的认领、天平使用及溶液配制》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp01.md。本文件只导出数据，不含 IO / React / 随机数。
 * 步骤、选项、判据与陷阱文案逐条来自规格 §6 / §7；线索（hints）来自规格 §6 最后一列。
 */

import type {
  ActionParams,
  ActionType,
  ChoiceDefinition,
  ChoiceHazard,
  CompetencyCode,
  EntityState,
  ExperimentDefinition,
  ExperimentState,
  FeedbackCopy,
  FeedbackSeverity,
  IncidentLevel,
  StepDefinition,
} from "../../lib/engine.types";

/* ------------------------------------------------------------------ *
 * 初始器材 / 试剂状态
 * ------------------------------------------------------------------ */

const INITIAL_ENTITIES: Record<string, EntityState> = {
  "balance-1": { id: "balance-1", kind: "balance", reading: 0, note: "分析天平，感量 0.1 mg" },
  "weigh-bottle": { id: "weigh-bottle", kind: "beaker", note: "扁形称量瓶 30 × 25 mm" },
  "beaker-100": { id: "beaker-100", kind: "beaker", note: "100 mL 烧杯（溶解 Na₂CO₃）" },
  "beaker-250": { id: "beaker-250", kind: "beaker", note: "250 mL 烧杯（稀释浓硫酸）" },
  "volumetric-100": { id: "volumetric-100", kind: "volumetric", note: "100 mL A 级容量瓶" },
  "cylinder-100": { id: "cylinder-100", kind: "cylinder", note: "100 mL 量筒，1 mL 分度" },
  "cylinder-10": { id: "cylinder-10", kind: "cylinder", note: "10 mL 量筒，0.1 mL 分度" },
  "pipette-25": { id: "pipette-25", kind: "pipette", note: "25.00 mL 单标线移液管，A 级" },
  "flask-1": { id: "flask-1", kind: "flask", note: "锥形瓶（接收移取液）" },
  "acid-bottle": { id: "acid-bottle", kind: "stand", note: "浓硫酸原瓶（通风橱耐酸柜）" },
  "reagent-bottle": { id: "reagent-bottle", kind: "volumetric", note: "100 mL 细口试剂瓶" },
  "wash-bottle": { id: "wash-bottle", kind: "wash", note: "蒸馏水洗瓶" },
};

function cloneEntity(entity: EntityState): EntityState {
  const clone: EntityState = { ...entity };
  if (entity.liquid) clone.liquid = { ...entity.liquid };
  if (entity.precipitate) clone.precipitate = { ...entity.precipitate };
  if (entity.gas) clone.gas = { ...entity.gas };
  return clone;
}

function cloneEntities(): Record<string, EntityState> {
  const out: Record<string, EntityState> = {};
  for (const [id, entity] of Object.entries(INITIAL_ENTITIES)) out[id] = cloneEntity(entity);
  return out;
}

/* ------------------------------------------------------------------ *
 * 构造小工具
 * ------------------------------------------------------------------ */

type CorrectExtra = Partial<
  Omit<ChoiceDefinition, "choiceId" | "type" | "label" | "demoId" | "competency" | "role">
>;

function correct(
  choiceId: string,
  type: ActionType,
  label: string,
  demoId: string,
  competency: CompetencyCode,
  extra: CorrectExtra = {},
): ChoiceDefinition {
  return { choiceId, type, label, demoId, competency, role: "correct", completesStep: false, ...extra };
}

function trap(
  choiceId: string,
  type: ActionType,
  label: string,
  demoId: string,
  competency: CompetencyCode,
  consequence: ChoiceHazard,
): ChoiceDefinition {
  return { choiceId, type, label, demoId, competency, role: "trap", completesStep: false, hazard: consequence };
}

function fb(
  severity: FeedbackSeverity,
  title: string,
  why?: string,
  correctText?: string,
  refs?: string[],
): FeedbackCopy {
  const copy: FeedbackCopy = { severity, title };
  if (why !== undefined) copy.why = why;
  if (correctText !== undefined) copy.correct = correctText;
  if (refs !== undefined) copy.refs = refs;
  return copy;
}

function hazard(
  ruleId: string,
  level: IncidentLevel,
  deduct: number,
  competency: CompetencyCode,
  feedback: FeedbackCopy,
  extra: { terminate?: boolean } = {},
): ChoiceHazard {
  return {
    ruleId,
    level,
    deduct,
    competency,
    terminate: extra.terminate ?? false,
    feedback,
  };
}

const P = (params: ActionParams): { params: ActionParams } => ({ params });
const H4 = "连续犯同类错误 3 次：先停下复述这一步的规范顺序（谁先谁后、用什么器皿），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6）
 * ------------------------------------------------------------------ */

export const EXP01_STEP_DEMO_IDS: readonly string[] = [
  "exp01-step1-wash",
  "exp01-step2-balance",
  "exp01-step3-weigh",
  "exp01-step4-transfer",
  "exp01-step5-dilute",
  "exp01-step6-pipette",
  "exp01-step7-acid",
];

const step1: StepDefinition = {
  index: 0,
  title: "仪器认领、洗涤与干燥",
  scene: "实验台 + 水槽",
  demoId: "exp01-step1-wash",
  judge: {
    criterion: "内壁形成均匀水膜、无水珠挂壁；认领单签字完整",
    competency: ["S2"],
  },
  hints: {
    h0: "先看内壁是否挂水珠：这是度量器皿能不能用的第一眼判据。",
    h1: "看内壁是否挂水珠？",
    h2: "高亮「自然晾干」图标：容量瓶、量筒洗净后倒置晾干，不用纸巾擦内壁。",
    h3: "演示自来水冲→洗洁精刷洗→自来水淋洗 3 次→蒸馏水淋洗 3 次→倒置晾干。",
    h4: H4,
  },
  accepts: [
    "step1-check",
    "step1-rinse",
    "step1-dry",
    "step1-wipe",
    "step1-oven",
  ],
  choices: [
    correct(
      "step1-check",
      "observe",
      "按清单核对品名/规格/数量并签字",
      "demo-op-step1-check",
      "S2",
      {
        observation: { text: "认领单已核对签字：15 件器皿名称/规格/数量一致", value: 15 },
      },
    ),
    correct(
      "step1-rinse",
      "wash",
      "自来水冲→洗洁精刷洗→自来水淋洗 3 次→蒸馏水淋洗 3 次→倒置晾干",
      "demo-op-step1-wash",
      "S2",
      {
        observation: { text: "内壁形成均匀水膜、无水珠挂壁" },
      },
    ),
    correct(
      "step1-dry",
      "wash",
      "容量瓶、量筒自然晾干或冷风吹干",
      "demo-op-step1-dry",
      "S2",
      {
        completesStep: true,
        requires: ["step1-rinse"],
        observation: { text: "容量瓶、量筒自然晾干，内壁无水珠" },
        feedback: fb("info", "洗涤完成：内壁水膜均匀，自然晾干", undefined, undefined, ["S002"]),
      },
    ),
    trap(
      "step1-wipe",
      "wash",
      "用纸巾/抹布擦拭容量瓶内壁",
      "demo-op-step1-wipe",
      "S2",
      hazard(
        "exp01-H8",
        "L1",
        2,
        "S2",
        fb(
          "warn",
          "纤维残留、挂水珠 → 后续体积不准",
          "纤维残留改变内壁润湿性，挂水珠占体积，定容/移取体积会偏差。",
          "蒸馏水淋洗后自然晾干；度量器皿不得擦拭内壁。",
          ["S002"],
        ),
      ),
    ),
    trap(
      "step1-oven",
      "wash",
      "把容量瓶、量筒放进 105 ℃ 烘箱烘干",
      "demo-op-step1-oven",
      "S2",
      hazard(
        "exp01-H8b",
        "L2",
        5,
        "S2",
        fb(
          "danger",
          "刻度标定失效、瓶体变形，器皿报废",
          "容量瓶、量筒经高温烘烤后玻璃应力改变，刻度标定失效，本次数据作废。",
          "容量瓶、量筒自然晾干或冷风吹干，不得烘烤。",
          ["S002"],
        ),
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "分析天平调水平与内校",
  scene: "天平室",
  demoId: "exp01-step2-balance",
  judge: {
    criterion: "空载示数 0.0000 g；10 s 内漂移 ≤0.0002 g",
    competency: ["K1", "S1"],
  },
  hints: {
    h0: "先找水平泡：水平泡不居中，后面所有称量都带系统偏差。",
    h1: "水平泡在哪？",
    h2: "高亮地脚螺栓：调平→开机预热≥30 min→内校→回零。",
    h3: "演示调水平 + 内校 + 空载回零，读数稳定后再称样。",
    h4: H4,
  },
  accepts: [
    "step2-level",
    "step2-calibrate",
    "step2-brush",
    "step2-no-level",
    "step2-no-cal",
  ],
  choices: [
    correct(
      "step2-level",
      "calibrate",
      "看水平泡是否居中，不居中调地脚螺栓",
      "demo-op-step2-level",
      "K1",
      { observation: { text: "水平泡居中，天平已调平" } },
    ),
    correct(
      "step2-brush",
      "observe",
      "用软毛刷/绸布取放称量瓶，不用手直接抓",
      "demo-op-step2-brush",
      "S1",
      { observation: { text: "称量瓶用软毛刷/绸布取放，未直接用手抓" } },
    ),
    correct(
      "step2-calibrate",
      "calibrate",
      "开机预热 ≥30 min，按内校键校准后回零",
      "demo-op-step2-calibrate",
      "S1",
      {
        completesStep: true,
        requires: ["step2-level"],
        observation: { text: "空载示数 0.0000 g；10 s 内漂移 ≤0.0002 g", value: 0 },
        entityPatch: { "balance-1": { reading: 0, note: "空载 0.0000 g，已内校" } },
        feedback: fb("info", "天平已调平并内校，空载回零", undefined, undefined, ["S003"]),
      },
    ),
    trap(
      "step2-no-level",
      "calibrate",
      "不调水平直接称量",
      "demo-op-step2-no-level",
      "K1",
      hazard(
        "exp01-H7a",
        "L1",
        3,
        "S1",
        fb(
          "warn",
          "单盘受力，示数系统性偏低约 0.5~2 mg",
          "天平未调平时单盘受力，称量结果带系统偏差，全部称量值同向偏移。",
          "先看水平泡并调地脚螺栓，再开机预热、内校、回零。",
          ["S003"],
        ),
      ),
    ),
    trap(
      "step2-no-cal",
      "calibrate",
      "跳过校准，用上次残留的校准值直接称",
      "demo-op-step2-no-cal",
      "K1",
      hazard(
        "exp01-H7b",
        "L1",
        3,
        "S1",
        fb(
          "warn",
          "校准失效，全部称量数据带系统偏差",
          "跳过内校会沿用失效校准值，全部称量数据带系统偏差。",
          "开机预热≥30 min 后按内校键校准，再回零。",
          ["S003"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "差减法称 Na₂CO₃",
  scene: "天平室",
  demoId: "exp01-step3-weigh",
  judge: {
    criterion: "差减质量 1.0599 g，允差 ±0.0005 g；瓶外壁无残留、试样无洒落",
    competency: ["S1", "K2"],
    tolerance: { paramKey: "mass", expected: 1.0599, unit: "g", tolerance: 0.0005 },
  },
  hints: {
    h0: "示数稳定了吗？差减法要两次读数都稳定后再记。",
    h1: "示数稳了吗？",
    h2: "高亮稳定指示符：等示数稳定后读 m₁、m₂，再算差值。",
    h3: "演示称量瓶连盖粗称→转移试样→盖盖复称→按 m₁−m₂ 记录。",
    h4: H4,
  },
  accepts: [
    "step3-gross",
    "step3-transfer",
    "step3-compute",
    "step3-jumping",
    "step3-hot",
  ],
  choices: [
    correct(
      "step3-gross",
      "weigh",
      "称量瓶连盖粗称，记录 m₁ 后盖盖待用",
      "demo-op-step3-gross",
      "K2",
      {
        observation: { text: "m₁ = 13.4055 g（称量瓶 + 试样，称量前）", value: 13.4055 },
        entityPatch: { "balance-1": { reading: 13.4055 } },
      },
    ),
    correct(
      "step3-transfer",
      "weigh",
      "在烧杯上方轻敲瓶口转移试样，盖盖复称 m₂",
      "demo-op-step3-transfer",
      "S1",
      {
        observation: { text: "m₂ = 12.3456 g（称量瓶 + 试样，称量后）", value: 12.3456 },
      },
    ),
    correct(
      "step3-compute",
      "compute",
      "按 m₁ − m₂ 记差减质量",
      "demo-op-step3-compute",
      "K2",
      {
        completesStep: true,
        requires: ["step3-gross", "step3-transfer"],
        ...P({ mass: 1.0599 }),
        observation: { text: "m = 13.4055 − 12.3456 = 1.0599 g；c(Na₂CO₃)=0.1000 mol/L", value: 1.0599 },
        entityPatch: { "beaker-100": { note: "已称入 1.0599 g Na₂CO₃" } },
        feedback: fb("info", "差减质量 1.0599 g，记录到 0.0001 g", undefined, undefined, ["S003"]),
      },
    ),
    trap(
      "step3-jumping",
      "weigh",
      "示数还在跳就记录",
      "demo-op-step3-jumping",
      "S1",
      hazard(
        "exp01-H7c",
        "L1",
        3,
        "S1",
        fb(
          "warn",
          "读数漂移，单次偏差 0.3~1 mg",
          "示数未稳定就记录，单次读数偏差 0.3~1 mg，差减质量不可信。",
          "等稳定指示符出现后再读数、记录。",
          ["S003"],
        ),
      ),
    ),
    trap(
      "step3-hot",
      "weigh",
      "把刚烘过的热称量瓶直接放上秤盘",
      "demo-op-step3-hot",
      "S1",
      hazard(
        "exp01-H4",
        "L3",
        8,
        "S1",
        fb(
          "danger",
          "热对流致示数持续单向漂移，可能损坏传感器",
          "热物体产生上升气流，浮力变化致示数单向漂移；超载/热应力会损伤传感器。",
          "称量物在干燥器中冷却至室温再称。",
          ["S003"],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "溶解、冷却与定量转移",
  scene: "通风橱旁操作台",
  demoId: "exp01-step4-transfer",
  judge: {
    criterion: "烧杯内无残留固体；转移后容量瓶内液面低于刻度线",
    competency: ["S2"],
  },
  hints: {
    h0: "溶液凉了吗？热溶液直接进容量瓶，受热不均会炸裂。",
    h1: "溶液凉了吗？",
    h2: "高亮温度计/冷却提示：冷却至室温再转移。",
    h3: "演示冷却→玻璃棒引流→洗 3 次并入容量瓶。",
    h4: H4,
  },
  accepts: [
    "step4-dissolve",
    "step4-cool",
    "step4-rinse",
    "step4-hot",
    "step4-no-rinse",
  ],
  choices: [
    correct(
      "step4-dissolve",
      "dissolve",
      "加约 30 mL 蒸馏水，玻璃棒搅拌至完全溶解",
      "demo-op-step4-dissolve",
      "S2",
      {
        ...P({ reagent: "water" }),
        observation: { text: "固体完全溶解，烧杯内无残留固体" },
        entityPatch: { "beaker-100": { note: "Na₂CO₃ 已完全溶解" } },
      },
    ),
    correct(
      "step4-cool",
      "observe",
      "冷却至室温，玻璃棒引流一次转入容量瓶",
      "demo-op-step4-cool",
      "S2",
      {
        observation: { text: "溶液已冷却至室温，玻璃棒引流转入 100 mL 容量瓶" },
      },
    ),
    correct(
      "step4-rinse",
      "transfer",
      "用少量蒸馏水洗涤烧杯内壁与玻璃棒 3 次，洗液并入容量瓶",
      "demo-op-step4-rinse",
      "S2",
      {
        completesStep: true,
        requires: ["step4-dissolve", "step4-cool"],
        observation: { text: "烧杯内壁与玻璃棒洗 3 次，洗液全部并入容量瓶" },
        entityPatch: {
          "volumetric-100": { note: "已转入 Na₂CO₃ 溶液，待定容" },
          "beaker-100": { note: "已洗涤 3 次，洗液并入容量瓶" },
        },
        feedback: fb("info", "定量转移完成：洗 3 次并入容量瓶", undefined, undefined, ["S004"]),
      },
    ),
    trap(
      "step4-hot",
      "transfer",
      "溶解后趁热直接转入容量瓶",
      "demo-op-step4-hot",
      "S2",
      hazard(
        "exp01-H3",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "容量瓶受热不均，瓶底炸裂、溶液损失",
          "玻璃局部受热不均产生热应力，容量瓶可能炸裂，溶液与数据同时损失。",
          "冷却至室温再转移。",
          ["S004"],
        ),
      ),
    ),
    trap(
      "step4-no-rinse",
      "transfer",
      "不洗涤烧杯内壁，直接定容",
      "demo-op-step4-no-rinse",
      "S2",
      hazard(
        "exp01-H6a",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "溶质损失约 0.3~0.8%，c 系统性偏低",
          "烧杯内壁残留溶质未洗入容量瓶，配制浓度系统性偏低。",
          "用少量蒸馏水洗涤烧杯内壁与玻璃棒 3 次，洗液并入容量瓶。",
          ["S004"],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "容量瓶定容与摇匀",
  scene: "通风橱旁操作台",
  demoId: "exp01-step5-dilute",
  judge: {
    criterion: "凹液面最低点与刻度线相切，允差 ±0.10 mL；摇匀后无气泡、无挂壁",
    competency: ["K1", "S2"],
    tolerance: { paramKey: "volume", expected: 100, unit: "mL", tolerance: 0.1 },
  },
  hints: {
    h0: "视线平了吗？俯视会让实际液面低于刻度。",
    h1: "视线平了吗？",
    h2: "高亮三条水平辅助线：眼睛、刻度线、凹液面最低点同线。",
    h3: "演示“接近刻度改滴管→三位一线→盖塞倒转摇匀”。",
    h4: H4,
  },
  accepts: [
    "step5-water",
    "step5-read",
    "step5-shake",
    "step5-top-view",
    "step5-no-shake",
  ],
  choices: [
    correct(
      "step5-water",
      "dilute",
      "加水至刻度线下方 1~2 cm，改胶头滴管逐滴加入",
      "demo-op-step5-water",
      "S2",
      { ...P({ volume: 100 }), observation: { text: "液面接近刻度线，改用胶头滴管逐滴加入" } },
    ),
    correct(
      "step5-read",
      "readInstrument",
      "三位一线：视线与刻度线水平，凹液面最低点与刻度线相切",
      "demo-op-step5-read",
      "K1",
      { ...P({ volume: 100 }), observation: { text: "凹液面最低点与 100.0 mL 刻度线相切，允差 ±0.10 mL" } },
    ),
    correct(
      "step5-shake",
      "dilute",
      "盖塞，倒转摇匀 ≥10 次，静置",
      "demo-op-step5-shake",
      "S2",
      {
        completesStep: true,
        requires: ["step5-water", "step5-read"],
        ...P({ volume: 100 }),
        observation: { text: "溶液摇匀，无气泡、无挂壁；V = 100.0 mL" },
        entityPatch: {
          "volumetric-100": { liquid: { substance: "Na₂CO₃(aq)", level: 100, color: "#dce9f2", opacity: 0.25 } },
        },
        feedback: fb("info", "定容完成：100.0 mL，摇匀静置", undefined, undefined, ["S004"]),
      },
    ),
    trap(
      "step5-top-view",
      "readInstrument",
      "俯视刻度线，液面看着到线就停",
      "demo-op-step5-top-view",
      "K1",
      hazard(
        "exp01-H5",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "实际液面低于刻度，V 偏小 0.1~0.3 mL，c 偏高",
          "俯视时视线斜向下，“看起来到线”实际未到，V 偏小，c 偏高。",
          "视线与刻度线水平，使凹液面最低点与刻度线相切。",
          ["S004"],
        ),
      ),
    ),
    trap(
      "step5-no-shake",
      "dilute",
      "定容后不摇匀，直接拿去移取",
      "demo-op-step5-no-shake",
      "S2",
      hazard(
        "exp01-H6b",
        "L1",
        3,
        "S2",
        fb(
          "warn",
          "上下浓度不均，移取值偏离",
          "定容后不摇匀，上下浓度不均，移取液浓度偏离。",
          "盖塞倒转摇匀 ≥10 次，静置后再移取。",
          ["S004"],
        ),
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "移液管润洗、移取与放出",
  scene: "通风橱旁操作台",
  demoId: "exp01-step6-pipette",
  judge: {
    criterion: "放出体积 25.00 ±0.03 mL；管尖外壁无液滴",
    competency: ["S2", "K2"],
    tolerance: { paramKey: "volume", expected: 25, unit: "mL", tolerance: 0.03 },
  },
  hints: {
    h0: "润洗了吗？移液管要用待移取液润洗 3 次。",
    h1: "润洗了吗？",
    h2: "高亮润洗 3 次动画：每次约 5 mL，弃去。",
    h3: "演示吸液至刻度上方→调至 25.00 mL→自然流下停 15 s。",
    h4: H4,
  },
  accepts: [
    "step6-rinse",
    "step6-suck",
    "step6-drain",
    "step6-mouth",
    "step6-blow",
  ],
  choices: [
    correct(
      "step6-rinse",
      "wash",
      "蒸馏水洗净后，用待移取液润洗 3 次（每次约 5 mL）",
      "demo-op-step6-rinse",
      "S2",
      { observation: { text: "移液管用待移取液润洗 3 次" } },
    ),
    correct(
      "step6-suck",
      "readInstrument",
      "洗耳球吸液至刻度线上方，调至凹液面与 25.00 mL 刻度相切",
      "demo-op-step6-suck",
      "S2",
      { ...P({ volume: 25 }), observation: { text: "凹液面与 25.00 mL 刻度相切" } },
    ),
    correct(
      "step6-drain",
      "transfer",
      "管尖靠锥形瓶内壁，自然流下，停留 15 s 后取出",
      "demo-op-step6-drain",
      "S2",
      {
        completesStep: true,
        requires: ["step6-rinse", "step6-suck"],
        ...P({ volume: 25 }),
        observation: { text: "放出体积 25.00 mL；管尖外壁无液滴，停留 15 s" },
        feedback: fb("info", "移取完成：25.00 mL，自然流下停 15 s", undefined, undefined, ["S004"]),
      },
    ),
    trap(
      "step6-mouth",
      "transfer",
      "用嘴吸液",
      "demo-op-step6-mouth",
      "S2",
      hazard(
        "exp01-H8c",
        "L1",
        3,
        "S2",
        fb(
          "danger",
          "违规操作，违反 S004，扣操作分",
          "用嘴吸液可能吸入腐蚀性溶液，属于明确禁止的操作。",
          "用洗耳球吸液；管尖靠内壁自然流下。",
          ["S004"],
        ),
      ),
    ),
    trap(
      "step6-blow",
      "transfer",
      "把管尖残留液吹入锥形瓶",
      "demo-op-step6-blow",
      "S2",
      hazard(
        "exp01-H6c",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "多放约 0.05 mL，体积偏大 0.2%，n 偏大",
          "吹出残液会多放约 0.05 mL，体积偏大 0.2%，n 偏大。",
          "自然流下，停留 15 s 后取出；不吹残液。",
          ["S004"],
        ),
      ),
    ),
  ],
};

const step7: StepDefinition = {
  index: 6,
  title: "浓硫酸稀释",
  scene: "通风橱内",
  demoId: "exp01-step7-acid",
  judge: {
    criterion: "加酸过程中液温 ≤60 ℃、无暴沸、无溅出；标签含名称/浓度/日期/姓名",
    competency: ["A1", "K2"],
    tolerance: { paramKey: "concentration", expected: 0.5, unit: "mol/L", tolerance: 0.005 },
  },
  hints: {
    h0: "谁在谁里面？稀释浓硫酸必须“酸入水”，绝不能水入酸。",
    h1: "谁在谁里面？",
    h2: "高亮“酸入水”箭头：沿壁、缓慢、边加边搅拌。",
    h3: "演示护目镜+手套→通风橱→酸入水→冷却→贴标签。",
    h4: H4,
  },
  accepts: [
    "step7-water",
    "step7-acid",
    "step7-label",
    "step7-water-into-acid",
    "step7-no-goggles",
  ],
  choices: [
    correct(
      "step7-water",
      "observe",
      "戴护目镜+丁腈手套，在通风橱内用 100 mL 量筒量约 95 mL 蒸馏水入烧杯",
      "demo-op-step7-water",
      "A1",
      { observation: { text: "护目镜、丁腈手套、通风橱就位；约 95 mL 蒸馏水入烧杯" } },
    ),
    correct(
      "step7-acid",
      "dilute",
      "用 10 mL 量筒量 2.7 mL 浓硫酸，沿烧杯内壁缓缓注入水中，边加边搅拌",
      "demo-op-step7-acid",
      "K2",
      {
        ...P({ volume: 2.7, temperature: 48.5 }),
        observation: { text: "浓硫酸沿壁缓缓加入水中，边加边搅拌；最高液温 48.5 ℃ ≤60 ℃" },
      },
    ),
    correct(
      "step7-label",
      "transfer",
      "冷却至室温后转入试剂瓶、贴标签",
      "demo-op-step7-label",
      "A1",
      {
        completesStep: true,
        requires: ["step7-water", "step7-acid"],
        ...P({ concentration: 0.5, temperature: 48.5 }),
        observation: { text: "c(H₂SO₄)=0.50 mol/L；标签含名称/浓度/日期/姓名" },
        entityPatch: {
          "reagent-bottle": { liquid: { substance: "H₂SO₄(aq)", level: 100, color: "#dce9f2", opacity: 0.2 } },
        },
        feedback: fb("info", "稀释完成：酸入水、沿壁、搅拌、冷却后贴标签", undefined, undefined, ["S006"]),
      },
    ),
    trap(
      "step7-water-into-acid",
      "dilute",
      "把水沿壁倒入盛浓硫酸的烧杯",
      "demo-op-step7-water-into-acid",
      "A1",
      hazard(
        "exp01-H1",
        "L4",
        20,
        "A1",
        fb(
          "danger",
          "水层局部沸腾爆溅，酸液飞溅",
          "水密度 1.0 < 酸 1.84，浮于酸面；稀释热集中在水层，局部瞬间超过 100 ℃，先沸腾后爆溅。",
          "酸入水、沿壁、缓慢、边加边搅拌，必要时冰水浴；溅到立即大量流水冲洗 ≥15 min 并报告。",
          ["S006"],
        ),
        { terminate: true },
      ),
    ),
    trap(
      "step7-no-goggles",
      "observe",
      "不戴护目镜、在开放台面直接稀释",
      "demo-op-step7-no-goggles",
      "A1",
      hazard(
        "exp01-H2",
        "L3",
        10,
        "A1",
        fb(
          "danger",
          "酸液溅到手背，皮肤灼伤",
          "浓硫酸使蛋白质脱水碳化，伤害持续加深；开放台面溅液风险高。",
          "护目镜+手套+通风橱；溅到立即大量流水冲洗 ≥15 min 并报告。",
          ["S001", "S006"],
        ),
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp01Definition: ExperimentDefinition = {
  id: "exp01",
  title: "仪器的认领、天平使用及溶液配制",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5, step6, step7],
  createState: (): ExperimentState => ({
    expId: "exp01",
    stepIndex: 0,
    attemptOfStep: 0,
    entities: cloneEntities(),
    observations: [],
    violations: [],
    incidents: [],
    done: false,
    stepLog: [],
  }),
};

export default exp01Definition;
