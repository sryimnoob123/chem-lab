/**
 * experiments/exp02/definition.ts —— 实验 02《试剂级氯化钠制备》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp02.md。本文件只导出数据，不含 IO / React / 随机数。
 * 步骤、选项、判据与陷阱文案逐条来自规格 §6 / §7；线索（hints）来自规格 §6。
 *
 * 规格原文是 8 步；按"4~6 步"的课程节奏合并为 6 步：
 * 1 溶解 + 除 SO₄²⁻；2 除 Ca²⁺/Mg²⁺ + 过量 Ba²⁺；3 过滤；
 * 4 除过量 CO₃²⁻；5 蒸发结晶；6 抽滤/干燥/产率计算。
 * 场景复用现有分析天平 / 烧杯 / 容量瓶素材，不新增 SVG。
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
  "balance-1": {
    id: "balance-1",
    kind: "balance",
    reading: 0,
    note: "分析天平，Max 200 g，分度值 0.1 mg（产品称量）",
  },
  "balance-2": { id: "balance-2", kind: "balance", reading: 0, note: "托盘天平 200 g，0.1 g（粗盐称量）" },
  "beaker-100": { id: "beaker-100", kind: "beaker", note: "100 mL 烧杯（溶解粗盐）" },
  "beaker-250": { id: "beaker-250", kind: "beaker", note: "250 mL 烧杯" },
  "volumetric-100": { id: "volumetric-100", kind: "volumetric", note: "100 mL 容量瓶（结晶/定容容器占位）" },
  "evaporating-dish": { id: "evaporating-dish", kind: "beaker", note: "90 mm 蒸发皿（用烧杯占位）" },
  "filter-flask": { id: "filter-flask", kind: "flask", note: "250 mL 抽滤瓶" },
  "reagent-bottle": { id: "reagent-bottle", kind: "volumetric", note: "粗盐 / BaCl₂ / NaOH / Na₂CO₃ / HCl 试剂" },
  "weigh-bottle": { id: "weigh-bottle", kind: "beaker", note: "40 × 25 mm 称量瓶（产品干燥称量）" },
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
 * 构造小工具（与 exp01 / exp08 / exp09 同构）
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
const H4 = "连续犯同类错误 3 次：先停下复述除杂顺序（BaCl₂ → NaOH → Na₂CO₃ → HCl），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6，按 6 步合并）
 * ------------------------------------------------------------------ */

export const EXP02_STEP_DEMO_IDS: readonly string[] = [
  "exp02-step1-dissolve",
  "exp02-step3-naoh-na2co3",
  "exp02-step4-filter",
  "exp02-step5-hcl",
  "exp02-step6-evaporate",
  "exp02-step7-suction",
];

const step1: StepDefinition = {
  index: 0,
  title: "粗盐溶解与除 SO₄²⁻",
  scene: "实验台 + 天平",
  demoId: "exp02-step1-dissolve",
  judge: {
    criterion: "固体全溶、杯底无黑色不溶物结块；加水量 35~50 mL；上清液加 BaCl₂ 无浑浊，BaCl₂ 过量 0.5~2.0 mL",
    competency: ["S1", "K2"],
  },
  hints: {
    h0: "水多了后面要蒸更久：加水量按 8 mL/g 粗盐算。",
    h1: "水多了后面要蒸更久？",
    h2: "高亮 40 mL 刻度与 BaCl₂ 滴加终点：沉淀不再增多后再过量约 1 mL。",
    h3: "演示称 5.0 g 粗盐→加 40 mL 蒸馏水加热溶解→逐滴加 BaCl₂ 至不再沉淀→过量约 1 mL→取上清液复检。",
    h4: H4,
  },
  accepts: ["step1-weigh", "step1-dissolve", "step1-bacl2", "step1-water", "step1-mouth"],
  choices: [
    correct(
      "step1-weigh",
      "weigh",
      "托盘天平称粗盐 5.0 g",
      "demo-op-step1-weigh",
      "S1",
      {
        ...P({ mass: 5.0 }),
        observation: { text: "粗盐 m₀ = 5.0 g（托盘天平 0.1 g）" },
        entityPatch: { "balance-2": { reading: 5.0 } },
      },
    ),
    correct(
      "step1-dissolve",
      "dissolve",
      "加 40 mL 蒸馏水后加热搅拌至全溶",
      "demo-op-step1-dissolve",
      "S1",
      {
        requires: ["step1-weigh"],
        ...P({ volume: 40 }),
        observation: { text: "加 40 mL 蒸馏水，加热搅拌至固体全溶，杯底无黑色结块" },
        entityPatch: { "beaker-100": { note: "粗盐 5.0 g + 40 mL 水，已全溶" } },
      },
    ),
    correct(
      "step1-bacl2",
      "addDrops",
      "逐滴加 1.0 mol/L BaCl₂ 至不再生成白色沉淀，再过量约 1.0 mL；取上清液加 1 滴 BaCl₂ 无浑浊",
      "demo-op-step1-bacl2",
      "K2",
      {
        completesStep: true,
        requires: ["step1-weigh", "step1-dissolve"],
        ...P({ volume: 4.5, excess: 1.0 }),
        observation: {
          text: "BaCl₂ 逐滴加至不再沉淀，再过量 1.0 mL；上清液加 BaCl₂ 无浑浊（SO₄²⁻ 已除尽）",
        },
        entityPatch: { "beaker-100": { note: "BaSO₄ 沉淀 + 过量 BaCl₂ 1.0 mL" } },
        feedback: fb("info", "除 SO₄²⁻ 完成：BaCl₂ 过量 1.0 mL，上清液复检无浑浊", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step1-water",
      "dissolve",
      "一次加 100 mL 水",
      "demo-op-step1-water",
      "S1",
      hazard(
        "exp02-H9",
        "L1",
        2,
        "S1",
        fb(
          "warn",
          "溶液体积过大，蒸发时间成倍增加，晶膜判断滞后",
          "加水量按 8 mL/g 粗盐取 40 mL；一次加 100 mL 会使蒸发时间成倍增加，课时不够、晶膜判断滞后，产率偏低。",
          "按 8 mL 水/g 粗盐，取 40 mL 蒸馏水；先溶解，后续再浓缩。",
          ["S012"],
        ),
      ),
    ),
    trap(
      "step1-mouth",
      "addDrops",
      "用移液管口吸 1.0 mol/L BaCl₂ 溶液",
      "demo-op-step1-mouth",
      "A1",
      hazard(
        "exp02-H1",
        "L4",
        20,
        "A1",
        fb(
          "danger",
          "可溶性钡盐中毒，本次实验终止",
          "Ba²⁺ 经消化道吸收后阻断 K⁺ 通道，致低钾血症；口服约 0.8~1 g 即可中毒，表现为肌无力、心律失常，须送医。",
          "一律用洗耳球/量筒，严禁口吸；含 Ba²⁺ 废液倒入重金属废液桶，皮肤接触立即大量流水冲洗并报告。",
          ["S003", "S008"],
        ),
        { fx: "heavy-metal", incidentId: "exp02-H1", terminate: true },
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "除 Ca²⁺、Mg²⁺ 与过量 Ba²⁺",
  scene: "实验台",
  demoId: "exp02-step3-naoh-na2co3",
  judge: {
    criterion: "pH 10~11；上清液加 NaOH、Na₂CO₃ 均无浑浊；Na₂CO₃ 过量 0.5~2.0 mL",
    competency: ["K1", "S2"],
  },
  hints: {
    h0: "Mg²⁺ 要靠 OH⁻ 沉，CO₃²⁻ 沉不干净。",
    h1: "Mg²⁺ 要靠 OH⁻ 沉，CO₃²⁻ 沉不干净？",
    h2: "高亮 pH≈11：先碱后碳酸钠，各加至检验无浑浊。",
    h3: "演示 NaOH 调 pH≈11→饱和 Na₂CO₃ 至不再沉淀、过量约 1 mL→取上清液分别复检。",
    h4: H4,
  },
  accepts: ["step2-naoh", "step2-na2co3", "step2-verify", "step2-no-naoh"],
  choices: [
    correct(
      "step2-naoh",
      "addDrops",
      "滴加 6 mol/L NaOH 调 pH≈11，使 Mg²⁺ 生成 Mg(OH)₂ 沉淀",
      "demo-op-step2-naoh",
      "K1",
      { ...P({ ph: 11, drops: 12 }), observation: { text: "NaOH 调至 pH≈11，Mg²⁺ 生成 Mg(OH)₂ 沉淀" } },
    ),
    correct(
      "step2-na2co3",
      "addDrops",
      "加饱和 Na₂CO₃ 至不再生成沉淀，再过量约 1.0 mL",
      "demo-op-step2-na2co3",
      "K1",
      {
        requires: ["step2-naoh"],
        ...P({ excess: 1.0, drops: 30 }),
        observation: { text: "饱和 Na₂CO₃ 加至不再沉淀，再过量 1.0 mL；Ca²⁺、Ba²⁺ 已沉淀" },
      },
    ),
    correct(
      "step2-verify",
      "observe",
      "静置后取上清液，分别加 NaOH、Na₂CO₃，均无浑浊",
      "demo-op-step2-verify",
      "S2",
      {
        completesStep: true,
        requires: ["step2-naoh", "step2-na2co3"],
        observation: { text: "上清液加 NaOH 无浑浊、加 Na₂CO₃ 无浑浊；pH 10~11" },
        entityPatch: { "beaker-100": { note: "Ca²⁺/Mg²⁺/过量 Ba²⁺ 已沉淀，pH≈11" } },
        feedback: fb("info", "除杂完成：先碱后碳酸钠，两项复检均无浑浊", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step2-no-naoh",
      "addDrops",
      "只加 Na₂CO₃，不加 NaOH",
      "demo-op-step2-no-naoh",
      "K1",
      hazard(
        "exp02-H5",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "Mg²⁺ 沉不彻底，产品含镁盐，镁试剂检验显蓝色",
          "MgCO₃ 的 Ksp 为 6.8×10⁻⁶，比 Mg(OH)₂ 的 5.6×10⁻¹² 大得多；只加 Na₂CO₃ 时 Mg²⁺ 沉不干净，会留在母液中进入产品。",
          "先加 NaOH 调 pH≈11 沉 Mg(OH)₂，再加饱和 Na₂CO₃ 沉 Ca²⁺ 与过量 Ba²⁺，并取上清液复检。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "过滤分离沉淀",
  scene: "实验台 + 漏斗",
  demoId: "exp02-step4-filter",
  judge: {
    criterion: "滤液澄清无白色悬浮物；滤纸上沉淀完整",
    competency: ["S1"],
  },
  hints: {
    h0: "滤液浑了就是沉淀漏下去了：必须玻璃棒引流、“三靠”。",
    h1: "滤液浑了就是沉淀漏下去了？",
    h2: "高亮“三靠”与液面低于滤纸边缘；破了重滤。",
    h3: "演示滤纸对折、双层朝外、润湿贴紧→玻璃棒引流→液面低于滤纸边缘→少量蒸馏水洗沉淀 2 次。",
    h4: H4,
  },
  accepts: ["step3-assemble", "step3-filter", "step3-wash", "step3-pour", "step3-overflow"],
  choices: [
    correct(
      "step3-assemble",
      "assemble",
      "滤纸对折、双层朝外、润湿贴紧，漏斗颈贴烧杯壁",
      "demo-op-step3-assemble",
      "S1",
      { observation: { text: "滤纸双层朝外、润湿贴紧漏斗，漏斗颈贴烧杯壁（三靠）" } },
    ),
    correct(
      "step3-filter",
      "filter",
      "玻璃棒引流，液面低于滤纸边缘",
      "demo-op-step3-filter",
      "S1",
      {
        requires: ["step3-assemble"],
        observation: { text: "玻璃棒引流，液面始终低于滤纸边缘；滤液澄清" },
      },
    ),
    correct(
      "step3-wash",
      "washPrecipitate",
      "少量蒸馏水洗沉淀 2 次",
      "demo-op-step3-wash",
      "S1",
      {
        completesStep: true,
        requires: ["step3-assemble", "step3-filter"],
        observation: { text: "沉淀用少量蒸馏水洗 2 次，滤纸上沉淀完整" },
        entityPatch: { "filter-flask": { note: "滤液澄清，BaSO₄/CaCO₃/Mg(OH)₂ 沉淀已分离" } },
        feedback: fb("info", "过滤完成：三靠、引流、液面低于滤纸边缘", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step3-pour",
      "filter",
      "不引流直接倾倒",
      "demo-op-step3-pour",
      "S1",
      hazard(
        "exp02-H6",
        "L2",
        5,
        "S1",
        fb(
          "warn",
          "滤纸被冲破，沉淀漏入滤液",
          "不引流直接倾倒会冲起滤纸边缘甚至冲破滤纸，沉淀进入滤液；后续结晶把 BaSO₄、CaCO₃ 带入产品。",
          "玻璃棒引流、“三靠”、液面低于滤纸边缘；破了重做过滤，滤液一起重滤。",
          ["S015"],
        ),
      ),
    ),
    trap(
      "step3-overflow",
      "filter",
      "液面高过滤纸边缘",
      "demo-op-step3-overflow",
      "S1",
      hazard(
        "exp02-H6",
        "L2",
        5,
        "S1",
        fb(
          "warn",
          "沉淀从滤纸边缘爬入滤液，滤液浑浊",
          "液面高于滤纸边缘时，沉淀会从滤纸与漏斗壁的缝隙爬入滤液，等于没有分离。",
          "液面始终低于滤纸边缘；发现浑浊立即重滤，滤液一起重滤。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "除去过量 CO₃²⁻",
  scene: "实验台",
  demoId: "exp02-step5-hcl",
  judge: {
    criterion: "加酸后 pH 4~5；煮沸冷却后 pH 仍 4~5，无气泡",
    competency: ["K2", "S1"],
  },
  hints: {
    h0: "有气泡说明 CO₃²⁻ 还在：要加到 pH 4~5 再煮沸赶 CO₂。",
    h1: "有气泡说明 CO₃²⁻ 还在？",
    h2: "高亮 pH 4~5 与“煮沸 2~3 min、冷却复测”。",
    h3: "演示逐滴加 HCl、边加边测至 pH 4~5→煮沸 2~3 min→冷却后复测。",
    h4: H4,
  },
  accepts: ["step4-acid", "step4-boil", "step4-ph7", "step4-overacid"],
  choices: [
    correct(
      "step4-acid",
      "addDrops",
      "逐滴加 6 mol/L HCl 至 pH 4~5",
      "demo-op-step4-acid",
      "K2",
      { ...P({ ph: 4.5, volume: 1.2 }), observation: { text: "逐滴加 HCl 至 pH 4~5，CO₃²⁻ 转为 CO₂" } },
    ),
    correct(
      "step4-boil",
      "heat",
      "煮沸 2~3 min 赶尽 CO₂，冷却后复测 pH",
      "demo-op-step4-boil",
      "S1",
      {
        completesStep: true,
        requires: ["step4-acid"],
        observation: { text: "煮沸 2~3 min，冷却后 pH 仍 4~5，无气泡" },
        entityPatch: { "beaker-100": { note: "过量 CO₃²⁻ 已除尽，pH 4~5" } },
        feedback: fb("info", "除 CO₃²⁻ 完成：pH 4~5，煮沸后复测无气泡", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step4-ph7",
      "addDrops",
      "加到 pH 7 就停",
      "demo-op-step4-ph7",
      "K2",
      hazard(
        "exp02-H7",
        "L2",
        5,
        "K2",
        fb(
          "warn",
          "CO₃²⁻ 未全部转为 CO₂，结晶时与 NaCl 共结晶",
          "pH 7 时碳酸盐仍未除尽；结晶时 Na₂CO₃ 与 NaCl 共结晶，产品 pH 偏碱、纯度不合格。",
          "加 HCl 至 pH 4~5，再煮沸 2~3 min 赶尽 CO₂，冷却后复测。",
          ["S015"],
        ),
      ),
    ),
    trap(
      "step4-overacid",
      "addDrops",
      "加到 pH<2 仍继续",
      "demo-op-step4-overacid",
      "S1",
      hazard(
        "exp02-H13",
        "L1",
        2,
        "S1",
        fb(
          "warn",
          "酸过量，蒸发时 HCl 挥发夹带，产品偏酸",
          "pH<2 时酸过量，蒸发浓缩会挥发出 HCl 并夹带，产品 pH 检验不合格，需要重新调。",
          "逐滴加、边加边测，pH 4~5 即停；不要追求“越酸越干净”。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "蒸发浓缩与结晶",
  scene: "通风橱 + 电炉",
  demoId: "exp02-step6-evaporate",
  judge: {
    criterion: "停火时仍有少量母液、液面有晶膜；无固体崩溅",
    competency: ["S1"],
  },
  hints: {
    h0: "出现晶膜就该停：蒸干会让杂质夹带、固体崩溅。",
    h1: "出现晶膜就该停？",
    h2: "高亮晶膜与“关火，室温自然冷却”。",
    h3: "演示蒸发至液面出现晶膜（约剩 1/3）→关火→室温自然冷却结晶。",
    h4: H4,
  },
  accepts: ["step5-evaporate", "step5-cool", "step5-dry", "step5-chill"],
  choices: [
    correct(
      "step5-evaporate",
      "evaporate",
      "蒸发至液面出现晶膜（体积约剩 1/3）即停火",
      "demo-op-step5-evaporate",
      "S1",
      {
        ...P({ volume: 15 }),
        observation: { text: "蒸发至液面出现晶膜、约剩 1/3 母液，立即停火" },
      },
    ),
    correct(
      "step5-cool",
      "observe",
      "自然冷却至室温结晶",
      "demo-op-step5-cool",
      "S1",
      {
        completesStep: true,
        requires: ["step5-evaporate"],
        observation: { text: "关火后室温自然冷却，晶体析出，无固体崩溅" },
        entityPatch: { "volumetric-100": { note: "NaCl 晶体 + 少量母液，已自然冷却" } },
        feedback: fb("info", "结晶完成：晶膜出现即停火，室温自然冷却", undefined, undefined, ["S012"]),
      },
    ),
    trap(
      "step5-dry",
      "evaporate",
      "蒸干后继续强热",
      "demo-op-step5-dry",
      "S1",
      hazard(
        "exp02-H2",
        "L3",
        10,
        "S1",
        fb(
          "danger",
          "母液蒸尽后固体局部过热，残留液暴沸，NaCl 崩溅",
          "母液蒸尽后固体局部过热，残留液暴沸，NaCl 崩溅；热固体与液滴飞溅可灼伤面部/眼，蒸发皿可能开裂。",
          "出现晶膜立即停火，利用余热蒸干；不要继续强热。",
          ["S012"],
        ),
        { fx: "boil-over", incidentId: "exp02-H2" },
      ),
    ),
    trap(
      "step5-chill",
      "observe",
      "用冷水冲热烧杯外壁加速冷却",
      "demo-op-step5-chill",
      "S1",
      hazard(
        "exp02-H3",
        "L3",
        8,
        "S1",
        fb(
          "danger",
          "玻璃内外温差过大产生热应力，烧杯炸裂",
          "热烧杯外壁突然遇冷水，内外温差过大产生热应力，玻璃炸裂，热溶液与碎片四散。",
          "关火后室温自然冷却；不要用冷水冲热容器。",
          ["S012"],
        ),
        { fx: "glass-break", incidentId: "exp02-H3" },
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "抽滤、干燥与产率计算",
  scene: "抽滤台 + 分析天平",
  demoId: "exp02-step7-suction",
  judge: {
    criterion: "两次称量差 ≤0.0005 g；晶体洁白松散；η = m(产品)/[m(粗盐)×w]×100%",
    competency: ["S1", "A1"],
    tolerance: { paramKey: "yield", expected: 70, unit: "%", tolerance: 10 },
  },
  hints: {
    h0: "洗太多晶体会被溶掉：用饱和 NaCl 冰溶液少量洗 2 次。",
    h1: "洗太多晶体会被溶掉？",
    h2: "高亮“2 mL 饱和 NaCl、洗 2 次、105 ℃ 干燥至恒重”。",
    h3: "演示抽滤→2 mL 饱和 NaCl 洗 2 次→105 ℃ 30 min→称至恒重→按 η 计算。",
    h4: H4,
  },
  accepts: ["step6-assemble", "step6-wash", "step6-yield", "step6-water-wash", "step6-unwashed"],
  choices: [
    correct(
      "step6-assemble",
      "assemble",
      "布氏漏斗 + 抽滤瓶，滤纸润湿贴紧",
      "demo-op-step6-assemble",
      "S1",
      { observation: { text: "布氏漏斗与抽滤瓶连接，滤纸润湿贴紧" } },
    ),
    correct(
      "step6-wash",
      "washPrecipitate",
      "抽滤，用 2 mL 饱和 NaCl 冰溶液洗 2 次",
      "demo-op-step6-wash",
      "S1",
      {
        requires: ["step6-assemble"],
        ...P({ volume: 2, washes: 2 }),
        observation: { text: "抽滤，晶体用 2 mL 饱和 NaCl 冰溶液洗 2 次" },
        entityPatch: { "filter-flask": { note: "NaCl 晶体已抽滤、洗涤" } },
      },
    ),
    correct(
      "step6-yield",
      "compute",
      "105 ℃ 干燥 30 min 称至恒重（两次差 ≤0.0005 g），按 η = m(产品)/[m(粗盐)×w]×100% 计算",
      "demo-op-step6-yield",
      "A1",
      {
        completesStep: true,
        requires: ["step6-assemble", "step6-wash"],
        ...P({ yield: 70, mass: 3.2516 }),
        observation: {
          text: "两次称量 23.4512/23.4508 g，差 0.0004 g；m(产品)=3.2516 g，η=70%（2 位有效数字）",
        },
        entityPatch: { "weigh-bottle": { reading: 3.2516, note: "产品 3.2516 g，已恒重" } },
        feedback: fb("info", "产率计算完成：η=70%（m理=4.625 g，m产品=3.2516 g）", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step6-water-wash",
      "washPrecipitate",
      "用 20 mL 蒸馏水充分洗涤",
      "demo-op-step6-water-wash",
      "S1",
      hazard(
        "exp02-H11",
        "L1",
        3,
        "S1",
        fb(
          "warn",
          "同离子效应消失，NaCl 按溶解度溶解损失，产率下降 5~10 个百分点",
          "用 20 mL 蒸馏水充分洗涤时，同离子效应消失，NaCl 按溶解度溶解损失，产率下降 5~10 个百分点。",
          "用 2 mL 饱和 NaCl 冰溶液洗 2 次；同离子效应抑制溶解，又不过量。",
          ["S015"],
        ),
      ),
    ),
    trap(
      "step6-unwashed",
      "observe",
      "未洗涤晶体就直接取样检验",
      "demo-op-step6-unwashed",
      "A1",
      hazard(
        "exp02-H8",
        "L2",
        5,
        "A1",
        fb(
          "warn",
          "检验假阳性，误判产品不合格并做出错误结论",
          "晶体表面附着母液中的 SO₄²⁻、Ca²⁺、CO₃²⁻，未洗涤就检验会把这些杂质当成产品杂质，出现假阳性。",
          "先按步 7 洗至洗涤液无 Cl⁻ 反应，再取样检验；检验与洗涤顺序不能反。",
          ["S015"],
        ),
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp02Definition: ExperimentDefinition = {
  id: "exp02",
  title: "试剂级氯化钠制备",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5, step6],
  createState: (): ExperimentState => ({
    expId: "exp02",
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

export default exp02Definition;
