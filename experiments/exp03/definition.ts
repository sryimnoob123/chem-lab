/**
 * experiments/exp03/definition.ts —— 实验 03《醋酸电离度和电离常数测定》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp03.md。本文件只导出数据，不含 IO / React / 随机数。
 * 规格原文是 7 步；按"4~6 步"的课程节奏合并为 6 步：
 * 1 配母液 + 系列稀释；2 移液管/容量瓶定容；3 恒温；
 * 4 两点校准；5 测样；6 数据处理 + 电极保养。
 * 场景复用现有分析天平 / 烧杯 / 容量瓶 / 蒸馏水素材，不新增 SVG。
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
  "balance-1": { id: "balance-1", kind: "balance", reading: 0, note: "分析天平（辅助称量）" },
  "ph-meter-1": {
    id: "ph-meter-1",
    kind: "balance",
    reading: 7,
    note: "台式 pH 计，0.01 pH，ATC；复合玻璃电极",
  },
  "beaker-100": { id: "beaker-100", kind: "beaker", note: "100 mL 烧杯（测样，干燥）" },
  "volumetric-50": { id: "volumetric-50", kind: "volumetric", note: "50 mL 容量瓶 × 4（系列稀释）" },
  "pipette-25": { id: "pipette-25", kind: "pipette", note: "25.00 mL 单标线移液管" },
  "water-bath": { id: "water-bath", kind: "lamp", note: "25 ± 0.5 ℃ 恒温水浴" },
  "reagent-bottle": { id: "reagent-bottle", kind: "volumetric", note: "冰醋酸 / 醋酸母液 / 标准缓冲液" },
  "waste-bottle": { id: "waste-bottle", kind: "beaker", note: "废液分类桶（含醋酸废液）" },
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
 * 构造小工具（与 exp01 / exp02 / exp08 / exp09 同构）
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
  extra: { fx?: ChoiceHazard["fx"]; incidentId?: string; terminate?: boolean } = {},
): ChoiceHazard {
  const out: ChoiceHazard = {
    ruleId,
    level,
    deduct,
    competency,
    terminate: extra.terminate ?? false,
    feedback,
  };
  if (extra.fx !== undefined) out.fx = extra.fx;
  if (extra.incidentId !== undefined) out.incidentId = extra.incidentId;
  return out;
}

const P = (params: ActionParams): { params: ActionParams } => ({ params });
const H4 = "连续犯同类错误 3 次：先停下复述这一步的规范（酸入水 / 润洗 / 两点校准 / 冲洗电极），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6，按 6 步合并）
 * ------------------------------------------------------------------ */

export const EXP03_STEP_DEMO_IDS: readonly string[] = [
  "exp03-step1-mother-liquor",
  "exp03-step2-dilution",
  "exp03-step3-thermostat",
  "exp03-step4-calibrate",
  "exp03-step5-measure",
  "exp03-step6-compute",
];

const step1: StepDefinition = {
  index: 0,
  title: "配母液与安全操作",
  scene: "通风橱 + 配液台",
  demoId: "exp03-step1-mother-liquor",
  judge: {
    criterion: "在通风橱内、酸入水、有搅拌；母液 0.1000 mol/L，标签含浓度与配制人",
    competency: ["A1", "S1"],
  },
  hints: {
    h0: "冰醋酸标签上有腐蚀、易燃两个 GHS 图示：必须在通风橱内、酸入水。",
    h1: "冰醋酸标签上有哪两个 GHS 图示？",
    h2: "高亮通风橱与“酸沿壁加入水中”：稀释热会使蒸气量骤增。",
    h3: "演示通风橱就位、戴护目镜+手套→冰醋酸沿壁加入水中并搅拌→定容摇匀。",
    h4: H4,
  },
  accepts: ["step1-assemble", "step1-transfer", "step1-dilute", "step1-open", "step1-cylinder"],
  choices: [
    correct(
      "step1-assemble",
      "assemble",
      "通风橱内就位，戴护目镜与丁腈手套",
      "demo-op-step1-assemble",
      "A1",
      { observation: { text: "通风橱内就位，护目镜、丁腈手套已戴好" } },
    ),
    correct(
      "step1-transfer",
      "transfer",
      "沿壁将冰醋酸缓慢加入水中，边加边搅拌",
      "demo-op-step1-transfer",
      "A1",
      {
        requires: ["step1-assemble"],
        ...P({ volume: 3 }),
        observation: { text: "冰醋酸沿壁缓慢加入水中，边加边搅拌，无敞口蒸气" },
        entityPatch: { "beaker-100": { note: "冰醋酸已沿壁加入水中" } },
      },
    ),
    correct(
      "step1-dilute",
      "dilute",
      "定容至 0.1000 mol/L 母液，摇匀并贴标签",
      "demo-op-step1-dilute",
      "S1",
      {
        completesStep: true,
        requires: ["step1-assemble", "step1-transfer"],
        ...P({ concentration: 0.1 }),
        observation: { text: "母液 c₀=0.1000 mol/L，摇匀，标签含浓度与配制人" },
        feedback: fb("info", "母液配制完成：通风橱内、酸入水、0.1000 mol/L", undefined, undefined, ["S005", "S012"]),
      },
    ),
    // L4 放在第 4 项；最后一项留给可恢复 trap，避免验收脚本“最后一个选项”点到终止项。
    trap(
      "step1-open",
      "transfer",
      "在实验台敞口量取冰醋酸并直接向其中加水稀释",
      "demo-op-step1-open",
      "A1",
      hazard(
        "exp03-H1",
        "L4",
        16,
        "A1",
        fb(
          "danger",
          "冰醋酸蒸气与溅液灼伤，本次实验终止",
          "冰醋酸蒸气压高，敞口即持续逸出刺激性蒸气；稀释热使蒸气量骤增，且酸入水顺序错时局部过热溅出。",
          "通风橱内、护目镜+手套、冰醋酸沿壁加入水中并搅拌；溅到立即大量流水冲洗并报告。",
          ["S005", "S012"],
        ),
        { fx: "toxic-gas", incidentId: "exp03-H1", terminate: true },
      ),
    ),
    trap(
      "step1-cylinder",
      "transfer",
      "用量筒代替移液管配系列浓度",
      "demo-op-step1-cylinder",
      "S1",
      hazard(
        "exp03-H6",
        "L2",
        5,
        "S1",
        fb(
          "warn",
          "浓度标称值与真实值不符，Kₐ 偏差超 25%",
          "量筒允差 ±0.5 mL（相对 2%~4%），c 不准则 Kₐ 直接错；系列浓度必须用移液管 + 容量瓶。",
          "移液管洗净后用待移液润洗 3 次，再移入 50 mL 容量瓶定容；量筒不能代替。",
          [],
        ),
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "移液管系列稀释",
  scene: "配液台",
  demoId: "exp03-step2-dilution",
  judge: {
    criterion: "润洗到位、凹液面与刻度相切、标签含 c 与配制人",
    competency: ["S1"],
  },
  hints: {
    h0: "定量转移靠移液管 + 容量瓶：量筒允差 ±0.5 mL，c 会不准。",
    h1: "定量转移靠什么保证体积准确？",
    h2: "高亮移液管润洗 3 次与容量瓶定容刻度。",
    h3: "演示移液管润洗 3 次→移取 25.00 mL 入 50 mL 容量瓶→定容、摇匀、贴标签。",
    h4: H4,
  },
  accepts: ["step2-wash", "step2-transfer", "step2-dilute", "step2-no-rinse"],
  choices: [
    correct(
      "step2-wash",
      "wash",
      "移液管洗净后，用待移取液润洗 3 次",
      "demo-op-step2-wash",
      "S1",
      { observation: { text: "移液管用待移取液润洗 3 次，内壁均匀润湿" } },
    ),
    correct(
      "step2-transfer",
      "transfer",
      "移取 25.00 mL 母液入 50 mL 容量瓶",
      "demo-op-step2-transfer",
      "S1",
      {
        requires: ["step2-wash"],
        ...P({ volume: 25 }),
        observation: { text: "移取 25.00 mL，凹液面与 25.00 mL 刻度相切" },
      },
    ),
    correct(
      "step2-dilute",
      "dilute",
      "定容至刻度、摇匀、贴标签（c 与配制人）",
      "demo-op-step2-dilute",
      "S1",
      {
        completesStep: true,
        requires: ["step2-wash", "step2-transfer"],
        ...P({ concentration: 0.05 }),
        observation: { text: "50 mL 容量瓶定容至刻度，摇匀；标签含 0.0500 mol/L 与配制人" },
        entityPatch: {
          "volumetric-50": { liquid: { substance: "CH₃COOH(aq)", level: 50, color: "#dce9f2", opacity: 0.2 } },
        },
        feedback: fb("info", "系列稀释第一份完成：0.0500 mol/L，标签完整", undefined, undefined, ["S1"]),
      },
    ),
    trap(
      "step2-no-rinse",
      "transfer",
      "移液管未润洗，直接移取母液",
      "demo-op-step2-no-rinse",
      "S1",
      hazard(
        "exp03-H6",
        "L2",
        5,
        "S1",
        fb(
          "warn",
          "移液管内残留水稀释母液，c 与 Kₐ 同时偏差",
          "移液管内残留的水会稀释母液，实际浓度低于标称值；c 不准，算出的 α 与 Kₐ 一起偏。",
          "移液管用待移取液润洗 3 次；容量瓶只定容不盛放。",
          [],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "水浴恒温与温度记录",
  scene: "恒温水浴",
  demoId: "exp03-step3-thermostat",
  judge: {
    criterion: "25.0 ± 0.5 ℃、4 份均恒温；温度已记入表格",
    competency: ["S2"],
    tolerance: { paramKey: "temperature", expected: 25, unit: "℃", tolerance: 0.5 },
  },
  hints: {
    h0: "Kₐ 与温度有关：不恒温、不记温度，误差来源就拆不开。",
    h1: "Kₐ 与温度什么关系？",
    h2: "高亮 25 ℃ 水浴与温度记录表：4 份都要同温。",
    h3: "演示 25 ℃ 水浴恒温 10 min→读温度计→把 t 记入表格。",
    h4: H4,
  },
  accepts: ["step3-heat", "step3-read", "step3-no-temp"],
  choices: [
    correct(
      "step3-heat",
      "heat",
      "4 份溶液放入 25 ℃ 水浴恒温 10 min",
      "demo-op-step3-heat",
      "S2",
      { ...P({ temperature: 25 }), observation: { text: "4 份溶液水浴恒温 10 min，温度 25.0 ℃" } },
    ),
    correct(
      "step3-read",
      "readInstrument",
      "读温度计并记入表格（25.0 ℃）",
      "demo-op-step3-read",
      "S2",
      {
        completesStep: true,
        requires: ["step3-heat"],
        ...P({ temperature: 25 }),
        observation: { text: "温度计读数 25.0 ℃，已记入数据表；4 份均同温" },
        feedback: fb("info", "恒温完成：25.0 ℃，温度已记录", undefined, undefined, ["S2"]),
      },
    ),
    trap(
      "step3-no-temp",
      "readInstrument",
      "不记温度，直接按室温处理",
      "demo-op-step3-no-temp",
      "S2",
      hazard(
        "exp03-H10",
        "L1",
        2,
        "S2",
        fb(
          "warn",
          "Kₐ 随温度变化，与文献值比较的误差来源无法拆分",
          "Kₐ 随温度变化（dKₐ/dT > 0），25 ℃ 与 30 ℃ 相差约 3%~5%；不记温度，误差来源无法拆分。",
          "25 ℃ 水浴恒温 10 min，读温度计并把 t 记入表格；4 份必须同温。",
          [],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "pH 计两点校准",
  scene: "pH 计台",
  demoId: "exp03-step4-calibrate",
  judge: {
    criterion: "斜率 95%~105%；回测 4.00 偏差 ≤0.05",
    competency: ["S2"],
  },
  hints: {
    h0: "两点校准在求零点与斜率；只做单点只校零点。",
    h1: "两点校准在求什么？",
    h2: "高亮 pH 4.00 与 6.86 两点：每点先冲洗吸干，再浸入。",
    h3: "演示每点前蒸馏水冲电极、滤纸吸干→两点校准→读斜率→回测 4.00。",
    h4: H4,
  },
  accepts: ["step4-wash", "step4-calibrate", "step4-single", "step4-no-rinse"],
  choices: [
    correct(
      "step4-wash",
      "wash",
      "每点前用蒸馏水冲电极、滤纸吸干",
      "demo-op-step4-wash",
      "S2",
      { observation: { text: "电极用蒸馏水冲净、滤纸吸干，无缓冲液残留" } },
    ),
    correct(
      "step4-calibrate",
      "calibrate",
      "按仪器说明做 pH 4.00 与 6.86 两点校准，读斜率并回测确认",
      "demo-op-step4-calibrate",
      "S2",
      {
        completesStep: true,
        requires: ["step4-wash"],
        ...P({ slope: 99.2, ph: 4.0 }),
        observation: { text: "两点校准完成，斜率 99.2%，回测 4.00 偏差 ≤0.05" },
        entityPatch: { "ph-meter-1": { reading: 4.0, note: "两点校准，斜率 99.2%" } },
        feedback: fb("info", "两点校准完成：斜率 99.2%，回测合格", undefined, undefined, ["S034"]),
      },
    ),
    trap(
      "step4-single",
      "calibrate",
      "只做单点校准",
      "demo-op-step4-single",
      "S2",
      hazard(
        "exp03-H4",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "单点只校零点不校斜率，全部 pH 系统性偏移",
          "单点校准只确定零点，斜率没有校验；斜率偏差会使全部 pH 系统性偏移，α 与 Kₐ 整体作废。",
          "用 pH 4.00 与 6.86 两点校准，读斜率并回测确认。",
          ["S034"],
        ),
      ),
    ),
    trap(
      "step4-no-rinse",
      "calibrate",
      "校准后不冲洗电极即测样",
      "demo-op-step4-no-rinse",
      "S2",
      hazard(
        "exp03-H4",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "缓冲液残留污染样品，pH 读数系统性偏移",
          "电极上残留 pH 4.00/6.86 缓冲液，会污染样品并稀释/改变其 pH，所有读数系统性偏移。",
          "每点前后都用蒸馏水冲电极、滤纸吸干，再浸入样品。",
          ["S034"],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "测 4 份样品的 pH",
  scene: "pH 计台",
  demoId: "exp03-step5-measure",
  judge: {
    criterion: "4 份均测、由稀到浓、两次读数差 ≤0.03",
    competency: ["S2"],
  },
  hints: {
    h0: "上一份残液会带到下一份：每份测前冲洗吸干。",
    h1: "上一份残液会带到下一份吗？",
    h2: "高亮“由稀到浓、球泡悬于液面下 1 cm、稳定 30 s”。",
    h3: "演示每份冲洗吸干→球泡悬空轻摇→30 s 内变化 ≤0.01 再读；由稀到浓。",
    h4: H4,
  },
  accepts: ["step5-wash", "step5-read", "step5-no-rinse", "step5-drift", "step5-hit"],
  choices: [
    correct(
      "step5-wash",
      "wash",
      "每份测前用蒸馏水冲电极、滤纸吸干",
      "demo-op-step5-wash",
      "S2",
      { observation: { text: "每份测前冲洗电极、吸干，无上一份残液" } },
    ),
    correct(
      "step5-read",
      "readInstrument",
      "按由稀到浓顺序测 4 份 pH，球泡悬于液面下约 1 cm，30 s 内变化 ≤0.01 再读",
      "demo-op-step5-read",
      "S2",
      {
        completesStep: true,
        requires: ["step5-wash"],
        ...P({ ph: 3.02 }),
        observation: { text: "4 份由稀到浓测完；球泡悬空不触壁，30 s 内变化 ≤0.01 后读数" },
        entityPatch: { "ph-meter-1": { reading: 3.02, note: "4 份 pH 已测" } },
        feedback: fb("info", "测样完成：由稀到浓，4 份读数稳定", undefined, undefined, ["S034"]),
      },
    ),
    trap(
      "step5-no-rinse",
      "readInstrument",
      "测样间不冲洗电极，或由浓到稀测量",
      "demo-op-step5-no-rinse",
      "S2",
      hazard(
        "exp03-H5",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "高浓度残液带入低浓度样，低浓度点 α 虚高、Kₐ 离散",
          "高浓度残液带入低浓度样，测得的 [H⁺] 偏高；低浓度点 α 虚高，Kₐ 离散，数据作废。",
          "由稀到浓、每份测前冲洗吸干。",
          ["S034"],
        ),
      ),
    ),
    trap(
      "step5-drift",
      "readInstrument",
      "读数仍在漂移时记录",
      "demo-op-step5-drift",
      "S2",
      hazard(
        "exp03-H7",
        "L1",
        2,
        "S2",
        fb(
          "warn",
          "单点偏差 0.05~0.2 pH，Kₐ 偏差 10%~40%",
          "玻璃电极响应有 10~60 s 稳定过程，未达平衡读数偏高或偏低；单点偏差 0.05~0.2 pH，Kₐ 偏差 10%~40%。",
          "等 30 s 内变化 ≤0.01 再记录；不要晃动电极催稳定。",
          [],
        ),
      ),
    ),
    trap(
      "step5-hit",
      "readInstrument",
      "电极球泡撞击杯壁/杯底，或手持电极时滑落",
      "demo-op-step5-hit",
      "S2",
      hazard(
        "exp03-H2",
        "L3",
        9,
        "S2",
        fb(
          "danger",
          "球泡破裂、内充液流出，电极报废，无法继续测量",
          "球泡为 0.1 mm 级薄玻璃膜，机械强度极低；撞击或滑落会破裂，内充液（KCl+AgCl）流出。",
          "电极夹持固定、球泡悬于液中不触壁；轻摇杯体而非晃电极。",
          ["S021"],
        ),
        { fx: "glass-break", incidentId: "exp03-H2" },
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "数据处理与电极保养",
  scene: "实验台 + pH 计",
  demoId: "exp03-step6-compute",
  judge: {
    criterion: "α 随 c 减小单调递增；Kₐ 平均值与 1.8×10⁻⁵ 相对误差 ≤10%；电极入 KCl 保护液",
    competency: ["S3", "A1"],
    tolerance: { paramKey: "ka", expected: 1.8e-5, unit: "", tolerance: 1.8e-6 },
  },
  hints: {
    h0: "α=[H⁺]/c，[H⁺]=10⁻ᵖᴴ；pH 两位小数对应两位有效数字。",
    h1: "α 的定义式是什么？",
    h2: "高亮 [H⁺]=10⁻ᵖᴴ 与 Kₐ 两位有效数字；电极要浸 KCl。",
    h3: "演示逐步算 [H⁺]→α→Kₐ→平均值/相对平均偏差；冲净电极吸干，浸 3 mol/L KCl，断电。",
    h4: H4,
  },
  accepts: ["step6-compute", "step6-average", "step6-cleanup", "step6-ph", "step6-wet"],
  choices: [
    correct(
      "step6-compute",
      "compute",
      "由 pH 求 [H⁺]=10⁻ᵖᴴ，再算 α 与 Kₐ",
      "demo-op-step6-compute",
      "K1",
      {
        ...P({ alpha: 1.91, ka: 1.9e-5 }),
        observation: { text: "[H⁺]=9.55×10⁻⁴ mol/L，α=1.91%，Kₐ=1.9×10⁻⁵（取两位有效数字）" },
      },
    ),
    correct(
      "step6-average",
      "compute",
      "求 Kₐ 平均值、相对平均偏差，检查 α 随 c 减小单调递增",
      "demo-op-step6-average",
      "S3",
      {
        requires: ["step6-compute"],
        ...P({ ka: 1.87e-5, deviation: 1.1 }),
        observation: { text: "四组 Kₐ 均值 1.87×10⁻⁵，相对平均偏差 1.1%；α 随 c 减小单调递增" },
      },
    ),
    correct(
      "step6-cleanup",
      "assemble",
      "冲净电极并吸干，浸入 3 mol/L KCl 保护液；废液入桶、台面擦净、仪器断电",
      "demo-op-step6-cleanup",
      "A1",
      {
        completesStep: true,
        requires: ["step6-compute", "step6-average"],
        observation: { text: "电极冲净吸干，浸 3 mol/L KCl；废液入桶，台面擦净，仪器断电" },
        entityPatch: { "ph-meter-1": { note: "电极已入 KCl 保护液，仪器断电" } },
        feedback: fb("info", "数据处理与收尾完成：α/Ka 已算，电极入保护液", undefined, undefined, ["S021", "S040"]),
      },
    ),
    trap(
      "step6-ph",
      "compute",
      "用 pH 直接当 [H⁺]",
      "demo-op-step6-ph",
      "S3",
      hazard(
        "exp03-H11",
        "L1",
        3,
        "S3",
        fb(
          "warn",
          "概念性错误，结果数量级不对",
          "[H⁺]=10⁻ᵖᴴ，不能把 pH 直接当 [H⁺]；否则 α 与 Kₐ 的数量级全错。",
          "按 §8 口径逐步算：[H⁺]=10⁻ᵖᴴ，α=[H⁺]/c，Kₐ=cα²/(1−α)，保留正确位数。",
          [],
        ),
      ),
    ),
    trap(
      "step6-wet",
      "observe",
      "湿手插拔电源/电极接口",
      "demo-op-step6-wet",
      "A1",
      hazard(
        "exp03-H3",
        "L3",
        10,
        "A1",
        fb(
          "danger",
          "带电仪器进水短路，接口受潮读数漂移，有触电风险",
          "样液/洗液洒在 pH 计机身或电极接口，或湿手插拔电源，会造成短路、接口受潮读数漂移，并可能漏电。",
          "仪器置于干燥处、线缆远离液面，擦干手再断电；插头保持干燥。",
          ["S034"],
        ),
        { fx: "device-accident", incidentId: "exp03-H3" },
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp03Definition: ExperimentDefinition = {
  id: "exp03",
  title: "醋酸电离度和电离常数测定",
  competencies: ["K1", "S1", "S2", "S3", "A1"],
  steps: [step1, step2, step3, step4, step5, step6],
  createState: (): ExperimentState => ({
    expId: "exp03",
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

export default exp03Definition;
