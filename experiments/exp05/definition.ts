/**
 * experiments/exp05/definition.ts —— 实验 05《氧化还原反应和电化学》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp05.md。本文件只导出数据，不含 IO / React / 随机数。
 * 规格原文是 8 步；按"5~6 步"的课程节奏合并为 6 步：
 * 1 电极准备与打磨 → 2 组装原电池与盐桥 → 3 电动势测定（读数规范）
 * → 4 浓度/温度对电动势的影响 → 5 酸度（介质）对氧化还原方向的影响 → 6 数据处理与电极回收。
 * 每步 5 个选项（3 个正确 + 2 个陷阱），可恢复陷阱一律排在选项列表最后一项；
 * 唯一 L4 是规格 §7 的 exp05-H6（浓硫酸直接滴入含水试管，boil-over，终止），
 * 放在第 5 步第 3 项（非末位），因此点最后一项不会触发终止。
 * 事故编号沿用规格 §7 的 exp05-H2/H3/H4/H5/H6/H9/H10，新增 H11~H14
 * （未打磨、电极短路、篡改读数、加热致 I₂ 挥发），文案仍取自规格 §1~§6，无自编化学解释。
 * 场景复用现有烧杯 / 试管 / 容量瓶 / 移液管素材，不新增 SVG。
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
  "multimeter-1": {
    id: "multimeter-1",
    kind: "balance",
    reading: 0,
    note: "数字万用表，直流电压 2 V 档，0.001 V",
  },
  "cell-zn": {
    id: "cell-zn",
    kind: "beaker",
    liquid: { substance: "1.00 mol/L ZnSO₄", level: 0.55, color: "#eaf2f5", opacity: 0.35 },
    note: "Zn 半电池（50 mL 烧杯）",
  },
  "cell-cu": {
    id: "cell-cu",
    kind: "beaker",
    liquid: { substance: "1.00 mol/L CuSO₄", level: 0.55, color: "#7fb6d9", opacity: 0.5 },
    note: "Cu 半电池（50 mL 烧杯）",
  },
  "salt-bridge-1": {
    id: "salt-bridge-1",
    kind: "tube",
    note: "U 形盐桥，内径 5 mm，饱和 KCl 琼脂",
  },
  "electrode-zn": { id: "electrode-zn", kind: "stand", note: "锌电极 ≥99.5%，40×10×1 mm" },
  "electrode-cu": { id: "electrode-cu", kind: "stand", note: "铜电极 ≥99.9%，40×10×1 mm" },
  "electrode-box": { id: "electrode-box", kind: "beaker", note: "电极回收盒（冲洗吸干后归位）" },
  "volumetric-100": {
    id: "volumetric-100",
    kind: "volumetric",
    note: "100 mL 容量瓶（CuSO₄ 浓度系列）",
  },
  "pipette-10": { id: "pipette-10", kind: "pipette", note: "10.00 mL 移液管，A 级" },
  "thermometer-1": { id: "thermometer-1", kind: "stand", note: "温度计 0~50 ℃，0.1 ℃" },
  "water-bath": {
    id: "water-bath",
    kind: "beaker",
    liquid: { substance: "水浴（温水）", level: 0.6, color: "#dfe9ef", opacity: 0.3 },
    note: "水浴烧杯",
  },
  "tube-1": {
    id: "tube-1",
    kind: "tube",
    liquid: { substance: "K₂Cr₂O₇ + KI（待酸化）", level: 0.3, color: "#e8b64a", opacity: 0.55 },
    note: "管①：0.05 mol/L K₂Cr₂O₇ 5 滴 + 0.10 mol/L KI 2 滴",
  },
  "tube-2": {
    id: "tube-2",
    kind: "tube",
    liquid: { substance: "K₂Cr₂O₇ + KI（加去离子水）", level: 0.3, color: "#e8b64a", opacity: 0.55 },
    note: "管②：同管①，加去离子水 5 滴",
  },
  "tube-3": {
    id: "tube-3",
    kind: "tube",
    liquid: { substance: "K₂Cr₂O₇ + KI（加 NaOH）", level: 0.3, color: "#f0d24a", opacity: 0.55 },
    note: "管③：同管①，加 6 mol/L NaOH 5 滴",
  },
  "reagent-bottle": {
    id: "reagent-bottle",
    kind: "volumetric",
    note: "K₂Cr₂O₇ / KI / 3 mol/L H₂SO₄ / 6 mol/L NaOH（公用试剂架）",
  },
  "waste-heavy": { id: "waste-heavy", kind: "beaker", note: "重金属废液桶（含 Cr(Ⅵ)/Cu²⁺ 专用）" },
  "waste-halogen": { id: "waste-halogen", kind: "beaker", note: "卤素废液桶（含 I₂/I⁻ 专用）" },
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
 * 构造小工具（与 exp01~exp04 / exp08 / exp09 同构）
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
const H4 = "连续犯同类错误 3 次：先停下复述这一步的规范（去离子水冲洗 / 盐桥琼脂连续 / 电压档并联 / 稳定后读数），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6，按 6 步合并）
 * ------------------------------------------------------------------ */

export const EXP05_STEP_DEMO_IDS: readonly string[] = [
  "exp05-step1-electrode-prep",
  "exp05-step2-assemble-cell",
  "exp05-step3-measure-emf",
  "exp05-step4-concentration-emf",
  "exp05-step5-acidity-effect",
  "exp05-step6-data-waste",
];

const step1: StepDefinition = {
  index: 0,
  title: "电极准备与打磨",
  scene: "实验台 + 电极盒 + 万用表",
  demoId: "exp05-step1-electrode-prep",
  judge: {
    criterion: "电极表面光洁无锈斑；盐桥琼脂连续、两端平整；万用表自检通过且档位为 DC 2 V",
    competency: ["S1"],
  },
  hints: {
    h0: "电极电势是在电极表面上建立的：表面有氧化层或油污，测到的就不是 Cu²⁺/Cu 的平衡电势。",
    h1: "盐桥里有什么？气泡会怎样改变读数？",
    h2: "高亮盐桥与电极表面：琼脂连续无气泡；打磨到光洁无锈斑，再用去离子水冲洗、滤纸吸干。",
    h3: "演示检查盐桥琼脂连续无气泡→砂纸打磨 Zn、Cu 电极至光洁→去离子水冲洗并吸干→电阻档自检表笔与导线，再切回 DC 2 V。",
    h4: H4,
  },
  accepts: [
    "step1-bridge-check",
    "step1-polish",
    "step1-multimeter",
    "step1-tap-water",
    "step1-no-polish",
  ],
  choices: [
    correct(
      "step1-bridge-check",
      "readInstrument",
      "取出 Zn、Cu 电极与盐桥，检查盐桥琼脂连续、无气泡、两端平整",
      "demo-op-step1-bridge-check",
      "S1",
      { observation: { text: "U 形盐桥内饱和 KCl 琼脂连续、无气泡，两端平整" } },
    ),
    correct(
      "step1-polish",
      "wash",
      "用砂纸打磨 Zn、Cu 电极至表面光洁无锈斑，再以去离子水冲洗、滤纸吸干",
      "demo-op-step1-polish",
      "S1",
      {
        ...P({ grit: "P600", volume: 20 }),
        observation: { text: "Zn、Cu 电极表面光洁无锈斑，去离子水冲洗后滤纸吸干" },
      },
    ),
    correct(
      "step1-multimeter",
      "assemble",
      "用电阻档自检表笔与导线通断，再切回直流电压 2 V 档",
      "demo-op-step1-multimeter",
      "S1",
      {
        completesStep: true,
        requires: ["step1-bridge-check", "step1-polish"],
        ...P({ range: "DC2V", continuity: true }),
        observation: { text: "表笔与导线通断正常；万用表已切回 DC 2 V 档" },
        feedback: fb("info", "电极与仪表准备完成：电极光洁、盐桥连续、万用表 DC 2 V", undefined, undefined, [
          "S004",
          "S026",
        ]),
      },
    ),
    trap(
      "step1-tap-water",
      "wash",
      "用自来水冲洗电极后直接插入半电池",
      "demo-op-step1-tap-water",
      "S1",
      hazard(
        "exp05-H10",
        "L1",
        2,
        "S1",
        fb(
          "warn",
          "自来水中的 Cl⁻、Ca²⁺/Mg²⁺ 污染半电池，读数偏低且不稳",
          "自来水中 Cl⁻、Ca²⁺、Mg²⁺ 污染半电池，Cl⁻ 还会侵蚀锌电极；读数偏低且不稳定，重复性差。",
          "一律用去离子水冲洗，滤纸吸干后再插入半电池。",
          ["S004"],
        ),
      ),
    ),
    // 可恢复 trap 放最后：验收脚本点最后一个也不会踩到 L4（L4 在步 5）。
    trap(
      "step1-no-polish",
      "assemble",
      "认为电极“看着挺亮”，跳过打磨与冲洗，直接拿去装配",
      "demo-op-step1-no-polish",
      "S1",
      hazard(
        "exp05-H11",
        "L3",
        9,
        "S1",
        fb(
          "danger",
          "电极表面氧化层与油污未除，测到的是“脏电极”的电势而不是 Cu²⁺/Cu 的平衡电势",
          "空气里放置的 Zn、Cu 片表面有氧化膜与手指油污，电极电势在真实表面上建立；未打磨时接触电阻增大，读数偏低、漂移且重复性差。",
          "先用砂纸打磨到光洁无锈斑，再用去离子水冲洗、滤纸吸干，严禁用手触摸极面。",
          ["S004"],
        ),
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "组装原电池与盐桥",
  scene: "实验台（两只半电池烧杯 + U 形盐桥）",
  demoId: "exp05-step2-assemble-cell",
  judge: {
    criterion: "Zn 片入 ZnSO₄、Cu 片入 CuSO₄ 且两片互不接触；盐桥两端浸入液面下约 5 mm、琼脂连续；红表笔接 Cu、黑表笔接 Zn",
    competency: ["S1", "S2"],
  },
  hints: {
    h0: "盐桥起什么作用？它接通两个半电池的离子通路，同时不让两种溶液直接混合。",
    h1: "盐桥一端悬空或桥内有气泡，离子通路会怎样？",
    h2: "高亮盐桥两端与液面：两端各浸入液面下约 5 mm，琼脂连续无气泡；两电极片间距 ≥1 cm 互不接触。",
    h3: "演示 Zn 片入 ZnSO₄、Cu 片入 CuSO₄（两片不接触）→竖直插入盐桥、两端浸入液面下约 5 mm→红表笔接 Cu、黑表笔接 Zn。",
    h4: H4,
  },
  accepts: [
    "step2-electrodes",
    "step2-bridge",
    "step2-short",
    "step2-polarity",
    "step2-bridge-gap",
  ],
  choices: [
    correct(
      "step2-electrodes",
      "assemble",
      "Zn 片插入 1.00 mol/L ZnSO₄、Cu 片插入 1.00 mol/L CuSO₄，两片间距 ≥1 cm",
      "demo-op-step2-electrodes",
      "S1",
      {
        ...P({ gap: 1 }),
        observation: { text: "Zn 片在 1.00 mol/L ZnSO₄、Cu 片在 1.00 mol/L CuSO₄，两片间距约 1 cm" },
        entityPatch: {
          "cell-zn": { note: "Zn 半电池（Zn 片已插入，浸入液面下约 3 cm）" },
          "cell-cu": { note: "Cu 半电池（Cu 片已插入，浸入液面下约 3 cm）" },
        },
      },
    ),
    correct(
      "step2-bridge",
      "assemble",
      "双手捏住盐桥两端竖直插入，两端各浸入液面下约 5 mm，确认琼脂连续、无气泡",
      "demo-op-step2-bridge",
      "S1",
      {
        requires: ["step2-electrodes"],
        ...P({ depth: 5 }),
        observation: { text: "盐桥竖直插入，两端各浸入液面下约 5 mm，琼脂连续无气泡" },
        entityPatch: { "salt-bridge-1": { note: "盐桥已架设：两端浸入液面下约 5 mm" } },
      },
    ),
    trap(
      "step2-short",
      "assemble",
      "让 Zn 片与 Cu 片在溶液中直接接触（或导线跨接两电极）后仍照样通电测量",
      "demo-op-step2-short",
      "S1",
      hazard(
        "exp05-H12",
        "L3",
        8,
        "S1",
        fb(
          "danger",
          "两电极短路，电池被自身短路，读数≈0 且电极极化",
          "Zn 片与 Cu 片直接接触时电子走电极片这条“内短路”，外电路几乎分不到电压；读数接近 0，同时两电极迅速极化，表面状态被破坏，须重新打磨装配。",
          "两片间距保持 ≥1 cm 互不接触，接线前确认导线没有跨接两电极。",
          ["S001", "S026"],
        ),
      ),
    ),
    correct(
      "step2-polarity",
      "assemble",
      "红表笔接 Cu（正极）、黑表笔接 Zn（负极），接线不跨接、两电极不短接",
      "demo-op-step2-polarity",
      "S2",
      {
        completesStep: true,
        requires: ["step2-electrodes", "step2-bridge"],
        observation: { text: "红表笔接 Cu 片、黑表笔接 Zn 片，导线无跨接，两电极互不接触" },
        feedback: fb("info", "原电池组装完成：Zn|ZnSO₄‖CuSO₄|Cu，盐桥连续，红接 Cu 黑接 Zn", undefined, undefined, [
          "S001",
          "S026",
        ]),
      },
    ),
    // 可恢复 trap 放最后：点最后一项只扣 L1 的 2 分，不会终止。
    trap(
      "step2-bridge-gap",
      "assemble",
      "盐桥一端悬在液面上方，或桥内有气泡也照样接线",
      "demo-op-step2-bridge-gap",
      "S1",
      hazard(
        "exp05-H3",
        "L1",
        2,
        "S1",
        fb(
          "warn",
          "盐桥断路或离子通路变窄，读数偏低且跳动大",
          "盐桥断路或离子通路截面积变小，内阻骤增；读数偏低、跳动大，稳定不到 0.001 V。",
          "检查琼脂连续、两端浸入液面下约 5 mm 后再接线。",
          ["S001"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "电动势测定（读数规范）",
  scene: "两只半电池 + 数字万用表",
  demoId: "exp05-step3-measure-emf",
  judge: {
    criterion: "电压档（高内阻）并联接入；读数 1.05~1.15 V，红表笔侧为正极（Cu）；波动 ≤0.001 V 并稳定 ≥30 s 后记录",
    competency: ["S2", "K1"],
    tolerance: { paramKey: "emf", expected: 1.104, unit: "V", tolerance: 0.05 },
  },
  hints: {
    h0: "电动势是“开路”电压：测量回路的内阻必须远大于电池内阻。",
    h1: "电流档的内阻有多大？并联上去等于把电池怎么样？",
    h2: "高亮万用表档位与读数：先确认 DC 2 V，再并联；读数波动 ≤0.001 V、稳定 ≥30 s 才记录。",
    h3: "演示切 DC 2 V 档→红接 Cu 黑接 Zn 并联→观察读数由跳动趋于稳定→波动 ≤0.001 V 且 ≥30 s 后记 1.098 V（25.0 ℃）。",
    h4: H4,
  },
  accepts: ["step3-calibrate", "step3-record", "step3-read", "step3-current-mode", "step3-drift"],
  choices: [
    correct(
      "step3-calibrate",
      "calibrate",
      "万用表置直流电压 2 V 档，红表笔接 Cu、黑表笔接 Zn，并联在两电极上",
      "demo-op-step3-calibrate",
      "S2",
      {
        ...P({ range: "DC2V", mode: "voltage" }),
        observation: { text: "万用表 DC 2 V 档，红表笔接 Cu、黑表笔接 Zn，并联接入" },
      },
    ),
    correct(
      "step3-record",
      "observe",
      "同时记录测定温度 25.0 ℃、c(Cu²⁺)/c(Zn²⁺) 与盐桥类型（饱和 KCl 琼脂）",
      "demo-op-step3-record",
      "S2",
      {
        requires: ["step3-calibrate"],
        ...P({ temperature: 25, bridge: "饱和 KCl 琼脂" }),
        observation: {
          text: "原始记录：25.0 ℃；c(Cu²⁺)=1.00 mol/L、c(Zn²⁺)=1.00 mol/L；盐桥为饱和 KCl 琼脂",
        },
      },
    ),
    correct(
      "step3-read",
      "readInstrument",
      "待读数波动 ≤0.001 V 并稳定 ≥30 s 后记录：E(实测) = 1.098 V",
      "demo-op-step3-read",
      "K1",
      {
        completesStep: true,
        requires: ["step3-calibrate", "step3-record"],
        ...P({ emf: 1.098, stableSeconds: 30 }),
        observation: { text: "读数稳定在 1.098 V（波动 ≤0.001 V，持续 ≥30 s），红表笔侧 Cu 为正极", value: 1.098 },
        feedback: fb("info", "电动势测定完成：1.098 V（25.0 ℃），与 1.104 V 相差 0.5%", undefined, undefined, [
          "S026",
        ]),
      },
    ),
    trap(
      "step3-current-mode",
      "calibrate",
      "把万用表置于直流电流档（mA）并联在两电极上测电动势",
      "demo-op-step3-current-mode",
      "S2",
      hazard(
        "exp05-H2",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "电流档内阻极小，等于把原电池短路，保险丝熔断或表头烧毁",
          "电流档内阻极小，近似把原电池短路，同时大电流灌入表头；保险丝熔断或表头损坏，仪器报废，后续测量无法进行。",
          "电动势只能用电压档（高内阻）并联测量，先确认档位再接线。",
          ["S026"],
        ),
        { fx: "device-accident", incidentId: "exp05-H2" },
      ),
    ),
    // 可恢复 trap 放最后：点最后一项只扣 L2 的 5 分，不会终止。
    trap(
      "step3-drift",
      "readInstrument",
      "读数在 1.09↔1.11 V 间跳动，直接取跳动范围的最大值记录",
      "demo-op-step3-drift",
      "S2",
      hazard(
        "exp05-H5",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "把系统漂移当成随机误差，取最大值只会把误差放大",
          "漂移来自盐桥气泡或接触不良，属系统问题；取极值或换大量程只会把误差放大或降低分辨率，原始数据不可复核。",
          "先查盐桥气泡与电极接触，待波动 ≤0.001 V 稳定 ≥30 s 后读数；仍漂移就如实记录现象并排查。",
          ["S001"],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "浓度/温度对电动势的影响",
  scene: "实验台（Cu 半电池逐级换液）+ 水浴",
  demoId: "exp05-step4-concentration-emf",
  judge: {
    criterion: "Cu²⁺ 每降 10 倍 E 下降 0.030±0.005 V；单点相对误差 ≤3%；水浴恒温 35.0 ℃ 并由温度计读液温",
    competency: ["K1", "S1", "S2"],
    tolerance: { paramKey: "emf", expected: 0.0296, unit: "V", tolerance: 0.005 },
  },
  hints: {
    h0: "25 ℃ 下二电子电极每稀释 10 倍降 0.0592/2 = 0.0296 V；电池电动势是正极减负极。",
    h1: "Cu²⁺ 降到 0.100 mol/L 时 E 降多少？温度没记下来还怎么算理论值？",
    h2: "高亮换液与水浴：每次换液用去离子水冲洗电极并吸干；水浴恒温 35.0 ℃，温度计读半电池液温。",
    h3: "演示依次换 0.100、0.0100、1.00×10⁻³ mol/L CuSO₄→每次冲洗吸干→稳定 ≥30 s 读数→水浴 35.0 ℃ 重测一组并记温度。",
    h4: H4,
  },
  accepts: ["step4-series", "step4-read", "step4-temperature", "step4-no-rinse", "step4-fudge"],
  choices: [
    correct(
      "step4-series",
      "transfer",
      "依次把 Cu 半电池换成 0.100、0.0100、1.00×10⁻³ mol/L CuSO₄，每次换液前用去离子水冲洗电极并吸干",
      "demo-op-step4-series",
      "S1",
      {
        ...P({ concentrations: "1.00/0.100/0.0100/1.00e-3" }),
        observation: {
          text: "Cu 半电池依次换为 0.100、0.0100、1.00×10⁻³ mol/L CuSO₄，每次换液都冲洗吸干电极",
        },
      },
    ),
    correct(
      "step4-read",
      "readInstrument",
      "每个浓度点待读数波动 ≤0.001 V 并稳定 ≥30 s 后读数，四个浓度点一并记录",
      "demo-op-step4-read",
      "K1",
      {
        requires: ["step4-series"],
        ...P({ stableSeconds: 30, points: 4 }),
        observation: {
          text: "四点电动势：1.098 / 1.068 / 1.038 / 1.008 V——Cu²⁺ 每降 10 倍降约 0.030 V",
          value: 0.03,
        },
      },
    ),
    correct(
      "step4-temperature",
      "heat",
      "把半电池放入水浴恒温 35.0 ℃，温度计读液温（±0.1 ℃）后重测一组 E，记录“温度—电动势”对",
      "demo-op-step4-temperature",
      "S2",
      {
        completesStep: true,
        requires: ["step4-series", "step4-read"],
        ...P({ temperature: 35, stableSeconds: 30 }),
        observation: {
          text: "35.0 ℃ 重测 E(实测) = 1.096 V，理论 1.104 V，相对误差 0.7% ≤3%",
          value: 35,
        },
        feedback: fb("info", "浓度与温度数据完成：每降 10 倍降约 0.030 V；35.0 ℃ 下 E = 1.096 V", undefined, undefined, [
          "S026",
        ]),
        entityPatch: { "cell-cu": { note: "Cu 半电池（已换为 1.00×10⁻³ mol/L CuSO₄，35.0 ℃ 测过）" } },
      },
    ),
    trap(
      "step4-no-rinse",
      "wash",
      "换液时不冲洗电极，直接把带浓溶液的电极插入稀溶液",
      "demo-op-step4-no-rinse",
      "S1",
      hazard(
        "exp05-H4",
        "L2",
        5,
        "S1",
        fb(
          "warn",
          "电极表面残留浓溶液，实际浓度高于标称值，E 偏高",
          "电极表面残留浓溶液，实际浓度高于标称值，E 偏高；浓度—电动势曲线整体上移，规律失真。",
          "每次换液用去离子水冲洗电极并吸干，再插入新浓度溶液。",
          ["S001"],
        ),
      ),
    ),
    // 可恢复 trap 放最后：点最后一项只扣 L3 的 8 分，不会终止。
    trap(
      "step4-fudge",
      "compute",
      "读数与 Nernst 理论值不符，就把实测值按理论值“修正”后写进记录",
      "demo-op-step4-fudge",
      "S2",
      hazard(
        "exp05-H13",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "按理论值改数属于篡改原始数据，全部数据作废",
          "实测与理论不符应查盐桥气泡、接触与温度，而不是改原始记录；改数使误差分析失去意义，报告判定为无效。",
          "如实记录实测值，先查盐桥与接触，再在误差分析里讨论偏差来源。",
          ["S001"],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "酸度对氧化还原反应的影响",
  scene: "试管架 + 公用试剂架",
  demoId: "exp05-step5-acidity-effect",
  judge: {
    criterion: "三管现象：①棕黄（加淀粉变蓝）②橙黄不变 ③黄色（CrO₄²⁻）；酸化只用 3 mol/L H₂SO₄",
    competency: ["K2", "A1"],
  },
  hints: {
    h0: "酸性下 Cr(Ⅵ) 以 Cr₂O₇²⁻ 存在，H⁺ 在反应物一侧，氧化性随酸度上升。",
    h1: "碱里为什么氧化性大降？",
    h2: "高亮试剂瓶标签与管口：只取 3 mol/L H₂SO₄，沿管壁缓慢加入并摇匀；18 mol/L 浓酸在公用架，学生不得取用。",
    h3: "演示三管各加 K₂Cr₂O₇ 5 滴 + KI 2 滴→管①3 mol/L H₂SO₄ 5 滴、管②去离子水 5 滴、管③6 mol/L NaOH 5 滴→记录棕黄/橙黄/黄色。",
    h4: H4,
  },
  accepts: ["step5-chromate", "step5-medium", "step5-conc-acid", "step5-observe", "step5-heat"],
  choices: [
    correct(
      "step5-chromate",
      "addDrops",
      "三支试管各加 0.05 mol/L K₂Cr₂O₇ 5 滴 + 0.10 mol/L KI 2 滴",
      "demo-op-step5-chromate",
      "K2",
      {
        ...P({ drops: 7 }),
        observation: { text: "管①②③各含 0.05 mol/L K₂Cr₂O₇ 5 滴 + 0.10 mol/L KI 2 滴，均为橙黄色" },
      },
    ),
    correct(
      "step5-medium",
      "addDrops",
      "管①加 3 mol/L H₂SO₄ 5 滴（沿管壁缓慢加入并摇匀）、管②加去离子水 5 滴、管③加 6 mol/L NaOH 5 滴",
      "demo-op-step5-medium",
      "K2",
      {
        requires: ["step5-chromate"],
        ...P({ drops: 5, acid: 3, alkali: 6 }),
        observation: { text: "管①酸化、管②加去离子水、管③碱化，三管介质不同" },
        entityPatch: {
          "tube-1": { note: "管①（已加 3 mol/L H₂SO₄ 5 滴）" },
          "tube-3": { note: "管③（已加 6 mol/L NaOH 5 滴）" },
        },
      },
    ),
    // 唯一 L4，放在非最后位置（第 3 项）。
    trap(
      "step5-conc-acid",
      "addDrops",
      "从公用架取 18 mol/L 浓 H₂SO₄，直接滴入盛有 K₂Cr₂O₇/KI 水溶液的试管",
      "demo-op-step5-conc-acid",
      "A1",
      hazard(
        "exp05-H6",
        "L4",
        20,
        "A1",
        fb(
          "danger",
          "浓硫酸遇水剧烈放热，局部沸腾喷出酸液与碘蒸气，本次实验终止",
          "浓硫酸与水混合放出巨大稀释热（约 880 J/g 酸），局部瞬间沸腾；强氧化性又使 I⁻ 剧烈氧化析出大量 I₂ 与酸雾，高温酸液与碘蒸气从管口喷出。",
          "只用 3 mol/L H₂SO₄，沿管壁缓慢加入并摇匀；浓酸由教师在通风橱内统一配制，学生不得取用。",
          ["S007", "S012", "S015"],
        ),
        { fx: "boil-over", incidentId: "exp05-H6", terminate: true },
      ),
    ),
    correct(
      "step5-observe",
      "observe",
      "记录三管颜色：①棕黄（析出 I₂，加淀粉变蓝）、②橙黄不变、③黄色（CrO₄²⁻），确认只有管①生成 I₂",
      "demo-op-step5-observe",
      "K2",
      {
        completesStep: true,
        requires: ["step5-chromate", "step5-medium"],
        observation: { text: "管①棕黄（淀粉变蓝）、管②橙黄不变、管③黄色，仅酸性管生成 I₂" },
        feedback: fb("info", "酸度影响完成：①棕黄析出 I₂ ②橙黄不变 ③黄色为 CrO₄²⁻", undefined, undefined, [
          "S015",
        ]),
      },
    ),
    // 可恢复 trap 放最后：点最后一项只扣 L1 的 2 分，不会终止。
    trap(
      "step5-heat",
      "heat",
      "为“加快反应”把管①加热至沸腾",
      "demo-op-step5-heat",
      "K2",
      hazard(
        "exp05-H14",
        "L1",
        2,
        "K2",
        fb(
          "warn",
          "I₂ 与酸雾随蒸气逸出，现象判读失真",
          "加热使 I₂ 挥发、酸雾逸出，管内颜色变浅甚至判不出棕黄；同时蒸气带出 I₂ 影响后续淀粉检验。",
          "常温下沿壁加酸并摇匀观察；确实需要加热时用温水浴，管口不对人。",
          ["S030"],
        ),
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "数据处理与电极回收",
  scene: "实验台 + 废液桶 + 电极盒",
  demoId: "exp05-step6-data-waste",
  judge: {
    criterion: "四点相对误差 ≤3% 且符号正确；含 Cr(Ⅵ)/Cu²⁺ 入重金属桶、含 I₂/I⁻ 入卤素桶；电极洗净吸干收回",
    competency: ["S2", "A1"],
  },
  hints: {
    h0: "电池电动势是“正极减负极”，锌电极的标准电极电势本身是负值。",
    h1: "E°(Zn²⁺/Zn) 到底取正还是取负？",
    h2: "高亮计算式与两只废液桶：0.3419 −(−0.7618)；含铬/含铜与含碘分开倒。",
    h3: "演示写 E(电池) = E(正) − E(负) → 算各点理论 E 与相对误差（注明温度与浓度）→电极冲洗吸干收回→废液按重金属/卤素分类倒入对应桶。",
    h4: H4,
  },
  accepts: ["step6-compute", "step6-electrode-recover", "step6-waste", "step6-drain", "step6-sign"],
  choices: [
    correct(
      "step6-compute",
      "compute",
      "用 Nernst 方程算各浓度点理论 E 与相对误差，注明温度、浓度与盐桥类型",
      "demo-op-step6-compute",
      "S2",
      {
        ...P({ points: 4 }),
        observation: { text: "四点理论 E 与相对误差全部算出（均 ≤3%），表头含温度、浓度与盐桥类型" },
      },
    ),
    correct(
      "step6-electrode-recover",
      "wash",
      "Zn、Cu 电极用去离子水冲洗、滤纸吸干后放回电极盒",
      "demo-op-step6-electrode-recover",
      "S1",
      {
        requires: ["step6-compute"],
        ...P({ volume: 20 }),
        observation: { text: "Zn、Cu 电极冲洗吸干后归入电极盒，盐桥两端泡在饱和 KCl 中保存" },
        entityPatch: {
          "electrode-zn": { note: "已冲洗吸干，归入电极盒" },
          "electrode-cu": { note: "已冲洗吸干，归入电极盒" },
        },
      },
    ),
    correct(
      "step6-waste",
      "transfer",
      "含 Cr(Ⅵ)/Cu²⁺ 废液入重金属废液桶，含 I₂/I⁻ 废液入卤素废液桶",
      "demo-op-step6-waste",
      "A1",
      {
        completesStep: true,
        requires: ["step6-compute", "step6-electrode-recover"],
        observation: { text: "废液分类倒入：含铬/含铜入重金属桶，含碘入卤素桶；台面擦净" },
        feedback: fb("info", "数据整理与回收完成：误差 ≤3%、废液分类、电极归位", undefined, undefined, [
          "S021",
          "S001",
        ]),
      },
    ),
    trap(
      "step6-drain",
      "transfer",
      "把含 Cr(Ⅵ)、Cu²⁺ 与 I₂ 的废液一起倒入水槽冲走",
      "demo-op-step6-drain",
      "A1",
      hazard(
        "exp05-H9",
        "L3",
        9,
        "A1",
        fb(
          "danger",
          "含铬/含铜废液入下水，重金属污染且违反危废管理规定",
          "Cr(Ⅵ) 致癌且迁移性强，Cu²⁺ 对水生生物高毒；稀释后倒入水槽会污染下水与土壤，违反危废管理规定。",
          "含铬/含铜废液入重金属废液桶，含碘废液入卤素废液桶，交危废单位处置。",
          ["S021"],
        ),
        { fx: "heavy-metal", incidentId: "exp05-H9" },
      ),
    ),
    // 可恢复 trap 放最后：点最后一项只扣 L2 的 5 分，不会终止。
    trap(
      "step6-sign",
      "compute",
      "算 E(电池) 时把 E°(Zn²⁺/Zn) 取 +0.7618 V 代入",
      "demo-op-step6-sign",
      "K1",
      hazard(
        "exp05-H17",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "锌电极是负极，电势符号取反使全部相对误差与结论作废",
          "E(电池) = E(正) − E(负) = 0.3419 −(−0.7618)；把锌电极电势记成正值，电池电动势只剩 0.34 V 上下，四个浓度点的相对误差全部失真。",
          "电极电势一律带符号代入：E°(Cu²⁺/Cu) = +0.3419 V、E°(Zn²⁺/Zn) = −0.7618 V，再按“正减负”算。",
          ["S001"],
        ),
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp05Definition: ExperimentDefinition = {
  id: "exp05",
  title: "氧化还原反应和电化学",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5, step6],
  createState: (): ExperimentState => ({
    expId: "exp05",
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

export default exp05Definition;
