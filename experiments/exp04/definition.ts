/**
 * experiments/exp04/definition.ts —— 实验 04《沉淀的生成与溶解平衡》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp04.md。本文件只导出数据，不含 IO / React / 随机数。
 * 规格原文是 8 步；按"4~6 步"的课程节奏合并为 5 步：
 * 1 器皿检查 → 2 AgCl 制备 → 3 离心与洗涤 → 4 氨溶与转化 → 5 分步沉淀 + 弱电解质溶解 + 废液。
 * 每步 4~5 个选项，并至少保留 1 个 L3 教学陷阱；L4 在离心步（H4）。
 * 场景复用现有烧杯 / 试管 / 容量瓶 / 蒸馏水素材，不新增 SVG。
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
  "centrifuge-1": { id: "centrifuge-1", kind: "balance", reading: 0, note: "台式离心机 4000 r/min，角转子 6 孔" },
  "tube-1": { id: "tube-1", kind: "tube", note: "1 号 10 mL 离心管（AgCl 沉淀）" },
  "tube-2": { id: "tube-2", kind: "tube", note: "2 号 10 mL 离心管（AgCl 沉淀）" },
  "tube-3": { id: "tube-3", kind: "tube", note: "3 号离心管（Cl⁻/I⁻ 分步沉淀）" },
  "tube-4": { id: "tube-4", kind: "tube", note: "4 号离心管（Mg(OH)₂）" },
  "beaker-100": { id: "beaker-100", kind: "beaker", note: "100 mL 烧杯" },
  "volumetric-100": { id: "volumetric-100", kind: "volumetric", note: "100 mL 容量瓶（稀释/定容占位）" },
  "reagent-bottle": { id: "reagent-bottle", kind: "volumetric", note: "AgNO₃ / NaCl / KI / 氨水 / NH₄Cl 等试剂" },
  "waste-bottle": { id: "waste-bottle", kind: "beaker", note: "重金属废液桶（含银废液专用）" },
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
 * 构造小工具（与 exp01 / exp02 / exp03 / exp08 / exp09 同构）
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
const H4 = "连续犯同类错误 3 次：先停下复述这一步的规范（对光查管 / 离心配平 / 蒸馏水洗涤 / 通风橱开氨水），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6，按 5 步合并）
 * ------------------------------------------------------------------ */

export const EXP04_STEP_DEMO_IDS: readonly string[] = [
  "exp04-step1-tube-check",
  "exp04-step2-precipitate",
  "exp04-step3-centrifuge",
  "exp04-step4-wash",
  "exp04-step5-ammonia",
];

const step1: StepDefinition = {
  index: 0,
  title: "离心管对光检查",
  scene: "离心管架 + 白纸背景",
  demoId: "exp04-step1-tube-check",
  judge: {
    criterion: "2 支管无裂纹且各带唯一编号；裂纹管弃用并报损",
    competency: ["S1"],
  },
  hints: {
    h0: "离心力是自重的 500~800 倍：裂纹尖端就是应力集中点。",
    h1: "离心力是自重的多少倍？",
    h2: "高亮管壁与管底：有裂纹一律弃用，不能“先用着看”。",
    h3: "演示逐支对光检查管壁与管底→弃用裂纹管并报损→挑 2 支完好管编号 1、2。",
    h4: H4,
  },
  accepts: ["step1-check", "step1-discard", "step1-pick", "step1-crack"],
  choices: [
    correct(
      "step1-check",
      "readInstrument",
      "逐支对光（背景打白纸）检查管壁与管底",
      "demo-op-step1-check",
      "S1",
      { observation: { text: "4 支离心管逐支对光检查，发现 2 支管壁有细裂纹" } },
    ),
    correct(
      "step1-discard",
      "assemble",
      "挑出 2 支裂纹管弃用，交教师报损",
      "demo-op-step1-discard",
      "S1",
      {
        requires: ["step1-check"],
        observation: { text: "2 支裂纹管弃用并交教师报损，不进入离心" },
      },
    ),
    correct(
      "step1-pick",
      "assemble",
      "挑出 2 支完好管，在管上部编号 1、2",
      "demo-op-step1-pick",
      "S1",
      {
        completesStep: true,
        requires: ["step1-check", "step1-discard"],
        observation: { text: "2 支完好管各带唯一编号 1、2，裂纹管已隔离" },
        feedback: fb("info", "器皿检查完成：裂纹管弃用，2 支完好管编号", undefined, undefined, ["S001", "S021"]),
      },
    ),
    // 可恢复 trap 放最后：验收脚本点最后一个也不会踩到 L4（本步没有 L4）。
    trap(
      "step1-crack",
      "readInstrument",
      "认为“细裂纹不影响”，跳过检查直接取用",
      "demo-op-step1-crack",
      "S1",
      hazard(
        "exp04-H1",
        "L3",
        9,
        "S1",
        fb(
          "danger",
          "细裂纹管在离心中崩裂，玻璃碎片与 AgNO₃ 液飞散",
          "裂纹尖端是应力集中点，3000 r/min 下管壁承受约 500~800 倍自重的离心力，玻璃抗张强度不足即沿裂纹崩裂。",
          "离心前逐支对光检查管壁与管底，有裂纹一律弃用；管壁与管底都不能有裂纹。",
          ["S001", "S021"],
        ),
        { fx: "glass-break", incidentId: "exp04-H1" },
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "制备 AgCl 沉淀",
  scene: "实验台",
  demoId: "exp04-step2-precipitate",
  judge: {
    criterion: "白色凝乳状沉淀；上清液加 NaCl 无新浑浊",
    competency: ["K1", "S1"],
  },
  hints: {
    h0: "沉淀完全靠什么判断？取上清液回检才是证据。",
    h1: "沉淀完全靠什么判断？",
    h2: "高亮 1.00 mL AgNO₃ 与 1.20 mL NaCl：按计算量 1.2 倍加，加完回检。",
    h3: "演示各取 1.00 mL AgNO₃→缓慢滴加 NaCl 1.20 mL、每 3~5 滴摇匀→静置 2 min→上清液回检。",
    h4: H4,
  },
  accepts: ["step2-transfer", "step2-add", "step2-excess", "step2-ki"],
  choices: [
    correct(
      "step2-transfer",
      "transfer",
      "1、2 号管各取 0.10 mol/L AgNO₃ 1.00 mL",
      "demo-op-step2-transfer",
      "S1",
      { ...P({ volume: 1 }), observation: { text: "1、2 号管各加入 0.10 mol/L AgNO₃ 1.00 mL" } },
    ),
    correct(
      "step2-add",
      "addDrops",
      "缓慢滴加 0.10 mol/L NaCl 1.20 mL，每加 3~5 滴摇匀；静置 2 min 后取上清液滴 1 滴 NaCl 回检",
      "demo-op-step2-add",
      "K1",
      {
        completesStep: true,
        requires: ["step2-transfer"],
        ...P({ volume: 1.2, drops: 24 }),
        observation: { text: "白色凝乳状 AgCl 沉淀；上清液加 NaCl 无新浑浊" },
        entityPatch: {
          "tube-1": { precipitate: { substance: "AgCl", amount: 1, color: "#f2f2f2" } },
          "tube-2": { precipitate: { substance: "AgCl", amount: 1, color: "#f2f2f2" } },
        },
        feedback: fb("info", "AgCl 制备完成：白色凝乳状，上清液回检无浑浊", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step2-excess",
      "addDrops",
      "一次倒入 5.00 mL NaCl（Cl⁻ 过量约 4 倍）",
      "demo-op-step2-excess",
      "K1",
      hazard(
        "exp04-H2",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "Cl⁻ 过量生成 [AgCl₂]⁻，AgCl 沉淀部分溶解",
          "Cl⁻ 过量会生成可溶的 [AgCl₂]⁻，AgCl 沉淀部分溶解，J 未超过 Ksp 的量被“吃掉”；沉淀量偏少，后续氨溶与转化现象不明显。",
          "按计算量 1.2 倍加入，加后取上清液回检；不要一次倒入大量 NaCl。",
          ["S015"],
        ),
      ),
    ),
    trap(
      "step2-ki",
      "addDrops",
      "误把 KI 当 NaCl 加入（看错标签）",
      "demo-op-step2-ki",
      "K1",
      hazard(
        "exp04-H3",
        "L3",
        9,
        "K1",
        fb(
          "danger",
          "误将 KI 当 NaCl：生成黄色 AgI，后续氨水根本溶不动",
          "生成的是黄色 AgI 而非白色 AgCl，Ksp 小 7 个数量级，后续氨水根本溶不动；全流程现象与判据全部错位。",
          "取液前核对标签名称与浓度，AgNO₃/NaCl/KI 两瓶分开摆放；加错只能重做。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "离心分离与洗涤",
  scene: "离心机 + 实验台",
  demoId: "exp04-step3-centrifuge",
  judge: {
    criterion: "对称配平、盖盖离心、停转后开盖、上清液澄清；洗涤 ≥2 次",
    competency: ["S1"],
  },
  hints: {
    h0: "转子的重心在哪儿？只有一支管绝不能单管离心。",
    h1: "转子的重心在哪儿？",
    h2: "高亮对称孔与两管液面：液面差 ≤0.1 mL 才配平。",
    h3: "演示设 3000 r/min、2.0 min→对称孔放等量水管→盖盖启动→完全停转后再开盖。",
    h4: H4,
  },
  accepts: ["step3-set", "step3-balance", "step3-wash", "step3-imbalance", "step3-tap"],
  choices: [
    correct(
      "step3-set",
      "readInstrument",
      "设 3000 r/min、2.0 min",
      "demo-op-step3-set",
      "S1",
      { ...P({ rpm: 3000, minutes: 2 }), observation: { text: "离心机设 3000 r/min、2.0 min" } },
    ),
    correct(
      "step3-balance",
      "assemble",
      "在对称孔放另一支装等量水的管，两管液面差 ≤0.1 mL",
      "demo-op-step3-balance",
      "S1",
      {
        requires: ["step3-set"],
        observation: { text: "对称孔放等量水管，两管液面差 ≤0.1 mL，盖好盖" },
      },
    ),
    correct(
      "step3-wash",
      "washPrecipitate",
      "离心完全停转后开盖，倾去上清液，用 2.0 mL 蒸馏水洗沉淀并重复 2~3 次",
      "demo-op-step3-wash",
      "S1",
      {
        completesStep: true,
        requires: ["step3-set", "step3-balance"],
        observation: { text: "离心停转后开盖，上清液澄清；沉淀用蒸馏水洗 2~3 次，末次洗液回检无浑浊" },
        entityPatch: { "tube-1": { note: "AgCl 沉淀已离心、洗涤" } },
        feedback: fb("info", "离心与洗涤完成：配平、盖盖、停转开盖、蒸馏水洗 2~3 次", undefined, undefined, ["S004", "S015"]),
      },
    ),
    trap(
      "step3-imbalance",
      "centrifuge",
      "只有一支管就单管离心（或对面放空管/不等量管）",
      "demo-op-step3-imbalance",
      "S1",
      hazard(
        "exp04-H4",
        "L4",
        20,
        "S1",
        fb(
          "danger",
          "转子剧烈振动移位、转子损毁、玻璃管飞出，腐蚀液飞溅伤人",
          "转子质量分布不均，高速旋转产生巨大不平衡离心力矩，轴承与转子受冲击，管可能甩出；本次实验终止。",
          "对称孔放等体积（液面差 ≤0.1 mL）配平管，盖盖后再启动；绝不单管或空管对位。",
          ["S004"],
        ),
        { fx: "device-accident", incidentId: "exp04-H4", terminate: true },
      ),
    ),
    trap(
      "step3-tap",
      "washPrecipitate",
      "用自来水洗涤沉淀（不用蒸馏水）",
      "demo-op-step3-tap",
      "S1",
      hazard(
        "exp04-H5",
        "L3",
        9,
        "S1",
        fb(
          "danger",
          "自来水 Cl⁻ 残留，后续分步沉淀提前出现白色浑浊，先黄后白顺序被破坏",
          "自来水含 Cl⁻（约 0.1~1 mmol/L），残留在沉淀与管壁；后续分步沉淀提前出现白色浑浊，观察数据作废。",
          "全程用蒸馏水洗 2~3 次，末次洗液加 AgNO₃ 回检无浑浊。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "氨溶与沉淀转化",
  scene: "通风橱 + 离心管架",
  demoId: "exp04-step4-wash",
  judge: {
    criterion: "AgCl 完全溶解、溶液澄清；白色转黄色，黄色沉淀不溶于氨水",
    competency: ["K1", "S2"],
  },
  hints: {
    h0: "配位溶解 K 只有 2.0×10⁻³：必须用 6 mol/L 氨水并过量。",
    h1: "配位溶解的平衡常数有多大？",
    h2: "高亮通风橱与 6 mol/L 氨水：逐滴加至刚溶，记录耗量。",
    h3: "演示通风橱内开排风→逐滴 6 mol/L 氨水至沉淀刚消失→2 号管滴 KI 3~5 滴→白转黄→上清液加氨水检验。",
    h4: H4,
  },
  accepts: ["step4-ammonia", "step4-convert", "step4-dilute-nh3", "step4-open-nh3", "step4-hno3"],
  choices: [
    correct(
      "step4-ammonia",
      "addDrops",
      "在通风橱内逐滴加 6 mol/L 氨水，每滴摇匀，至 AgCl 刚好溶解，记录耗量",
      "demo-op-step4-ammonia",
      "S2",
      {
        ...P({ volume: 1.05, concentration: 6 }),
        observation: { text: "6 mol/L 氨水滴加至 AgCl 刚好溶解，溶液澄清，耗量约 1.05 mL" },
      },
    ),
    correct(
      "step4-convert",
      "observe",
      "2 号管滴加 KI 3~5 滴并摇动，沉淀由白变黄；离心后上清液滴氨水检验（黄色不溶）",
      "demo-op-step4-convert",
      "K1",
      {
        completesStep: true,
        requires: ["step4-ammonia"],
        observation: { text: "白色 AgCl 转黄色 AgI；黄色沉淀不溶于氨水，转化完成" },
        entityPatch: { "tube-2": { precipitate: { substance: "AgI", amount: 1, color: "#e8c84a" } } },
        feedback: fb("info", "转化完成：白转黄，黄色沉淀不溶于氨水", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step4-dilute-nh3",
      "addDrops",
      "误用 0.10 mol/L 稀氨水溶解 AgCl",
      "demo-op-step4-dilute-nh3",
      "K1",
      hazard(
        "exp04-H7",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "稀氨水浓度不足，AgCl 溶不完全，误得“不溶于氨水”的错误结论",
          "配位溶解 K = Ksp·β₂ ≈ 2.0×10⁻³，平衡要求 [NH₃] 远大于化学计量；稀氨水浓度不足，沉淀溶不完全。",
          "用 6 mol/L 氨水并逐滴过量至刚溶；记录耗量。",
          [],
        ),
      ),
    ),
    trap(
      "step4-open-nh3",
      "observe",
      "在开放台面开盖浓氨水，或俯身对管口直接闻/用手扇闻",
      "demo-op-step4-open-nh3",
      "A1",
      hazard(
        "exp04-H8",
        "L3",
        9,
        "A1",
        fb(
          "danger",
          "浓氨水敞口逸出 NH₃，眼与呼吸道灼伤",
          "浓氨水蒸气压高，敞口持续逸出 NH₃；俯身闻使高浓度氨气直冲鼻腔与眼结膜，流泪、咳嗽、咽喉灼痛。",
          "通风橱内开盖，需要嗅辨时用手背远距离轻扇；不要俯身对管口。",
          ["S007"],
        ),
        { fx: "toxic-gas", incidentId: "exp04-H8" },
      ),
    ),
    trap(
      "step4-hno3",
      "addDrops",
      "转化前先加 6 mol/L HNO₃ 酸化含 AgCl 的体系",
      "demo-op-step4-hno3",
      "K1",
      hazard(
        "exp04-H9",
        "L1",
        3,
        "K1",
        fb(
          "warn",
          "酸化不改变 AgCl 溶解度，H⁺ 与氨水反应放热，现象判断混乱",
          "酸化本身不改变 AgCl 的溶解度，但引入的 H⁺ 与后续氨水反应放热、NO₃⁻ 稀释体系；现象判断混乱、耗氨量偏大。",
          "转化不必酸化，直接滴 KI 观察白→黄；黄色沉淀不溶于氨水即 AgI。",
          [],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "分步沉淀、弱电解质溶解与废液",
  scene: "实验台 + 通风橱 + 废液桶",
  demoId: "exp04-step5-ammonia",
  judge: {
    criterion: "先黄后白，首现黄色约 10 滴、累计约 20 滴；Mg(OH)₂ 完全溶解；含银废液入桶",
    competency: ["K2", "S2", "A1"],
    tolerance: { paramKey: "drops", expected: 10, unit: "滴", tolerance: 2 },
  },
  hints: {
    h0: "谁先达到 Ksp？AgI 所需 Ag⁺ 比 AgCl 低 7 个数量级。",
    h1: "谁先达到 Ksp？",
    h2: "高亮“逐滴加、每滴摇匀，先黄后白”；Mg(OH)₂ 用 NH₄Cl 溶。",
    h3: "演示 3 号管 NaCl+KI 稀释至 4.00 mL→逐滴 AgNO₃ 记录 10/20 滴→4 号管 Mg(OH)₂ 用 NH₄Cl 溶→含银废液入重金属桶。",
    h4: H4,
  },
  accepts: ["step5-fractional", "step5-weak", "step5-waste", "step5-one-shot", "step5-drain"],
  choices: [
    correct(
      "step5-fractional",
      "addDrops",
      "3 号管取 NaCl 0.50 mL + KI 0.50 mL，加水至 4.00 mL，逐滴加 AgNO₃，先黄后白，记录滴数",
      "demo-op-step5-fractional",
      "K2",
      {
        ...P({ drops: 10, totalDrops: 20, volume: 4 }),
        observation: { text: "先出现黄色 AgI（约第 10 滴），后出现白色 AgCl（累计约 20 滴）" },
      },
    ),
    correct(
      "step5-weak",
      "dissolve",
      "4 号管用 MgCl₂ + NaOH 制 Mg(OH)₂，离心洗涤后加 2.0 mL 2.0 mol/L NH₄Cl 溶解",
      "demo-op-step5-weak",
      "S2",
      {
        ...P({ volume: 2 }),
        observation: { text: "Mg(OH)₂ 沉淀加 2.0 mL 2.0 mol/L NH₄Cl 后完全溶解" },
        entityPatch: { "tube-4": { note: "Mg(OH)₂ 已溶于 NH₄Cl" } },
      },
    ),
    correct(
      "step5-waste",
      "transfer",
      "全部含银上清液与沉淀倒入重金属废液桶，台面擦净",
      "demo-op-step5-waste",
      "A1",
      {
        completesStep: true,
        requires: ["step5-fractional", "step5-weak"],
        observation: { text: "含银上清液/沉淀全部入重金属废液桶；台面擦净" },
        feedback: fb("info", "分步沉淀、弱电解质溶解与含银废液回收完成", undefined, undefined, ["S007", "S011"]),
      },
    ),
    trap(
      "step5-one-shot",
      "addDrops",
      "一次倒入 2.00 mL AgNO₃",
      "demo-op-step5-one-shot",
      "K2",
      hazard(
        "exp04-H10",
        "L2",
        5,
        "K2",
        fb(
          "warn",
          "局部 Ag⁺ 骤升，AgCl 与 AgI 同时析出，颜色混杂，先后顺序无法判定",
          "局部 [Ag⁺] 骤升，AgCl 与 AgI 的 J 同时超过各自 Ksp，两种沉淀一并析出；分步沉淀数据作废。",
          "逐滴加入，每滴摇匀后观察再判断；先黄后白。",
          ["S015"],
        ),
      ),
    ),
    trap(
      "step5-drain",
      "transfer",
      "含 Ag⁺、AgI 的废液与沉淀直接倾入水槽",
      "demo-op-step5-drain",
      "A1",
      hazard(
        "exp04-H12",
        "L3",
        9,
        "A1",
        fb(
          "danger",
          "含银废液入下水，重金属污染，违反危废管理规定",
          "Ag⁺ 对水生生物剧毒（μg/L 级即有毒性），AgI 虽难溶但长期可缓慢释放；酸性废液会促溶，污染下水与水体。",
          "全部含银液与沉淀倒入重金属废液桶，交有资质单位回收；不得稀释后倒入水槽。",
          ["S011"],
        ),
        { fx: "heavy-metal", incidentId: "exp04-H12" },
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp04Definition: ExperimentDefinition = {
  id: "exp04",
  title: "沉淀的生成与溶解平衡",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5],
  createState: (): ExperimentState => ({
    expId: "exp04",
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

export default exp04Definition;
