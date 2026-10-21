/**
 * experiments/exp06/definition.ts —— 实验 06《配合物的生成和性质》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp06.md。本文件只导出数据，不含 IO / React / 随机数。
 * 规格原文是 8 步；按"5~6 步"的课程节奏合并为 6 步：
 * 1 准备与就位 → 2 配离子与简单离子的区别 → 3 铜氨配合物的生成（逐级配位）
 * → 4 配位平衡的移动（加酸可逆 / 加沉淀剂不可逆 / 加碱对照）
 * → 5 银氨配离子与稳定性的逐级比较 → 6 螯合物 + 数据记录与结论。
 * 每步 4~5 个选项，并至少保留 1 个 L3 教学陷阱；L4 在银氨步（exp06-H1），且不在最后一步。
 * 场景复用现有试管 / 烧杯 / 试剂瓶 / 通风橱素材，不新增 SVG。
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
  "fume-hood": { id: "fume-hood", kind: "stand", note: "通风橱（面风速 ≥0.5 m/s）：氨水与乙二胺只在此取用" },
  "tube-1": { id: "tube-1", kind: "tube", note: "1 号管（0.10 mol/L FeCl₃，黄棕）" },
  "tube-2": { id: "tube-2", kind: "tube", note: "2 号管（0.10 mol/L K₃[Fe(CN)₆]，黄绿）" },
  "tube-3": { id: "tube-3", kind: "tube", note: "3 号管（0.10 mol/L CuSO₄ 1.00 mL，浅蓝）" },
  "tube-4": { id: "tube-4", kind: "tube", note: "4 号管（深蓝液 0.50 mL，酸/碱对照）" },
  "tube-5": { id: "tube-5", kind: "tube", note: "5 号管（深蓝液 0.50 mL，沉淀剂对照）" },
  "tube-6": { id: "tube-6", kind: "tube", note: "6 号管（银氨体系：AgCl → AgBr → Ag₂S）" },
  "tube-7": { id: "tube-7", kind: "tube", note: "7 号管（备用）" },
  "tube-8": { id: "tube-8", kind: "tube", note: "8 号管（深蓝液 0.50 mL，螯合比较）" },
  "dropper-set": { id: "dropper-set", kind: "pipette", note: "6 支 1 mL 带刻度滴管（分度 0.05 mL，约 20 滴/mL），一试剂一管贴标" },
  "bottle-cuso4": { id: "bottle-cuso4", kind: "volumetric", note: "0.10 mol/L CuSO₄" },
  "bottle-agno3": { id: "bottle-agno3", kind: "volumetric", note: "0.10 mol/L AgNO₃（棕色瓶避光）" },
  "bottle-k3fecn6": { id: "bottle-k3fecn6", kind: "volumetric", note: "0.10 mol/L K₃[Fe(CN)₆]（棕色瓶避光，遇酸放 HCN）" },
  "bottle-nh3": { id: "bottle-nh3", kind: "volumetric", note: "6 mol/L 氨水（塑料瓶密封，通风橱内）" },
  "bottle-en": { id: "bottle-en", kind: "volumetric", note: "0.50 mol/L 乙二胺（通风橱内，避光密封）" },
  "bottle-h2so4": { id: "bottle-h2so4", kind: "volumetric", note: "3 mol/L H₂SO₄" },
  "bottle-hcl": { id: "bottle-hcl", kind: "volumetric", note: "3 mol/L HCl（步 6 破坏银氨用）" },
  "bottle-na2s": { id: "bottle-na2s", kind: "volumetric", note: "0.10 mol/L Na₂S（现配，通风橱内，遇酸放 H₂S）" },
  "bottle-na2s2o3": { id: "bottle-na2s2o3", kind: "volumetric", note: "0.50 mol/L Na₂S₂O₃（现配，避光）" },
  "wash-bottle": { id: "wash-bottle", kind: "wash", note: "500 mL 蒸馏水洗瓶" },
  "waste-bottle": { id: "waste-bottle", kind: "beaker", note: "含银重金属废液桶（Cu / Ag / Fe(CN)₆³⁻ 统统入桶）" },
  "organic-waste": { id: "organic-waste", kind: "beaker", note: "有机废液桶（乙二胺废液单列）" },
  "white-paper": { id: "white-paper", kind: "stand", note: "A4 白纸（比色背景）" },
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
const H4 = "连续犯同类错误 3 次：先停下复述这一步的规范（通风橱内开氨水 / 一试剂一滴管 / 逐滴加至恰好溶解 / 银氨不加热不过夜），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6，按 6 步合并）
 * ------------------------------------------------------------------ */

export const EXP06_STEP_DEMO_IDS: readonly string[] = [
  "exp06-step1-setup",
  "exp06-step2-ion-vs-complex",
  "exp06-step3-cu-ammonia",
  "exp06-step4-shift",
  "exp06-step5-silver-ammonia",
  "exp06-step6-chelate",
];

const step1: StepDefinition = {
  index: 0,
  title: "准备与就位（通风橱 · 编号 · 滴管校准）",
  scene: "实验台 + 通风橱 + 公用试剂架",
  demoId: "exp06-step1-setup",
  judge: {
    criterion: "编号唯一；氨水与乙二胺在通风橱内；滴管一一对应无混用；滴/mL 折算系数已实测",
    competency: ["A1", "S1"],
  },
  hints: {
    h0: "6 mol/L 氨水的上方蒸气里主要是什么？",
    h1: "敞口放置会持续逸出什么？",
    h2: "NH₃ 分压高、开盖即逸出；嗅辨只能用手背在远处轻扇，绝不俯身。",
    h3: "演示：氨水与乙二胺移入通风橱并开排风 → 一试剂一管贴标 → 实测滴管 1 mL 的滴数并记入原始记录。",
    h4: H4,
  },
  accepts: ["step1-wash", "step1-assemble", "step1-drop-rate", "step1-open-nh3"],
  choices: [
    correct(
      "step1-wash",
      "wash",
      "8 支试管用蒸馏水洗净、沥干，编号 1~8",
      "demo-op-step1-wash",
      "S1",
      { observation: { text: "8 支试管洗净沥干，管上部各带唯一编号 1~8" } },
    ),
    correct(
      "step1-assemble",
      "assemble",
      "把 6 mol/L 氨水与 0.50 mol/L 乙二胺移入通风橱并开排风；6 支滴管按“一试剂一管”贴标",
      "demo-op-step1-assemble",
      "A1",
      {
        requires: ["step1-wash"],
        observation: { text: "氨水与乙二胺在通风橱内就位、排风开启；6 支滴管一一对应贴标，无混用" },
      },
    ),
    correct(
      "step1-drop-rate",
      "readInstrument",
      "实测所用滴管 1 mL 的滴数（约 20 滴·mL⁻¹），记入原始记录",
      "demo-op-step1-drop-rate",
      "S1",
      {
        completesStep: true,
        requires: ["step1-wash", "step1-assemble"],
        ...P({ dropsPerMl: 20, volume: 1 }),
        observation: { text: "滴管折算系数实测为 20.0 滴·mL⁻¹（1 滴 ≈0.05 mL），已记入原始记录" },
        feedback: fb("info", "准备与就位完成：编号、通风橱、滴管贴标与折算系数均已就位", undefined, undefined, ["S004", "S007", "S015"]),
      },
    ),
    // 可恢复 trap 放最后：验收脚本点最后一个也不会踩到 L4（本步没有 L4）。
    trap(
      "step1-open-nh3",
      "observe",
      "在开放台面直接开 6 mol/L 氨水瓶盖取液，或俯身对管口闻气味",
      "demo-op-step1-open-nh3",
      "A1",
      hazard(
        "exp06-H2",
        "L3",
        9,
        "A1",
        fb(
          "danger",
          "敞口取氨水、俯身嗅闻：高浓度 NH₃ 直冲鼻腔与眼结膜",
          "为什么：氨水的 NH₃ 分压随浓度升高而急增，6 mol/L 敞口即持续逸出 NH₃；俯身闻使高浓度氨气直冲鼻腔与眼结膜，与黏膜水分生成强碱性的 NH₃·H₂O，流泪、剧烈咳嗽、咽喉灼痛。",
          "正确做法：全部氨水操作在通风橱内完成；嗅辨只能用手背在远处轻扇，绝不俯身。",
          ["S007"],
        ),
        { fx: "toxic-gas", incidentId: "exp06-H2" },
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "配离子与简单离子的区别",
  scene: "实验台 + 白纸比色背景",
  demoId: "exp06-step2-ion-vs-complex",
  judge: {
    criterion: "1 号管血红色、2 号管无血红色；两管颜色差异可辨并可写入记录",
    competency: ["K1"],
  },
  hints: {
    h0: "β[Fe(CN)₆]³⁻ 有多大？",
    h1: "游离 c(Fe³⁺) 还剩多少？",
    h2: "约 10⁻²⁰ mol/L 量级，远达不到 [Fe(SCN)]²⁺ 显色所需的浓度。",
    h3: "演示：1 号管 FeCl₃、2 号管 K₃[Fe(CN)₆] → 各加 2 滴 KSCN 摇匀 → 对比记录两管颜色。",
    h4: H4,
  },
  accepts: ["step2-transfer", "step2-kscn", "step2-observe", "step2-one-dropper"],
  choices: [
    correct(
      "step2-transfer",
      "transfer",
      "1 号管取 0.10 mol/L FeCl₃、2 号管取 0.10 mol/L K₃[Fe(CN)₆]，各 1.00 mL",
      "demo-op-step2-transfer",
      "K1",
      {
        ...P({ volume: 1 }),
        observation: { text: "1 号管黄棕（FeCl₃）、2 号管黄绿（K₃[Fe(CN)₆]），两管外观相近" },
      },
    ),
    correct(
      "step2-kscn",
      "addDrops",
      "两管各加 2 滴 0.10 mol/L KSCN 并摇匀",
      "demo-op-step2-kscn",
      "K1",
      {
        requires: ["step2-transfer"],
        ...P({ drops: 2, concentration: 0.1 }),
        observation: { text: "两管各加 2 滴 KSCN 后摇匀" },
      },
    ),
    correct(
      "step2-observe",
      "observe",
      "1 号管立即血红色（[Fe(SCN)]²⁺），2 号管仍黄绿、无血红色",
      "demo-op-step2-observe",
      "K1",
      {
        completesStep: true,
        requires: ["step2-transfer", "step2-kscn"],
        observation: { text: "1 号管立即血红色（游离 Fe³⁺ 与 SCN⁻ 配位生成 [Fe(SCN)]²⁺）；2 号管仍黄绿、无血红色（Fe³⁺ 已被 CN⁻ 强配位，游离 c(Fe³⁺) 极低）" },
        entityPatch: { "tube-1": { liquid: { substance: "[Fe(SCN)]²⁺", level: 1, color: "#b3121b", opacity: 0.9 } } },
        feedback: fb("info", "两管对比成立：配离子里的 Fe³⁺ 已“拿不出来”，故不显血红色", undefined, undefined, ["S015"]),
      },
    ),
    // 可恢复 trap 放最后：交叉污染只作废现象，不终止实验。
    trap(
      "step2-one-dropper",
      "addDrops",
      "同一支滴管先取 KSCN 再取 K₃[Fe(CN)₆]（或反向），造成交叉污染",
      "demo-op-step2-one-dropper",
      "K1",
      hazard(
        "exp06-H10",
        "L1",
        2,
        "K1",
        fb(
          "warn",
          "一支滴管两用：两管现象互相污染，结论偏差",
          "为什么：滴管内残液把 SCN⁻ 带入 2 号管、或把 Fe(CN)₆³⁻ 带入 1 号管，两管现象互相污染；2 号管出现淡红色，被误判为“配离子也显色”。",
          "正确做法：一试剂一滴管并贴标；取液前先确认标签。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "铜氨配合物的生成（逐级配位）",
  scene: "实验台 + 通风橱",
  demoId: "exp06-step3-cu-ammonia",
  judge: {
    criterion: "“先出沉淀、后溶解”两个阶段均被观察到；终态深蓝澄清；耗量在 0.2~0.6 mL",
    competency: ["K1", "S1"],
    tolerance: { paramKey: "volume", expected: 0.35, unit: "mL", tolerance: 0.15 },
  },
  hints: {
    h0: "一开始生成的蓝色沉淀是什么？",
    h1: "继续加氨为什么又溶了？",
    h2: "Cu(OH)₂ + 4NH₃ ⇌ [Cu(NH₃)₄]²⁺ + 2OH⁻，β₄ 大，氨过量即右移。",
    h3: "演示：3 号管取 1.00 mL CuSO₄ → 逐滴加 6 mol/L 氨水、每 2 滴摇匀 → 沉淀恰好消失 → 读刻度以 mL 记录耗量。",
    h4: H4,
  },
  accepts: ["step3-transfer", "step3-add-ammonia", "step3-read-volume", "step3-one-shot", "step3-dilute-ammonia"],
  choices: [
    correct(
      "step3-transfer",
      "transfer",
      "3 号管取 0.10 mol/L CuSO₄ 1.00 mL（浅蓝）",
      "demo-op-step3-transfer",
      "S1",
      {
        ...P({ volume: 1, concentration: 0.1 }),
        observation: { text: "3 号管取 0.10 mol/L CuSO₄ 1.00 mL，溶液浅蓝" },
      },
    ),
    correct(
      "step3-add-ammonia",
      "addDrops",
      "逐滴加 6 mol/L 氨水、每 2 滴摇匀：先出现浅蓝色碱式盐沉淀（约 2~3 滴），继续滴至沉淀恰好消失，得深蓝 [Cu(NH₃)₄]²⁺",
      "demo-op-step3-add-ammonia",
      "K1",
      {
        requires: ["step3-transfer"],
        ...P({ volume: 0.35, concentration: 6, drops: 7 }),
        observation: { text: "先出现浅蓝色碱式盐沉淀（约 2~3 滴），继续滴加至沉淀恰好消失，累计约 0.2~0.6 mL，得深蓝色 [Cu(NH₃)₄]²⁺" },
        entityPatch: {
          "tube-3": { liquid: { substance: "[Cu(NH₃)₄]²⁺", level: 1, color: "#0b2f9e", opacity: 0.85 } },
        },
      },
    ),
    correct(
      "step3-read-volume",
      "readInstrument",
      "读滴管刻度，以 mL 记录总耗量（0.2~0.6 mL，3 位有效数字），滴数仅作辅助记录",
      "demo-op-step3-read-volume",
      "S1",
      {
        completesStep: true,
        requires: ["step3-transfer", "step3-add-ammonia"],
        ...P({ volume: 0.35, volumeRead: 0.35 }),
        observation: { text: "氨水累计耗量 0.35 mL（7 滴），3 位有效数字，已记入原始记录" },
        entityPatch: { "tube-3": { note: "深蓝 [Cu(NH₃)₄]²⁺，氨水累计 0.35 mL" } },
        feedback: fb("info", "铜氨配合物生成完成：先沉淀后溶解，终态深蓝澄清，耗量已按 mL 记录", undefined, undefined, ["S015"]),
      },
    ),
    trap(
      "step3-one-shot",
      "addDrops",
      "一次倒入 3.00 mL 6 mol/L 氨水，未逐滴加入",
      "demo-op-step3-one-shot",
      "K1",
      hazard(
        "exp06-H5",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "一次倒足氨水：“先沉淀后溶解”的中间态被跳过",
          "为什么：局部 NH₃ 立即大幅过量，碱式盐沉淀刚生成就被配位溶解，“先沉淀后溶解”的中间态被跳过；关键现象未观察到，本组“配离子生成”的过程记录只能记终态颜色。",
          "正确做法：逐滴加入、每 2 滴摇匀，先记录首现沉淀的滴数，再记录恰好溶解的耗量。",
          ["S015"],
        ),
      ),
    ),
    // 可恢复 trap 放最后：稀氨水只作废现象与结论，不终止实验。
    trap(
      "step3-dilute-ammonia",
      "addDrops",
      "改用 0.10 mol/L 稀氨水代替 6 mol/L 氨水",
      "demo-op-step3-dilute-ammonia",
      "K1",
      hazard(
        "exp06-H6",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "稀氨水浓度不足：沉淀溶不完，误得“Cu(OH)₂ 不溶于氨水”",
          "为什么：配位溶解 K = Ksp(Cu(OH)₂)·β₄ ≈ 5.6×10⁻²⁰ × 2.1×10¹³ ≈ 1.2×10⁻⁶，需维持游离 [NH₃] ≈ 0.5 mol/L 才能溶完；稀氨水即使大量加入也达不到该浓度，与教材相反。",
          "正确做法：用 6 mol/L 氨水，逐滴加至沉淀恰好消失。",
          [],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "配位平衡的移动（加酸 / 加碱 / 加沉淀剂）",
  scene: "实验台 + 通风橱",
  demoId: "exp06-step4-shift",
  judge: {
    criterion: "4 号管“变浅→复蓝”可逆可复现；5 号管黑色沉淀不溶于稀硫酸；加碱不生成沉淀；三组现象分别记录",
    competency: ["K2", "S1"],
  },
  hints: {
    h0: "加 H⁺ 后 NH₃ 变成了什么？",
    h1: "配位平衡往哪边移？",
    h2: "生成 NH₄⁺，游离 [NH₃] 骤降，[Cu(NH₃)₄]²⁺ 解离；而 S²⁻ 生成 Ksp 极小的 CuS，Cu²⁺ 被抽干，不可逆。",
    h3: "演示：4 号管逐滴 3 mol/L H₂SO₄ 至变浅→补 6 mol/L 氨水复蓝；5 号管滴 Na₂S 至黑色 CuS→加酸不溶；另取深蓝液滴 NaOH 无沉淀。",
    h4: H4,
  },
  accepts: ["step4-acid", "step4-sulfide", "step4-alkali", "step4-conc-acid", "step4-order"],
  choices: [
    correct(
      "step4-acid",
      "addDrops",
      "4 号管逐滴加 3 mol/L H₂SO₄ 至蓝色明显变浅，记录滴数；再逐滴补 6 mol/L 氨水至深蓝恢复",
      "demo-op-step4-acid",
      "K2",
      {
        ...P({ volume: 0.6, concentration: 3, restoreVolume: 0.7 }),
        observation: { text: "4 号管加 3 mol/L H₂SO₄ 后蓝色明显变浅（H⁺ 夺走 NH₃，平衡左移、Cu²⁺ 释放）；再补 6 mol/L 氨水后深蓝恢复——酸碱-配位耦合可逆" },
      },
    ),
    correct(
      "step4-sulfide",
      "addDrops",
      "5 号管逐滴加 0.10 mol/L Na₂S 至沉淀完全（约 5~8 滴）→ 黑色 CuS；再滴 3 mol/L H₂SO₄ 不溶解",
      "demo-op-step4-sulfide",
      "K2",
      {
        ...P({ drops: 7, concentration: 0.1 }),
        observation: { text: "5 号管出现黑色 CuS 沉淀；再加 3 mol/L H₂SO₄ 不溶解——沉淀-配位耦合不可逆" },
        entityPatch: { "tube-5": { precipitate: { substance: "CuS", amount: 1, color: "#111111" } } },
      },
    ),
    correct(
      "step4-alkali",
      "addDrops",
      "另取深蓝液滴加 6 mol/L NaOH：不生成 Cu(OH)₂ 沉淀（游离 c(Cu²⁺) 约 10⁻¹⁶ mol/L）",
      "demo-op-step4-alkali",
      "K2",
      {
        completesStep: true,
        requires: ["step4-acid", "step4-sulfide"],
        ...P({ drops: 3, concentration: 6 }),
        observation: { text: "向深蓝液滴加 6 mol/L NaOH 不生成 Cu(OH)₂ 沉淀：Cu²⁺ 已被 NH₃ 配位，游离 c(Cu²⁺) 约 10⁻¹⁶ mol/L" },
        feedback: fb("info", "三组扰动对照完成：加酸可逆、加沉淀剂不可逆、加碱不生成沉淀", undefined, undefined, ["S012", "S015"]),
      },
    ),
    trap(
      "step4-conc-acid",
      "addDrops",
      "用 18 mol/L 浓 H₂SO₄ 代替 3 mol/L 稀硫酸去“酸化”深蓝液",
      "demo-op-step4-conc-acid",
      "K2",
      hazard(
        "exp06-H4",
        "L3",
        9,
        "K2",
        fb(
          "danger",
          "浓硫酸入氨性液：局部沸腾，酸液与 NH₃ 从管口喷出",
          "为什么：浓硫酸与溶液中的水、游离 NH₃ 同时发生强放热反应（稀释热约 880 J·g⁻¹ 酸，中和热另计），局部瞬间升温沸腾，NH₃ 骤然大量逸出并带出液滴，造成面部与手部化学灼伤、吸入性损伤。",
          "正确做法：只用 3 mol/L H₂SO₄，沿管壁逐滴加入并摇匀；浓酸由教师在通风橱内统一稀释。",
          ["S012", "S015"],
        ),
        { fx: "burn", incidentId: "exp06-H4" },
      ),
    ),
    // 可恢复 trap 放最后：只是结论片面，原始数据仍有效。
    trap(
      "step4-order",
      "addDrops",
      "5 号管先加 Na₂S 再加酸，见“不溶”就断言“配位平衡都不可逆”",
      "demo-op-step4-order",
      "K2",
      hazard(
        "exp06-H11",
        "L1",
        3,
        "K2",
        fb(
          "warn",
          "把两类扰动混为一谈：对配位平衡的可逆性给出片面结论",
          "为什么：把“被 Ksp 极小的沉淀夺走中心离子”与“被 H⁺ 夺走配体”两类不同扰动混为一谈，前者不可逆、后者可逆；结论片面，分析题失分，但原始数据本身仍有效。",
          "正确做法：4 号管做酸的可逆对照（变浅→复蓝），5 号管单独记“CuS 不溶于稀酸”。",
          [],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "银氨配离子与稳定性的逐级比较",
  scene: "通风橱 + 实验台（银氨现配现用）",
  demoId: "exp06-step5-silver-ammonia",
  judge: {
    criterion: "“淡黄↓ → 溶解 → 黑色↓”三段现象齐全；银氨溶液当日加稀盐酸破坏后入含银废液桶",
    competency: ["K2", "S1", "A1"],
    tolerance: { paramKey: "volume", expected: 0.3, unit: "mL", tolerance: 0.2 },
  },
  hints: {
    h0: "银氨溶液里 Ag 以什么形式存在？",
    h1: "加热蒸干后剩下的固体是什么？",
    h2: "久置或浓缩会析出氮化银 Ag₃N（“雷银”），受摩擦或受热即爆炸。",
    h3: "演示：AgNO₃ 0.50 mL + NaCl 至沉淀完全 → 6 mol/L 氨水逐滴至 AgCl 恰好溶解 → 2 滴 KBr 淡黄 → Na₂S₂O₃ 溶解 → 2 滴 Na₂S 黑色不溶。",
    h4: H4,
  },
  accepts: ["step5-agcl", "step5-dissolve", "step5-three-stage", "step5-heat-dry", "step5-order"],
  choices: [
    correct(
      "step5-agcl",
      "transfer",
      "6 号管取 0.10 mol/L AgNO₃ 0.50 mL，滴加 0.10 mol/L NaCl 至沉淀完全，取上清液回检不再浑浊",
      "demo-op-step5-agcl",
      "S1",
      {
        ...P({ volume: 0.5, concentration: 0.1 }),
        observation: { text: "6 号管制得白色 AgCl 沉淀；上清液回检不再浑浊" },
        entityPatch: { "tube-6": { precipitate: { substance: "AgCl", amount: 1, color: "#f2f2f2" } } },
      },
    ),
    correct(
      "step5-dissolve",
      "addDrops",
      "在通风橱内逐滴加 6 mol/L 氨水至 AgCl 恰好溶解（约 0.2~0.5 mL），得 [Ag(NH₃)₂]⁺",
      "demo-op-step5-dissolve",
      "S1",
      {
        requires: ["step5-agcl"],
        ...P({ volume: 0.25, concentration: 6 }),
        observation: { text: "6 mol/L 氨水逐滴加至 AgCl 恰好溶解（约 0.2~0.5 mL），得 [Ag(NH₃)₂]⁺，溶液澄清" },
        entityPatch: { "tube-6": { note: "[Ag(NH₃)₂]⁺ 溶液（当日现配，绝不加热、不过夜）" } },
      },
    ),
    correct(
      "step5-three-stage",
      "addDrops",
      "加 2 滴 0.10 mol/L KBr → 淡黄 AgBr↓；逐滴加 0.50 mol/L Na₂S₂O₃ 至恰好溶解；再滴 2 滴 0.10 mol/L Na₂S → 黑色 Ag₂S↓（不溶）",
      "demo-op-step5-three-stage",
      "K2",
      {
        completesStep: true,
        requires: ["step5-agcl", "step5-dissolve"],
        ...P({ drops: 2, concentration: 0.5 }),
        observation: { text: "三段现象齐全：加 KBr 得淡黄 AgBr↓ → 加 Na₂S₂O₃ 后沉淀恰好溶解、溶液澄清 → 加 Na₂S 得黑色 Ag₂S↓ 不再溶解" },
        entityPatch: { "tube-6": { precipitate: { substance: "Ag₂S", amount: 1, color: "#0e0e0e" } } },
        feedback: fb("info", "银氨逐级比较完成：淡黄↓ → 溶解 → 黑色↓，K = Ksp·β 决定每一步能否右移", undefined, undefined, ["S007", "S035"]),
      },
    ),
    // L4 唯一入口，放在倒数第二项（非最后位置）：末项留给可恢复 trap。
    trap(
      "step5-heat-dry",
      "heat",
      "把银氨溶液加热浓缩或蒸干，以“观察晶体 / 加快溶解”",
      "demo-op-step5-heat-dry",
      "A1",
      hazard(
        "exp06-H1",
        "L4",
        20,
        "A1",
        fb(
          "danger",
          "银氨溶液受热浓缩析出 Ag₃N（“雷银”），猛烈爆炸，本次实验终止",
          "为什么：[Ag(NH₃)₂]⁺ 在受热、浓缩或久置时分解，析出氮化银 Ag₃N（俗称“雷银”）；N³⁻ 在 Ag₃N 晶格中处于高度不稳定的蓄能状态，受摩擦、震动或受热即发生猛烈爆炸分解（2Ag₃N → 6Ag + N₂↑），试管炸碎、玻璃碎片与含银液飞溅。",
          "正确做法：银氨溶液现配现用，只在水浴或室温下操作，绝不加热、绝不过夜；实验结束立即加 3 mol/L HCl 破坏。",
          ["S007", "S035"],
        ),
        { fx: "explosion", incidentId: "exp06-H1", terminate: true },
      ),
    ),
    // 可恢复 trap 放最后：顺序颠倒只作废本步现象，不终止实验。
    trap(
      "step5-order",
      "addDrops",
      "先加 Na₂S₂O₃ 再滴 KBr（顺序颠倒，AgBr 来不及析出）",
      "demo-op-step5-order",
      "K2",
      hazard(
        "exp06-H7",
        "L2",
        5,
        "K2",
        fb(
          "warn",
          "顺序颠倒：AgBr 根本不析出，“配位→沉淀→再配位”链条断在第一环",
          "为什么：S₂O₃²⁻ 先与 [Ag(NH₃)₂]⁺ 生成更稳定的 [Ag(S₂O₃)₂]³⁻，游离 c(Ag⁺) 进一步下降，此时再加 Br⁻ 达不到 Ksp(AgBr)，AgBr 根本不析出，本步全部现象作废。",
          "正确做法：严格按 AgCl → 氨溶 → KBr 析出 AgBr → S₂O₃²⁻ 溶解 → Na₂S 出 Ag₂S 的顺序操作。",
          [],
        ),
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "螯合物稳定性比较与数据、废液",
  scene: "通风橱 + 实验台 + 废液桶",
  demoId: "exp06-step6-chelate",
  judge: {
    criterion: "深蓝→紫蓝；补氨不回蓝；K 算得约 10⁶ 量级；银氨已加酸破坏、废液分类正确",
    competency: ["S2", "K1", "A1"],
    tolerance: { paramKey: "volume", expected: 0.25, unit: "mL", tolerance: 0.15 },
  },
  hints: {
    h0: "en 是几齿配体？",
    h1: "一个 en 占几个配位位、成环后熵变如何？",
    h2: "双齿成五元环，释放更多配位水，ΔS 更有利，故 β 更大（螯合效应）。",
    h3: "演示：深蓝液逐滴加乙二胺至紫蓝 → 补过量氨水颜色不变 → 算 K ≈1.9×10⁶ → 银氨残液加 HCl 破坏后入含银废液桶。",
    h4: H4,
  },
  accepts: ["step6-en", "step6-reverse", "step6-compute", "step6-waste", "step6-overnight"],
  choices: [
    correct(
      "step6-en",
      "addDrops",
      "8 号管取步 3 深蓝液 0.50 mL，逐滴加 0.50 mol/L 乙二胺、每滴摇匀，深蓝转紫蓝（约 3~8 滴），生成 [Cu(en)₂]²⁺",
      "demo-op-step6-en",
      "S2",
      {
        ...P({ volume: 0.25, concentration: 0.5, drops: 5 }),
        observation: { text: "逐滴加 0.50 mol/L 乙二胺、每滴摇匀，颜色由深蓝转紫蓝（约 3~8 滴，累计 0.25 mL），生成 [Cu(en)₂]²⁺" },
        entityPatch: { "tube-8": { liquid: { substance: "[Cu(en)₂]²⁺", level: 1, color: "#5b2b9e", opacity: 0.85 } } },
      },
    ),
    correct(
      "step6-reverse",
      "addDrops",
      "反向验证：向紫蓝液加过量 6 mol/L 氨水，颜色不变",
      "demo-op-step6-reverse",
      "S2",
      {
        requires: ["step6-en"],
        ...P({ volume: 0.5, concentration: 6 }),
        observation: { text: "向紫蓝液补加过量 6 mol/L 氨水，颜色不变——螯合物不被 NH₃ 取代" },
      },
    ),
    correct(
      "step6-compute",
      "compute",
      "算 K = β₂[Cu(en)₂]²⁺ / β₄[Cu(NH₃)₄]²⁺ ≈ 4.0×10¹⁹ / 2.1×10¹³ ≈ 1.9×10⁶，并汇总各步耗量（mL，3 位有效数字）",
      "demo-op-step6-compute",
      "K1",
      {
        requires: ["step6-en", "step6-reverse"],
        observation: { text: "K = 4.0×10¹⁹ / 2.1×10¹³ ≈ 1.9×10⁶（螯合取代几乎完全）；各步耗量均以 mL 记录、3 位有效数字" },
      },
    ),
    correct(
      "step6-waste",
      "transfer",
      "银氨残液先加 3 mol/L HCl 至不再生成沉淀（破坏银氨），再连同含 Cu²⁺、Fe(CN)₆³⁻ 的废液转入含银重金属废液桶；乙二胺废液单列有机废液",
      "demo-op-step6-waste",
      "A1",
      {
        completesStep: true,
        requires: ["step6-en", "step6-reverse", "step6-compute"],
        observation: { text: "银氨残液已加 3 mol/L HCl 破坏；含 Cu²⁺、Ag⁺、Fe(CN)₆³⁻ 废液入含银重金属废液桶，乙二胺废液单列有机废液" },
        entityPatch: { "tube-6": { note: "银氨已用 3 mol/L HCl 破坏，残液入含银重金属废液桶" } },
        feedback: fb("info", "螯合比较与数据、废液处置完成：K ≈1.9×10⁶，银氨当日破坏、废液分类入桶", undefined, undefined, ["S004", "S007", "S011", "S035"]),
      },
    ),
    // 可恢复 trap 放最后：留过夜/倒水槽只记违规，不终止实验。
    trap(
      "step6-overnight",
      "transfer",
      "银氨残液留在管内过夜，或直接倒入水槽",
      "demo-op-step6-overnight",
      "A1",
      hazard(
        "exp06-H3",
        "L3",
        9,
        "A1",
        fb(
          "danger",
          "银氨残液过夜或入下水：污染物与爆炸物一起留在开放环境",
          "为什么：Ag⁺ 对水生生物剧毒（μg/L 级即有害），且银氨溶液久置会析出爆炸性 Ag₃N，把“污染物”与“爆炸物”一起留在了开放环境；残液干涸后管内 Ag₃N 在后续清洗、敲击时可能引爆。",
          "正确做法：当日加稀盐酸破坏银氨（生成 AgCl 沉淀、消除爆炸性），沉淀与滤液一并入含银重金属废液桶。",
          ["S011", "S035"],
        ),
        { fx: "heavy-metal", incidentId: "exp06-H3" },
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp06Definition: ExperimentDefinition = {
  id: "exp06",
  title: "配合物的生成和性质",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5, step6],
  createState: (): ExperimentState => ({
    expId: "exp06",
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

export default exp06Definition;
