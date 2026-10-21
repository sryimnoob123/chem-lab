/**
 * experiments/exp10/definition.ts —— 实验 10《盐酸标准溶液的标定与工业纯碱总碱度的测定》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp10.md。本文件只导出**数据**（含纯工厂 createState），不含 IO / React / 随机数。
 * 所有文案、数值、判据均取自规格 §6 / §7 / §8 / §9，不新编化学解释。
 *
 * 规格 §6 是 8 步；按"5~6 步"的课程节奏合并为 6 步（映射关系）：
 * 1 基准物准备/称量/溶解   ← §6 步 2 + 步 3（称量 → 溶解 → 甲基橙）
 * 2 检漏/装液/排气泡/调零   ← §6 步 1 的滴定管准备 + 步 4 的装液调零
 * 3 标定滴定至近终点/煮沸   ← §6 步 4（快滴—慢滴—半滴 → 煮沸驱 CO₂ → 冷却续滴）
 * 4 判终点与读数           ← §6 步 4 的读数段 + §7 H12
 * 5 平行测定与双指示剂数据   ← §6 步 2/4 的平行要求 + 步 6 + 步 7
 * 6 计算 c(HCl) 与总碱度/校核 ← §6 步 5 + 步 8
 *
 * 事故 id 说明：
 * - 与 §7 逐条对齐的：H3 / H6 / H7 / H8 / H9 / H11 / H12 / H14 / H15 / H16；
 * - H5 在 §7 记为 L3（未涂脂渗漏）。本定义把它作为**唯一的 L4 终止项**：活塞干涩硬拧 → 磨口崩裂、
 *   酸液泄出。原因是 6 步合并后不含"配近似 HCl"那一步，H1/H2 两个原 L4 失去入口（§12 待核 #2 已注明）；
 * - H17 为合并步骤后新增的一条（尖嘴气泡未排尽就调零），场景与解析见 §9 后测 3，不属于新化学解释。
 *
 * 结构约定：每步最后一个正确动作 completesStep: true；可恢复陷阱一律排在选项列表最后一项，
 * 保证验收脚本"点最后一项"不会踩到 L4。
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
  "balance-1": { id: "balance-1", kind: "balance", reading: 0, note: "分析天平 200 g / 0.1 mg（分度 0.0001 g）" },
  "desiccator-1": {
    id: "desiccator-1",
    kind: "stand",
    note: "干燥器（内装变色硅胶），存已干燥的无水 Na₂CO₃",
  },
  "weighing-bottle": { id: "weighing-bottle", kind: "volumetric", note: "扁形称量瓶 40×25 mm（基准物）" },
  "burette-acid-1": {
    id: "burette-acid-1",
    kind: "burette",
    note: "酸式滴定管 50 mL，分度 0.1 mL，估读 0.01 mL",
  },
  "burette-acid-2": { id: "burette-acid-2", kind: "burette", note: "2 号酸式滴定管（纯碱滴定用）" },
  "stand-1": { id: "stand-1", kind: "stand", note: "铁架台 + 滴定管夹" },
  "flask-1": { id: "flask-1", kind: "flask", note: "1 号锥形瓶 250 mL（标定，已编号）" },
  "flask-2": { id: "flask-2", kind: "flask", note: "2 号锥形瓶 250 mL（标定，已编号）" },
  "flask-3": { id: "flask-3", kind: "flask", note: "3 号锥形瓶 250 mL（标定，已编号）" },
  "flask-4": { id: "flask-4", kind: "flask", note: "4 号锥形瓶 250 mL（双指示剂滴定）" },
  "flask-5": { id: "flask-5", kind: "flask", note: "5 号锥形瓶 250 mL（双指示剂滴定）" },
  "flask-6": { id: "flask-6", kind: "flask", note: "6 号锥形瓶 250 mL（双指示剂滴定）" },
  "volumetric-1000": { id: "volumetric-1000", kind: "volumetric", note: "1000 mL 容量瓶（近似 HCl）" },
  "volumetric-250": { id: "volumetric-250", kind: "volumetric", note: "250 mL 容量瓶（纯碱试液，定容至 250.0 mL）" },
  "pipette-25": { id: "pipette-25", kind: "pipette", note: "25.00 mL 单标线移液管，A 级，±0.03 mL" },
  "cylinder-10": { id: "cylinder-10", kind: "cylinder", note: "10 mL 量筒，0.1 mL 分度" },
  "wash-bottle": { id: "wash-bottle", kind: "wash", note: "蒸馏水洗瓶 500 mL" },
  "hotplate-1": { id: "hotplate-1", kind: "lamp", note: "可调温电热板 + 石棉网" },
  "white-plate": { id: "white-plate", kind: "stand", note: "白瓷板（终点衬底比色）" },
  "indicator-methyl-orange": {
    id: "indicator-methyl-orange",
    kind: "volumetric",
    note: "0.1% 甲基橙指示剂滴瓶（pH 3.1~4.4，黄→橙）",
  },
  "indicator-phenolphthalein": {
    id: "indicator-phenolphthalein",
    kind: "volumetric",
    note: "0.2% 酚酞指示剂滴瓶（pH 8.2~10.0，红→无色）",
  },
  "waste-bottle": { id: "waste-bottle", kind: "beaker", note: "废液桶（含酸碱与指示剂残液）" },
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
 * 构造小工具（与 exp04 / exp09 同构，只拼数据）
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

const H4 =
  "连续犯同类错误 3 次：先停下复述这一步的规范（干燥器中冷至室温再称 / 涂脂试漏再装液 / 先快后慢半滴收尾 / 平视估读两位小数 / 至少 3 份平行 / 先写公式再代数），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6 合并为 6 步）
 * ------------------------------------------------------------------ */

export const EXP10_STEP_DEMO_IDS: readonly string[] = [
  "exp10-step1-weigh",
  "exp10-step2-fill",
  "exp10-step3-titrate-standardize",
  "exp10-step4-read",
  "exp10-step5-parallel",
  "exp10-step6-compute-alkalinity",
];

const step1: StepDefinition = {
  index: 0,
  title: "基准物准备、差减法称量与溶解",
  scene: "干燥器 + 分析天平台",
  demoId: "exp10-step1-weigh",
  judge: {
    criterion: "3 份均 0.14~0.16 g、记录到 0.0001 g、瓶编号与 m 一一对应；甲基橙 2 滴、溶液黄色澄清",
    competency: ["S1"],
    tolerance: { paramKey: "mass", expected: 0.15, unit: "g", tolerance: 0.01 },
  },
  hints: {
    h0: "基准物状态没确认对，后面 3 份 m 全都不可信。",
    h1: "基准物为什么必须干燥并冷却到室温？",
    h2: "高亮干燥器与变色硅胶：瓶盖随开随盖，差减法称 0.14~0.16 g，记到 0.0001 g。",
    h3: "演示 干燥器中取瓶→确认已冷至室温、硅胶未变色→差减法称 3 份→加 50 mL 水溶解→2 滴甲基橙呈黄色。",
    h4: H4,
  },
  accepts: ["step1-check", "step1-weigh", "step1-dissolve", "step1-not-dry", "step1-phenolphthalein"],
  choices: [
    correct(
      "step1-check",
      "observe",
      "从干燥器取出称量瓶：确认已冷至室温、变色硅胶未变色，瓶盖随开随盖",
      "demo-op-step1-check",
      "S1",
      { observation: { text: "称量瓶来自干燥器，已冷至室温，硅胶未变色，未吸湿" } },
    ),
    correct(
      "step1-weigh",
      "weigh",
      "分析天平差减法称 3 份无水 Na₂CO₃ 0.14~0.16 g，逐份记 m₁~m₃ 至 0.0001 g",
      "demo-op-step1-weigh",
      "S1",
      {
        ...P({ mass: 0.15, trials: 3, precision: 0.0001 }),
        observation: { text: "差减法称得 m₁=0.1500 g、m₂=0.1498 g、m₃=0.1502 g，均落在 0.14~0.16 g", value: 0.15 },
        entityPatch: { "balance-1": { reading: 0.15 }, "flask-1": { note: "已称入 0.1500 g 无水 Na₂CO₃" } },
      },
    ),
    correct(
      "step1-dissolve",
      "dissolve",
      "各加约 50 mL 蒸馏水轻摇至完全溶解，加 2 滴 0.1% 甲基橙，溶液呈黄色",
      "demo-op-step1-dissolve",
      "S1",
      {
        completesStep: true,
        requires: ["step1-check", "step1-weigh"],
        ...P({ volume: 50, drops: 2, indicator: "methyl-orange" }),
        observation: { text: "基准物全溶、溶液澄清；加 2 滴甲基橙后呈黄色", value: 2 },
        entityPatch: {
          "flask-1": {
            liquid: { substance: "Na₂CO₃(aq)", level: 50, color: "#f4e7a8", opacity: 0.3 },
            note: "已溶解 + 2 滴甲基橙（黄色）",
          },
        },
        feedback: fb(
          "info",
          "基准物处理完成：干燥器中冷至室温、差减法称 3 份、甲基橙 2 滴呈黄色",
          undefined,
          undefined,
          ["S019", "S015"],
        ),
      },
    ),
    trap(
      "step1-not-dry",
      "observe",
      "基准物图省事：未干燥或从烘箱取出没冷却就称，称完瓶盖不盖回",
      "demo-op-step1-not-dry",
      "S1",
      hazard(
        "exp10-H6",
        "L3",
        8,
        "S1",
        fb(
          "danger",
          "基准物未恒重就称量：m 偏大且一路漂移，c(HCl) 系统性偏高",
          "为什么：无水 Na₂CO₃ 吸湿性强，瓶盖不随开随盖、徒手抓内壁都会吸湿；热物体在秤盘上方形成对流，天平示值持续漂移、读数不可复现。",
          "正确做法：270~300 ℃ 干燥 1 h 后移入干燥器冷至室温再称；瓶盖随开随盖，用牛角勺或直接以称量瓶转移，不徒手抓内壁。",
          ["S019", "S022"],
        ),
      ),
    ),
    // 可恢复 trap 放最后：验收脚本点最后一项不会踩到 L4。
    trap(
      "step1-phenolphthalein",
      "addDrops",
      "标定改用酚酞作指示剂（或甲基橙、酚酞两种一起加）",
      "demo-op-step1-phenolphthalein",
      "S1",
      hazard(
        "exp10-H8",
        "L2",
        5,
        "S1",
        fb(
          "warn",
          "酚酞只中和到 HCO₃⁻，却仍按“中和完全”算 c，结果虚高约一倍",
          "为什么：酚酞变色于 pH 8.2~10.0，此时 CO₃²⁻ 只被中和到 HCO₃⁻、只中和了一半，而 c=2m/(M·V) 仍按碳酸根被完全中和计算。",
          "正确做法：标定一律用甲基橙 2 滴、滴至黄变橙；酚酞只留给双指示剂法的第一终点。",
          ["S005", "S015"],
        ),
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "滴定管检漏、装液、排气泡与调零",
  scene: "滴定台 + 铁架台",
  demoId: "exp10-step2-fill",
  judge: {
    criterion: "活塞涂脂且试漏 2 min 不漏；尖嘴气泡排尽；初读数调至 0.00 mL 并估读到 0.01 mL",
    competency: ["S1", "S2"],
    tolerance: { paramKey: "initialReading", expected: 0, unit: "mL", tolerance: 0.01 },
  },
  hints: {
    h0: "装液这一步出问题，整轮 V 都不可信。",
    h1: "活塞发涩说明什么？气气泡占了谁的体积？",
    h2: "高亮活塞磨口与尖嘴：薄涂凡士林、试漏 2 min；装至零刻度上方，管尖朝下放液冲气泡。",
    h3: "演示 涂脂→试漏 2 min→待装液润洗 3 次→装液排气泡→调至 0.00 mL 平视读数。",
    h4: H4,
  },
  accepts: ["step2-leak", "step2-rinse-fill", "step2-zero", "step2-piston-force", "step2-bubble"],
  choices: [
    correct(
      "step2-leak",
      "assemble",
      "活塞薄涂凡士林，装蒸馏水试漏 2 min，确认活塞与管尖均不渗漏",
      "demo-op-step2-leak",
      "S1",
      { observation: { text: "活塞涂脂后试漏 2 min 无渗漏，滴定管垂直夹于铁架台" } },
    ),
    correct(
      "step2-rinse-fill",
      "titrate",
      "用待装 HCl 溶液润洗 3 次后装至零刻度上方，管尖朝下快速放液冲出尖嘴气泡",
      "demo-op-step2-rinse-fill",
      "S1",
      {
        ...P({ rinseTimes: 3 }),
        observation: { text: "滴定管润洗 3 次后装液，尖嘴气泡已排尽，液面在零刻度上方" },
        entityPatch: {
          "burette-acid-1": {
            liquid: { substance: "HCl(aq)", level: 50, color: "#e7f0f8", opacity: 0.3 },
            bubbles: false,
            note: "已装 HCl 标准液，气泡排尽",
          },
        },
      },
    ),
    correct(
      "step2-zero",
      "readInstrument",
      "调液面至 0.00 mL，视线与凹液面最低点相平，估读到 0.01 mL 记初读数",
      "demo-op-step2-zero",
      "S2",
      {
        completesStep: true,
        requires: ["step2-leak", "step2-rinse-fill"],
        ...P({ initialReading: 0 }),
        observation: { text: "初读数 0.00 mL（估读到 0.01 mL、记两位小数）", value: 0 },
        entityPatch: { "burette-acid-1": { reading: 0, note: "液面已调至 0.00 mL" } },
        feedback: fb("info", "装液完成：涂脂试漏、润洗 3 次、气泡排尽、0.00 mL 调零", undefined, undefined, ["S004", "S006"]),
      },
    ),
    trap(
      "step2-piston-force",
      "assemble",
      "活塞发涩不涂凡士林、也不试漏，直接用力拧（或用玻璃棒敲）让它转开",
      "demo-op-step2-piston-force",
      "S1",
      hazard(
        "exp10-H5",
        "L4",
        16,
        "S1",
        fb(
          "danger",
          "磨口未涂脂又硬拧：活塞柄应力集中、管身崩裂，酸液顺管壁泄出",
          "为什么：玻璃活塞与管体是磨口配合，不涂脂则密封面存在微隙且干涩卡滞；强行扭转把扭矩全压在磨口与活塞柄上，超过玻璃强度即崩裂，酸液在液柱静压下同时泄出。",
          "正确做法：装液前涂脂、试漏 2 min，漏则重装；活塞发涩先查明原因（残碱黏结或磨口有砂粒），不硬拧、不敲击，交教师处理。",
          ["S004", "S002", "S009"],
        ),
        { fx: "glass-break", incidentId: "exp10-H5", terminate: true },
      ),
    ),
    // 可恢复 trap 放最后。
    trap(
      "step2-bubble",
      "titrate",
      "尖嘴气泡没排尽就调零，直接开始滴定",
      "demo-op-step2-bubble",
      "S2",
      hazard(
        "exp10-H17",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "气泡被算进了放液量，V 偏大：标定 c 偏小、测碱结果偏高",
          "为什么：气泡占据的体积在滴定中被“算进”放出的液量，却并未真正进入锥形瓶参与反应，故读数偏大；同一步骤里标定与测碱的偏差方向还相反。",
          "正确做法：装液至零刻度上方，管尖朝下快速放液把气泡冲出，再调至 0.00 mL 后才开始滴定。",
          ["S004", "S006"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "标定滴定至近终点与煮沸驱 CO₂",
  scene: "滴定台 + 电热板",
  demoId: "exp10-step3-titrate-standardize",
  judge: {
    criterion: "黄变橙且 30 s 不褪；微沸 2 min 驱尽 CO₂、冷却后续滴；V 落在 20~35 mL 且读至 0.01 mL",
    competency: ["S2", "K1"],
    tolerance: { paramKey: "volume", expected: 28.3, unit: "mL", tolerance: 0.1 },
  },
  hints: {
    h0: "终点判早了，V 偏小、c 偏高，这份数据就废了。",
    h1: "为什么终点会“返黄”？溶解的 CO₂ 使溶液偏酸还是偏碱？",
    h2: "高亮“先快后慢、半滴吹下摇匀、微沸 2 min 驱 CO₂”。",
    h3: "演示 快滴至黄色变浅→半滴靠内壁吹下摇匀→微沸 2 min（瓶口朝无人侧）→冷却→返黄补滴至橙色 30 s 不褪。",
    h4: H4,
  },
  accepts: ["step3-titrate", "step3-half-drop", "step3-boil-cool", "step3-line-flow", "step3-boil-over"],
  choices: [
    correct(
      "step3-titrate",
      "titrate",
      "左手控活塞、右手旋摇锥形瓶，先快后慢，滴至黄色明显变浅（近终点）",
      "demo-op-step3-titrate",
      "S2",
      { observation: { text: "滴定至近终点，溶液由黄色转为浅黄（局部橙色可摇匀褪去）" } },
    ),
    correct(
      "step3-half-drop",
      "addDrops",
      "近终点改半滴：管尖靠瓶内壁，用洗瓶吹下、摇匀后再判断",
      "demo-op-step3-half-drop",
      "S2",
      {
        ...P({ drops: 0.5 }),
        observation: { text: "半滴加入并吹下摇匀，溶液转橙色（尚可褪去）", value: 0.5 },
      },
    ),
    correct(
      "step3-boil-cool",
      "heat",
      "电热板上微沸 2 min 驱尽 CO₂（瓶口朝无人侧、垫石棉网），冷却至室温，返黄再补滴至橙色 30 s 不褪",
      "demo-op-step3-boil-cool",
      "S2",
      {
        completesStep: true,
        requires: ["step3-titrate", "step3-half-drop"],
        ...P({ boilMinutes: 2, holdSeconds: 30 }),
        observation: { text: "微沸 2 min 驱尽 CO₂，冷却后返黄，补滴至橙色保持 30 s 不褪", value: 2 },
        entityPatch: { "flask-1": { note: "已煮沸驱 CO₂、冷却补滴至橙色（终点）" } },
        feedback: fb(
          "info",
          "标定终点成立：半滴收尾、微沸 2 min 驱 CO₂、冷却补滴至橙色 30 s 不褪",
          undefined,
          undefined,
          ["S005", "S013"],
        ),
      },
    ),
    trap(
      "step3-line-flow",
      "titrate",
      "近终点还开大流量成线流，看见橙色就停（不摇匀、也不煮沸）",
      "demo-op-step3-line-flow",
      "S2",
      hazard(
        "exp10-H14",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "局部酸过量造成“假终点”，摇匀又褪回，V 偏差 0.02~0.10 mL",
          "为什么：局部酸过量使近终点处 pH 骤降、指示剂提前变色，摇匀后又褪回；边滴边摇跟不上时，终点会在“已变橙”和“又变黄”之间反复。",
          "正确做法：先快后慢，近终点逐滴加半滴、边滴边摇；橙色 30 s 不褪再读数，不煮沸不判终点。",
          ["S005", "S015"],
        ),
      ),
    ),
    // 可恢复 trap 放最后。
    trap(
      "step3-boil-over",
      "heat",
      "大火强沸驱 CO₂，锥形瓶口对着自己或旁边同学",
      "demo-op-step3-boil-over",
      "S2",
      hazard(
        "exp10-H3",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "含盐碱液强沸起泡、整层冲出，正对颜面烫伤并损失样品",
          "为什么：碳酸钠溶液含 CO₂ 与大量溶解盐，强沸时气泡在液面堆积成厚泡沫层，一旦破裂即整层冲出；瓶口有人则正对颜面。",
          "正确做法：微沸 2 min 即可、瓶口朝无人侧、瓶下垫石棉网、人稍侧身。",
          ["S013", "S001"],
        ),
        { fx: "boil-over", incidentId: "exp10-H3" },
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "判终点与滴定管读数",
  scene: "滴定台 + 白瓷板",
  demoId: "exp10-step4-read",
  judge: {
    criterion: "衬白瓷板橙色 30 s 不褪即终点；液面稳定 30 s、平视凹液面最低点、估读 0.01 mL",
    competency: ["S2"],
    tolerance: { paramKey: "reading", expected: 28.3, unit: "mL", tolerance: 0.01 },
  },
  hints: {
    h0: "读数差 0.02 mL，c 就差 0.1%。",
    h1: "视线该落在哪儿？为什么要等 30 s？",
    h2: "高亮凹液面最低点与“两位小数”：平视、稳定 30 s、估读到 0.01 mL。",
    h3: "演示 衬白瓷板比色判橙色→等 30 s 液面稳定→平视凹液面最低点读数→V=终读数−初读数。",
    h4: H4,
  },
  accepts: ["step4-endpoint", "step4-read", "step4-check", "step4-parallax", "step4-no-boil"],
  choices: [
    correct(
      "step4-endpoint",
      "observe",
      "衬白瓷板比色：橙色保持 30 s 不褪，判为终点",
      "demo-op-step4-endpoint",
      "S2",
      { observation: { text: "衬白瓷板观察，橙色 30 s 不褪，判为终点" } },
    ),
    correct(
      "step4-read",
      "readInstrument",
      "等液面稳定 30 s，视线与凹液面最低点相平，估读到 0.01 mL 记终读数",
      "demo-op-step4-read",
      "S2",
      {
        ...P({ finalReading: 28.3, holdSeconds: 30 }),
        observation: { text: "终读数 28.30 mL，平视凹液面最低点、估读到 0.01 mL", value: 28.3 },
        entityPatch: { "burette-acid-1": { reading: 28.3 }, "flask-1": { note: "标定 1 号终点，V(HCl)=28.30 mL" } },
      },
    ),
    correct(
      "step4-check",
      "observe",
      "复算 V=终读数−初读数，核对两位小数，并检查 3 份 V 是否都落在 20~35 mL",
      "demo-op-step4-check",
      "S2",
      {
        completesStep: true,
        requires: ["step4-endpoint", "step4-read"],
        ...P({ volume: 28.3, minVolume: 20, maxVolume: 35 }),
        observation: { text: "V(HCl)=28.30−0.00=28.30 mL，落在 20~35 mL 区间，记录完整", value: 28.3 },
        feedback: fb("info", "终点与读数完成：橙色 30 s 不褪、平视估读到 0.01 mL", undefined, undefined, ["S006", "S005"]),
      },
    ),
    trap(
      "step4-parallax",
      "readInstrument",
      "俯视或仰视读数，放液后液面还在变就记，或只读到 0.1 mL",
      "demo-op-step4-parallax",
      "S2",
      hazard(
        "exp10-H12",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "视线偏一格，单次 V 差 0.02~0.1 mL，c 与 w 同步偏差",
          "为什么：滴定管刻度自上而下增大，俯视时视线交点落在液面之上（读数偏小）、仰视偏大；刚放液后管壁挂液，液面仍在变化，不估读到 0.01 mL 又丢了最后一位有效数字。",
          "正确做法：等液面稳定 30 s，视线与凹液面最低点相平，估读到 0.01 mL 并记两位小数。",
          ["S006", "S005"],
        ),
      ),
    ),
    // 可恢复 trap 放最后。
    trap(
      "step4-no-boil",
      "observe",
      "不煮沸驱 CO₂ 就判终点，或煮沸后没冷却就接着滴、直接读数",
      "demo-op-step4-no-boil",
      "S2",
      hazard(
        "exp10-H7",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "CO₂ 未驱尽，终点随放置“返黄”，V 偏小 0.1~0.3 mL",
          "为什么：中和产生的 H₂CO₃ 部分以溶解态 CO₂ 存在，使溶液缓冲、终点提前“返黄”，判断随放置时间漂移；未冷却即续滴，体积读数与温度都不稳。",
          "正确做法：微沸 2 min 驱尽 CO₂，冷却至室温后补滴至橙色 30 s 不褪，再读数。",
          ["S005", "S006"],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "平行测定与双指示剂数据",
  scene: "滴定台 + 配液台",
  demoId: "exp10-step5-parallel",
  judge: {
    criterion: "标定 3 份齐全、相对平均偏差 ≤0.3%；V₁ 与 V₂ 两个独立读数；移液管润洗 3 次、移取 25.00 mL",
    competency: ["S1", "S2", "S3"],
    tolerance: { paramKey: "relativeDeviation", expected: 0, unit: "%", tolerance: 0.3 },
  },
  hints: {
    h0: "平行份数不够，平均值就没有代表性。",
    h1: "先加哪种指示剂？定容后不摇匀会怎样？",
    h2: "高亮“润洗 3 次、定容摇匀 ≥10 次、先酚酞后甲基橙”。",
    h3: "演示 3 份平行标定→称 2.0000 g 试样定容 250.0 mL 摇匀→移取 25.00 mL×3→酚酞记 V₁→甲基橙记 V₂。",
    h4: H4,
  },
  accepts: ["step5-parallel", "step5-sample", "step5-double", "step5-order", "step5-two-trials"],
  choices: [
    correct(
      "step5-parallel",
      "titrate",
      "按步 3~4 再做 2 份，凑满 3 份平行标定，逐份记录 m 与 V",
      "demo-op-step5-parallel",
      "S3",
      {
        ...P({ trials: 3 }),
        observation: { text: "3 份平行标定完成：m 0.1500/0.1498/0.1502 g，V 28.33/28.30/28.36 mL", value: 3 },
      },
    ),
    correct(
      "step5-sample",
      "weigh",
      "差减法称约 2.0000 g 纯碱试样，溶解后定量转入 250 mL 容量瓶，定容、盖塞反复倒转摇匀 ≥10 次",
      "demo-op-step5-sample",
      "S1",
      {
        ...P({ mass: 2, volume: 250, invertTimes: 10 }),
        observation: { text: "称取试样 2.0000 g，定容至 250.0 mL 并倒转摇匀 ≥10 次", value: 2 },
        entityPatch: {
          "volumetric-250": { note: "纯碱试液 250.0 mL，已摇匀" },
          "balance-1": { reading: 2 },
        },
      },
    ),
    correct(
      "step5-double",
      "addDrops",
      "移液管用试液润洗 3 次后移取 25.00 mL×3；先加 2 滴酚酞滴至红色刚好消失记 V₁，再加 2 滴甲基橙滴至黄变橙记 V₂",
      "demo-op-step5-double",
      "S2",
      {
        completesStep: true,
        requires: ["step5-parallel", "step5-sample"],
        ...P({ volume: 25, rinseTimes: 3, drops: 2, v1: 18.2, v2: 18.6 }),
        observation: {
          text: "移取 25.00 mL×3；V₁=18.20 mL（红色刚好消失、30 s 不返红），V₂=18.60 mL（黄变橙、30 s 不褪）",
          value: 18.2,
        },
        entityPatch: {
          "pipette-25": { note: "已用试液润洗 3 次" },
          "flask-4": { liquid: { substance: "纯碱试液 25.00 mL", level: 25, color: "#f0dbe0", opacity: 0.3 } },
        },
        feedback: fb(
          "info",
          "双指示剂数据齐：先酚酞记 V₁、再甲基橙记 V₂，各 2 滴、30 s 判据成立",
          undefined,
          undefined,
          ["S007", "S004", "S005"],
        ),
      },
    ),
    trap(
      "step5-order",
      "addDrops",
      "顺序颠倒：先加甲基橙后加酚酞，或两种指示剂一起加",
      "demo-op-step5-order",
      "S2",
      hazard(
        "exp10-H9",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "先加甲基橙会直接滴过第一终点，拿不到有意义的 V₁，组分判断全部作废",
          "为什么：甲基橙在 pH≈4 变色，先加则第一步就直接滴过第一终点，V₁ 无法获得；两种一起加则颜色叠加，两个终点无法分辨。",
          "正确做法：先加酚酞滴至红色刚好消失记 V₁，再加甲基橙滴至黄变橙记 V₂。",
          ["S005", "S015"],
        ),
      ),
    ),
    // 可恢复 trap 放最后。
    trap(
      "step5-two-trials",
      "compute",
      "只做 2 份平行，或相对平均偏差已 0.5% 仍直接取平均",
      "demo-op-step5-two-trials",
      "S3",
      hazard(
        "exp10-H11",
        "L3",
        8,
        "S3",
        fb(
          "danger",
          "份数不足、偏差超限仍取平均：平均值无代表性，报告数据处理分扣完",
          "为什么：少于 3 份无法识别离群值；偏差超限说明存在未受控的系统或随机误差，取平均只是把错误摊平。",
          "正确做法：至少 3 份平行，相对平均偏差 ≤0.3% 才取平均；超限先查称量吸湿、CO₂ 未驱尽、读数视差、气泡等原因再重做。",
          ["S005", "S001"],
        ),
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "计算 c(HCl)、总碱度与结果校核",
  scene: "计算台 + 实验台收尾",
  demoId: "exp10-step6-compute-alkalinity",
  judge: {
    criterion: "3 份 c 齐全、偏差 ≤0.3%、c 报 4 位；w 乘 250.0/25.00、组分判断与 V₁/V₂ 一致、4 位有效数字",
    competency: ["K1", "S3", "A1"],
    tolerance: { paramKey: "w", expected: 97.42, unit: "%", tolerance: 0.5 },
  },
  hints: {
    h0: "公式口径错，结果会差 2 倍或 10 倍。",
    h1: "1 mol Na₂CO₃ 消耗几 mol H⁺？25.00 mL 来自 250.0 mL，倍数是多少？",
    h2: "高亮 c=2m/(M·V) 与 w 的稀释因子 250.0/25.00＝10。",
    h3: "演示 逐份算 c→均值与偏差→w=c(V₁+V₂)/2·M/(m×25/250)×100%→按 V₁/V₂ 判组分→自洽校核。",
    h4: H4,
  },
  accepts: ["step6-c", "step6-w", "step6-check", "step6-formula", "step6-drain"],
  choices: [
    correct(
      "step6-c",
      "compute",
      "逐份按 c(HCl)=2m(Na₂CO₃)/[M(Na₂CO₃)·V(HCl)] 算 c，求均值与相对平均偏差，≤0.3% 后报 4 位有效数字",
      "demo-op-step6-c",
      "K1",
      {
        ...P({ c: 0.09991, trials: 3 }),
        observation: { text: "3 份 c=0.09991/0.09988/0.09994 mol·L⁻¹，均值 0.09991，相对平均偏差 0.018%", value: 0.09991 },
      },
    ),
    correct(
      "step6-w",
      "compute",
      "按 w=[c·(V₁+V₂)/2·M(Na₂CO₃)]/[m·25.00/250.0]×100% 算总碱度，并按 V₁ 与 V₂ 的大小关系判组分",
      "demo-op-step6-w",
      "K1",
      {
        ...P({ w: 97.42, dilutionFactor: 10 }),
        observation: {
          text: "w(总碱度,以 Na₂CO₃ 计)=97.42%；V₂>V₁，判为含少量 NaHCO₃（w≈1.68%），Na₂CO₃ 实测 96.37%",
          value: 97.42,
        },
      },
    ),
    correct(
      "step6-check",
      "compute",
      "自洽校核：组分折算与 (V₁+V₂) 口径对得上、w 落在 97%~98%、有效数字 4 位；残液入废液桶、滴定管洗净倒夹",
      "demo-op-step6-check",
      "A1",
      {
        completesStep: true,
        requires: ["step6-c", "step6-w"],
        ...P({ checkError: 0.01 }),
        observation: {
          text: "校核通过：96.37%+1.68%×105.99/(2×84.01)≈97.43%，与 97.42% 一致；残液入桶、滴定管倒夹晾干",
          value: 0.01,
        },
        entityPatch: { "burette-acid-1": { note: "已洗净、倒夹晾干" }, "waste-bottle": { note: "含酸碱与指示剂残液" } },
        feedback: fb(
          "info",
          "结果校核通过：c=0.09991 mol·L⁻¹、w=97.42%、组分与 V₁/V₂ 一致、废液分类处置",
          undefined,
          undefined,
          ["S006", "S008", "S023"],
        ),
      },
    ),
    trap(
      "step6-formula",
      "compute",
      "按 1:1 计量比算 c（漏掉 2），总碱度只用 V₂、忘乘 250.0/25.00，或把 Na₂CO₃ 当 NaOH 算",
      "demo-op-step6-formula",
      "K1",
      hazard(
        "exp10-H15",
        "L3",
        8,
        "K1",
        fb(
          "danger",
          "计算口径错：结果差 2 倍或 10 倍，数量级都不对",
          "为什么：Na₂CO₃ 与 HCl 是 1:2 计量比，漏掉 2 即差一倍；总碱度要用 (V₁+V₂) 两段之和，只用 V₂ 只算了第二段；25.00 mL 来自 250.0 mL，忘乘 250.0/25.00 结果小 10 倍。",
          "正确做法：c=2m/(M·V)；w=c·(V₁+V₂)/2·M/(m×25.00/250.0)×100%；先写公式再代数，结果保留 4 位有效数字。",
          ["S006", "S001"],
        ),
      ),
    ),
    // 可恢复 trap 放最后。
    trap(
      "step6-drain",
      "wash",
      "残液直接倒水槽，滴定管不洗就倒挂存放",
      "demo-op-step6-drain",
      "A1",
      hazard(
        "exp10-H16",
        "L1",
        3,
        "A1",
        fb(
          "warn",
          "残液直排腐蚀下水并污染废水；管内存酸腐蚀磨口、色素干结",
          "为什么：残液 pH 4~9 且含有机指示剂，直排会腐蚀下水管路并污染废水；管内存酸会腐蚀活塞磨口、残留色素干结。",
          "正确做法：残液倒入指定废液桶；滴定管先用自来水冲净，再以蒸馏水淋洗三遍、倒夹晾干。",
          ["S023", "S008"],
        ),
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp10Definition: ExperimentDefinition = {
  id: "exp10",
  title: "盐酸标准溶液的标定与工业纯碱总碱度的测定",
  competencies: ["K1", "S1", "S2", "S3", "A1"],
  steps: [step1, step2, step3, step4, step5, step6],
  createState: (): ExperimentState => ({
    expId: "exp10",
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

export default exp10Definition;
