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
  FxKey,
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


/* ------------------------------------------------------------------ *
 * 事故特效（本题最重要的可见反馈）
 * ------------------------------------------------------------------ */

/**
 * 哪条陷阱该在器皿上炸出什么。
 *
 * 背景：`ChoiceHazard.fx` 字段一直存在，但 exp01 一条都没填 ——
 * 学生做错时屏幕上什么都不发生，只剩「−N 分」，等于错误没有后果。
 * 这里集中补齐，避免 14 段 trap(...) 里到处塞参数。
 *
 * 只给**真有物理事故**的配上，轻微违规（擦拭、不校准、不摇匀）留空：
 * 硬凑特效会让「碎裂」变成装饰，学生反而记不住哪种错会真的出事。
 */
const FX_BY_TRAP: Readonly<Record<string, FxKey>> = {
  // 105 ℃ 烘烤 → 玻璃应力改变，刻度标定失效、瓶身开裂
  "step1-oven": "glass-break",
  // 热称量瓶直接压上秤盘 → 天平传感单元受损
  "step3-hot": "device-accident",
  // 趁热转入容量瓶 → 热应力使瓶体炸裂
  "step1-poke": "glass-break",
  "step4-hot": "glass-break",
  // 用嘴吸浓酸 → 口腔咽喉灼伤
  "step6-mouth": "burn",
  // 水入浓硫酸 → 局部瞬间超 100 ℃，沸腾爆溅（本实验最高等级事故）
  "step7-water-into-acid": "explosion",
  // 不戴护目镜 → 溅液入眼，角膜灼伤
  "step7-no-goggles": "burn",
};

/**
 * 事故演出：这条错操作**怎么做的**（决定事故动画的起手式）。
 * 用户 2026-10-23：「事故在动画中途炸」—— 所以每条有特效的陷阱都要说清楚是
 * 倒液倒到一半 / 加热到一半 / 搅拌到一半 / 用玻璃棒捅洗时出的事。
 * 没列的（如用嘴吸液、不戴护目镜）不在器皿上发生，仍走覆盖层特效。
 */
const OP_BY_TRAP: Readonly<Record<string, "pour" | "heat" | "stir" | "poke">> = {
  "step1-oven": "heat",
  "step1-poke": "poke",
  "step4-hot": "pour",
  "step7-water-into-acid": "pour",
};

function withFx(step: StepDefinition): StepDefinition {
  return {
    ...step,
    choices: step.choices.map((choice) => {
      const fx = FX_BY_TRAP[choice.choiceId];
      if (!fx || !choice.hazard) return choice;
      const op = OP_BY_TRAP[choice.choiceId];
      return { ...choice, hazard: { ...choice.hazard, fx, ...(op ? { op } : {}) } };
    }),
  };
}

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
    h0: "内壁还挂水珠吗？",
    h1: "标准：自来水与蒸馏水各淋洗 3 次，内壁水膜连续、不挂水珠",
    h2: "点「自然晾干」：倒置在架上，不用纸巾擦内壁",
    h3: "演示自来水冲→洗洁精刷洗→自来水淋洗 3 次→蒸馏水淋洗 3 次→倒置晾干。",
    h4: H4,
  },
  accepts: [
    "step1-dry",
    "step1-wipe",
    "step1-wash-wrong",
    "step1-poke",
    "step1-oven",
  ],
  choices: [
    correct(
      "step1-dry",
      "wash",
      "拖进洗涤槽：冲洗→刷洗→淋洗→倒置晾干",
      "demo-op-step1-dry",
      "S2",
      {
        completesStep: true,
        observation: { text: "内壁形成均匀水膜、无水珠，已倒置晾干" },
        feedback: fb(
          "info",
          "洗涤完成，水膜均匀",
          "水膜连续说明内壁无油无纤维，定容体积才可信",
          "器皿已倒置晾干；第 2 步先调平天平再称样",
          ["S002"],
        ),
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
          "内壁擦出纤维 → 体积不准",
          "纤维改变内壁润湿性，挂住的水珠占体积，刻度读数不实。",
          "换蒸馏水重冲 3 次，倒置晾干；本步不废，接着晾干。",
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
          "高温烘烤 → 刻度失效报废",
          "105 ℃ 烘烤改变玻璃应力，容量瓶与量筒的刻度标定随之失效。",
          "换新器皿，本步从洗涤重做；烘过的不能再用。",
          ["S002"],
        ),
      ),
    ),
    // 拖错器皿进洗涤槽：这一步洗的是容量瓶，烧杯/试管在各自步骤里洗
    trap(
      "step1-wash-wrong",
      "wash",
      "把烧杯／试管拖进洗涤槽",
      "demo-op-step1-wash-wrong",
      "S2",
      hazard(
        "exp01-H8c",
        "L1",
        2,
        "S2",
        fb(
          "warn",
          "洗错器皿 → 这一步白做",
          "这一步认领洗涤的对象是 100 mL 容量瓶；烧杯和试管在后面的步骤里才洗，先洗它们等于把规范顺序打乱。",
          "把容量瓶拖进洗涤槽，重洗一次。",
          ["S002"],
        ),
      ),
    ),
    // 演示用：拿玻璃棒往容量瓶里戳着洗 —— 度量器皿一碰就裂（L3，有碎裂特效）
    trap(
      "step1-poke",
      "wash",
      "拿玻璃棒在容量瓶里搅洗",
      "demo-op-step1-poke",
      "S2",
      hazard(
        "exp01-H3",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "瓶壁裂纹 → 容量瓶报废",
          "容量瓶是薄壁量出式器皿，玻璃棒一戳就产生裂纹，受热或摇匀时会直接裂开。",
          "换新容量瓶，从洗涤重做；这台的刻度已经不可信。",
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
    h0: "水平泡居中了吗？",
    h1: "标准：气泡落圈内，空载 0.0000 g，10 s 漂移 ≤0.0002 g",
    h2: "拧地脚螺栓调平，开机预热 30 min 后按内校键",
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
    // 调平 / 取放 / 内校 并成一次「点天平」（用户 2026-10-22：步骤太碎，学生点四次才过一步）
    correct(
      "step2-calibrate",
      "calibrate",
      "点天平：调平→软毛刷取放称量瓶→预热内校",
      "demo-op-step2-calibrate",
      "S1",
      {
        completesStep: true,
        observation: { text: "空载示数 0.0000 g；10 s 内漂移 ≤0.0002 g", value: 0 },
        entityPatch: { "balance-1": { reading: 0, note: "空载 0.0000 g，已内校" } },
        feedback: fb(
          "info",
          "空载 0.0000 g，已内校",
          "示数稳在本底上，称量值才只反映试样质量",
          "天平已可用；第 3 步连盖粗称称量瓶",
          ["S003"],
        ),
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
          "未调水平 → 称量值偏低",
          "天平未调平时单盘受力，全部称量值同向偏低 0.5~2 mg。",
          "调地脚螺栓至水平泡居中，回零重称；本步不废。",
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
          "跳过内校 → 全部称量偏移",
          "沿用失效的校准值，之后每个读数都带同一系统偏差。",
          "预热 ≥30 min 后按内校键，再回零；本步不废。",
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
    h0: "示数稳定了吗？",
    h1: "标准：稳定符出现后读数，m₁−m₂ = 1.0599 g，允差 ±0.0005 g",
    h2: "连盖粗称记 m₁，转移试样后盖盖复称 m₂",
    h3: "演示称量瓶连盖粗称→转移试样→盖盖复称→按 m₁−m₂ 记录。",
    h4: H4,
  },
  accepts: [
    "step3-compute",
    "step3-jumping",
    "step3-hot",
  ],
  choices: [
    correct(
      "step3-compute",
      "compute",
      "点天平：连盖粗称→转出→复称，记 m₁ − m₂",
      "demo-op-step3-compute",
      "K2",
      {
        completesStep: true,
        ...P({ mass: 1.0599 }),
        observation: { text: "m = 13.4055 − 12.3456 = 1.0599 g；c(Na₂CO₃)=0.1000 mol/L", value: 1.0599 },
        // 差减称量做完，天平示数要跟着变（原来永远是 0.0000 g，学生看不出第 2 步和第 3 步的差别）
        entityPatch: {
          "balance-1": { reading: 1.0599, note: "m₁ 13.4055 g − m₂ 12.3456 g" },
          "beaker-100": { note: "已称入 1.0599 g Na₂CO₃" },
        },
        feedback: fb(
          "info",
          "差减质量 1.0599 g",
          "差减法只算减掉的部分，洒落与吸水都落在差值里",
          "试样已在 100 mL 烧杯；第 4 步加 30 mL 水溶解",
          ["S003"],
        ),
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
          "示数未稳 → 单次偏 1 mg",
          "示数还在跳时读数，单次偏差 0.3~1 mg，差减质量不可信。",
          "等稳定指示符出现再读，重读这组；本步不废。",
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
          "热瓶上秤 → 漂移并伤传感器",
          "热瓶产生上升气流，浮力变化让示数单向漂移，热应力损伤传感器。",
          "放干燥器冷却至室温再称；本步数据作废，从粗称重来。",
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
    h0: "溶液凉了吗？",
    h1: "标准：杯壁不烫手、约室温（≤30 ℃）；转完液面低于刻度线",
    h2: "玻璃棒引流一次转入容量瓶，再洗烧杯与棒 3 次并入",
    h3: "演示冷却→玻璃棒引流→洗 3 次并入容量瓶。",
    h4: H4,
  },
  accepts: [
    "step4-rinse",
    "step4-hot",
    "step4-no-rinse",
  ],
  choices: [
    correct(
      "step4-rinse",
      "dissolve",
      "洗瓶给烧杯加水溶解，玻璃棒引流并入容量瓶",
      "demo-op-step4-rinse",
      "S2",
      {
        completesStep: true,
        // 本步要倒的是洗瓶里的蒸馏水（文案只说"加水"，靠文案匹配不出来 → 明写 reagent，
        // 否则拖任何一瓶试剂过来都会被当成"加对了"，2026-10-23 实测：浓硫酸倒进烧杯也算过）
        ...P({ reagent: "water" }),
        observation: { text: "烧杯内壁与玻璃棒洗 3 次，洗液全部并入容量瓶" },
        entityPatch: {
          "volumetric-100": { note: "已转入 Na₂CO₃ 溶液，待定容" },
          "beaker-100": { note: "已洗涤 3 次，洗液并入容量瓶" },
        },
        feedback: fb(
          "info",
          "洗 3 次，溶液已入瓶",
          "残留在杯壁的溶质靠这 3 次洗水并入，浓度才准",
          "溶液在 100 mL 容量瓶；第 5 步定容到 100.0 mL",
          ["S004"],
        ),
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
          "热液入瓶 → 瓶底炸裂",
          "玻璃局部受热不均产生热应力，容量瓶当场炸裂，溶液与数据同失。",
          "冷却至室温再引流；换新容量瓶，从转移重做本步。",
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
          "不洗烧杯 → c 偏低 0.8%",
          "杯壁与玻璃棒残留溶质没并入，配出的浓度偏低 0.3~0.8%。",
          "补洗 3 次并入再定容；本步作废，从溶解重配。",
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
    h0: "视线与刻度平吗？",
    h1: "标准：凹液面最低点与刻度线相切，100.0 mL ±0.10 mL",
    h2: "加到线下 1~2 cm 换胶头滴管，滴到切线再盖塞摇匀",
    h3: "演示“接近刻度改滴管→三位一线→盖塞倒转摇匀”。",
    h4: H4,
  },
  accepts: [
    "step5-shake",
    "step5-top-view",
    "step5-no-shake",
  ],
  choices: [
    correct(
      "step5-shake",
      "dilute",
      "洗瓶加到刻度下方→滴管定容→盖塞倒转摇匀",
      "demo-op-step5-shake",
      "S2",
      {
        completesStep: true,
        // 定容用洗瓶的蒸馏水（同 step4：文案不点试剂名，明写 reagent 才好判"倒错"）
        ...P({ volume: 100, reagent: "water" }),
        observation: { text: "溶液摇匀，无气泡、无挂壁；V = 100.0 mL" },
        entityPatch: {
          "volumetric-100": { liquid: { substance: "Na₂CO₃(aq)", level: 100, color: "#dce9f2", opacity: 0.25 } },
        },
        feedback: fb(
          "info",
          "定容 100.0 mL，摇匀",
          "倒转 10 次让上下层浓度一致，移取值才代表整体",
          "这 100 mL 留作第 6 步润洗与移取，先放稳",
          ["S004"],
        ),
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
          "俯视刻度 → c 偏高 0.3%",
          "视线斜向下时“到线”其实未到，V 偏小 0.1~0.3 mL，c 偏高。",
          "视线与刻度同高，补水滴到切线；本步不废，补后重读。",
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
          "不摇匀 → 上下浓度不均",
          "定容后水在上、浓液在下，直接移取的 25 mL 不代表整体浓度。",
          "盖塞倒转 ≥10 次再静置；本步不废，摇了再移取。",
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
    criterion: "放出体积 25.00±0.03mL；管尖外壁无液滴",
    competency: ["S2", "K2"],
    tolerance: { paramKey: "volume", expected: 25, unit: "mL", tolerance: 0.03 },
  },
  hints: {
    h0: "润洗过了吗？",
    h1: "标准：待移液润洗 3 次、每次约 5 mL 弃去；放出 25.00 ±0.03 mL",
    h2: "洗耳球吸到刻度上方，放到 25.00 mL，靠壁流下停 15 s",
    h3: "演示吸液至刻度上方→调至 25.00 mL→自然流下停 15 s。",
    h4: H4,
  },
  accepts: [
    "step6-drain",
    "step6-mouth",
    "step6-blow",
  ],
  choices: [
    correct(
      "step6-drain",
      "transfer",
      "移液管润洗后吸液，管尖靠壁放出",
      "demo-op-step6-drain",
      "S2",
      {
        completesStep: true,
        ...P({ volume: 25 }),
        observation: { text: "放出体积 25.00 mL；管尖外壁无液滴，停留 15 s" },
        feedback: fb(
          "info",
          "放出 25.00 mL",
          "管壁残液靠重力流尽，吹出会多放 0.05 mL",
          "这 25.00 mL 在锥形瓶里待用，第 7 步另配硫酸，别混",
          ["S004"],
        ),
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
          "吸入口中 → 碱液呛入气道",
          "Na₂CO₃ 溶液呈碱性，吸进嘴里会呛咳，误入气道灼伤黏膜。",
          "改用洗耳球吸液；本步作废，洗净移液管重取。",
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
          "吹残液 → 多放 0.05 mL",
          "管尖残液本就计入标称体积，吹出后多放 0.05 mL，n 偏大 0.2%。",
          "自然流下停 15 s；锥形瓶这份作废，本步重取 25.00 mL。",
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
    criterion: "加酸液温 ≤60 ℃，无暴沸、无溅出；标签含名称/浓度/日期/姓名",
    competency: ["A1", "K2"],
    tolerance: { paramKey: "concentration", expected: 0.5, unit: "mol/L", tolerance: 0.005 },
  },
  hints: {
    h0: "酸往哪倒？",
    h1: "标准：酸入水、边加边搅拌，液温 ≤60 ℃，不暴沸不溅出",
    h2: "量 95 mL 水入烧杯，10 mL 量筒取 2.7 mL 酸沿壁注入",
    h3: "演示护目镜+手套→通风橱→酸入水→冷却→贴标签。",
    h4: H4,
  },
  accepts: [
    "step7-label",
    "step7-water-into-acid",
    "step7-no-goggles",
  ],
  choices: [
    correct(
      "step7-label",
      "transfer",
      "量浓硫酸沿玻璃棒注入 250 mL 烧杯的水中→冷却→转入试剂瓶贴标签",
      "demo-op-step7-label",
      "A1",
      {
        completesStep: true,
        ...P({ concentration: 0.5, temperature: 48.5 }),
        observation: { text: "c(H₂SO₄)=0.50 mol/L；标签含名称/浓度/日期/姓名" },
        entityPatch: {
          "reagent-bottle": { liquid: { substance: "H₂SO₄(aq)", level: 100, color: "#dce9f2", opacity: 0.2 } },
        },
        feedback: fb(
          "info",
          "c=0.50 mol/L 已贴签",
          "冷到室温体积才定型，浓度才按 100 mL 算得准",
          "试剂瓶已贴签；第 4 步那瓶 Na₂CO₃ 数据齐，可进报告",
          ["S006"],
        ),
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
          "水入酸 → 沸腾爆溅伤人",
          "水密度 1.0 浮在酸面，稀释热集中在水层，局部瞬间超 100 ℃。",
          "酸入水、沿壁、边加边搅拌；本步终止，从第 7 步重来。",
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
          "不戴护目镜 → 酸溅入眼致盲",
          "眼球没有角质层，浓硫酸溅入即脱水碳化角膜，冲洗也难逆转。",
          "护目镜+丁腈手套+通风橱；溅眼即冲洗 ≥15 min，本步作废重做。",
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
  steps: [step1, step2, step3, step4, step5, step6, step7].map(withFx),
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
