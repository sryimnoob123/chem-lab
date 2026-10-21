/**
 * experiments/exp07/definition.ts —— 实验 07《常见阳离子的分离与鉴定（一）》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp07.md。本文件只导出数据，不含 IO / React / 随机数。
 * 规格原文是 8 步；按"5~6 步"的课程节奏合并为 6 步：
 * 1 器皿与试样准备 → 2 分组沉淀（HCl 组）→ 3 分离与洗涤 → 4 焰色与银组特征鉴定
 * → 5 干扰排除（NH₄⁺ 掩蔽与介质控制）→ 6 ds 区鉴定、结论汇总与废液分类。
 * 每步 4~5 个选项、1~2 个陷阱，且每步至少 1 个 L3 教学陷阱；L4 在步 4（H5 银氨溶液）。
 * 场景复用现有离心机 / 试管 / 蒸馏水洗瓶 / 酒精灯素材，不新增 SVG。
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
  "tube-1": { id: "tube-1", kind: "tube", note: "1 号离心管（原试液，焰色用）" },
  "tube-2": { id: "tube-2", kind: "tube", note: "2 号离心管（HCl 组：AgCl 沉淀）" },
  "tube-3": { id: "tube-3", kind: "tube", note: "3 号离心管（HCl 组离心后的上清液）" },
  "tube-4": { id: "tube-4", kind: "tube", note: "4 号离心管（碱土组：碳酸盐沉淀）" },
  "wash-bottle": { id: "wash-bottle", kind: "wash", note: "蒸馏水洗瓶 500 mL" },
  "flame-lamp": { id: "flame-lamp", kind: "lamp", note: "酒精灯（氧化焰）" },
  "nickel-wire": { id: "nickel-wire", kind: "stand", note: "镍铬丝 Ø0.5 mm，带玻璃棒柄" },
  "reagent-bottle": {
    id: "reagent-bottle",
    kind: "volumetric",
    note: "分组试剂：3 mol/L HCl、(NH₄)₂CO₃、NH₄Cl、氨水、HAc、K₂CrO₄ 等",
  },
  "waste-ag": { id: "waste-ag", kind: "beaker", note: "含银废液桶（贴“含银”标签）" },
  "waste-hg": { id: "waste-hg", kind: "beaker", note: "含汞废液桶（贴“含汞”标签）" },
  "waste-cr": { id: "waste-cr", kind: "beaker", note: "含六价铬废液桶（贴“六价铬”标签）" },
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
 * 构造小工具（与 exp04 完全同构）
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
const H4 = "连续犯同类错误 3 次：先停下复述这一步的规范（蒸馏水洗管编号 / 分组沉淀完全 / 离心取液澄清 / 银氨用完即毁 / 干扰靠掩蔽排除），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6，按 6 步合并）
 * ------------------------------------------------------------------ */

export const EXP07_STEP_DEMO_IDS: readonly string[] = [
  "exp07-step1-clean",
  "exp07-step2-hcl",
  "exp07-step3-centrifuge",
  "exp07-step4-identify",
  "exp07-step5-mask",
  "exp07-step6-tree",
];

const step1: StepDefinition = {
  index: 0,
  title: "器皿检查与试样准备",
  scene: "离心管架 + 白纸背景 + 试剂台",
  demoId: "exp07-step1-clean",
  judge: {
    criterion: "8 支离心管无裂纹、各带唯一编号；全程蒸馏水洗 3 次，取液读标签",
    competency: ["S1"],
  },
  hints: {
    h0: "自来水里有哪些阳离子？它们会在哪一步冒出来？",
    h1: "自来水里含 Ca²⁺ 和 Cl⁻，它们与哪个分组判据撞车？",
    h2: "高亮蒸馏水洗瓶与管壁：蒸馏水洗 3 次、逐管编号，取液前读标签。",
    h3: "演示蒸馏水洗管 3 次→逐支对光查裂纹→编号 1~8 按序就位→取原试液 20 滴入 1 号管并核对标签。",
    h4: H4,
  },
  accepts: ["step1-rinse", "step1-inspect", "step1-number", "step1-tap"],
  choices: [
    correct(
      "step1-rinse",
      "wash",
      "用蒸馏水把 8 支离心管洗 3 次并沥干",
      "demo-op-step1-rinse",
      "S1",
      { observation: { text: "8 支离心管用蒸馏水洗 3 次，倒置沥干，内壁挂水均匀无油膜" } },
    ),
    correct(
      "step1-inspect",
      "readInstrument",
      "逐支对光（背景打白纸）检查管壁与管底，2 支细裂纹管弃用报损",
      "demo-op-step1-inspect",
      "S1",
      {
        requires: ["step1-rinse"],
        observation: { text: "对光查出 2 支管壁细裂纹，弃用并交教师报损，其余 8 支完好" },
      },
    ),
    correct(
      "step1-number",
      "assemble",
      "编号 1~8 按序就位，取原试液 20 滴入 1 号管，核对混合试液与分组试剂标签",
      "demo-op-step1-number",
      "K2",
      {
        completesStep: true,
        requires: ["step1-inspect"],
        ...P({ drops: 20, volume: 1 }),
        observation: { text: "8 支离心管各带唯一编号 1~8 就位；1 号管装原试液 20 滴（1.00 mL）" },
        feedback: fb(
          "info",
          "准备完成：蒸馏水洗 3 次、裂纹管弃用、8 支管编号就位、试液 20 滴",
          undefined,
          undefined,
          ["S001", "S015"],
        ),
      },
    ),
    // 可恢复 trap 放最后：验收脚本点最后一个也不会踩到 L4（本步没有 L4）。
    trap(
      "step1-tap",
      "wash",
      "用自来水冲洗离心管与滴管，省下蒸馏水",
      "demo-op-step1-tap",
      "S1",
      hazard(
        "exp07-H1",
        "L3",
        9,
        "S1",
        fb(
          "danger",
          "自来水里的 Ca²⁺ 被当成试样，步 5 出现“无中生有”的白色碳酸盐",
          "为什么：自来水含 Ca²⁺（约 0.5~2 mmol·L⁻¹）、Cl⁻、Na⁺；管内残留液稀释试液并引入被测离子，步 5 出现“无中生有”的白色碳酸盐、步 2 钠黄加深，Ca²⁺ 假阳性。",
          "正确做法：全程用蒸馏水洗 3 次，沥干再用；末次洗液回检无浑浊。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "分组沉淀：HCl 组",
  scene: "试剂台 + 2 号离心管",
  demoId: "exp07-step2-hcl",
  judge: {
    criterion: "白色凝乳状 AgCl；上清液加 1 滴 HCl 无新浑浊（沉淀完全）",
    competency: ["K1", "S1"],
  },
  hints: {
    h0: "白色沉淀能单独证明 Ag⁺ 吗？先想清楚“白色”是谁的特征。",
    h1: "沉淀完全靠什么判断？",
    h2: "高亮 3 mol/L HCl 与“边加边摇、静置 1 min”：加 3 滴约 9 倍计算量。",
    h3: "演示 2 号管取试液 20 滴→滴加 3 mol/L HCl 3 滴、边加边摇→静置 1 min→离心取上清液回检。",
    h4: H4,
  },
  accepts: ["step2-sample", "step2-hcl", "step2-recheck", "step2-misread"],
  choices: [
    correct(
      "step2-sample",
      "transfer",
      "2 号管取混合试液 20 滴（1.00 mL），取前读瓶签",
      "demo-op-step2-sample",
      "S1",
      {
        ...P({ drops: 20, volume: 1 }),
        observation: { text: "2 号管装入混合试液 20 滴（1.00 mL），瓶签核对为“混合阳离子试液”" },
      },
    ),
    correct(
      "step2-hcl",
      "addDrops",
      "滴加 3 mol/L HCl 3 滴（约 9 倍计算量），边加边摇，静置 1 min 至白色 AgCl 完全析出",
      "demo-op-step2-hcl",
      "K1",
      {
        requires: ["step2-sample"],
        ...P({ drops: 3, concentration: 3 }),
        observation: { text: "滴入 3 mol/L HCl 3 滴，边加边摇，静置 1 min 得白色凝乳状 AgCl" },
        entityPatch: {
          "tube-2": { precipitate: { substance: "AgCl", amount: 1, color: "#f2f2f2" } },
        },
      },
    ),
    correct(
      "step2-recheck",
      "observe",
      "观察白色凝乳状 AgCl；离心取上清液滴加 1 滴 HCl 回检，无新浑浊即沉淀完全",
      "demo-op-step2-recheck",
      "K1",
      {
        completesStep: true,
        requires: ["step2-hcl"],
        observation: { text: "AgCl 白色凝乳状；上清液回检加 HCl 无新浑浊，沉淀完全" },
        feedback: fb(
          "info",
          "HCl 组沉淀完成：白色凝乳状 AgCl，上清液回检无新浑浊",
          undefined,
          undefined,
          ["S015"],
        ),
      },
    ),
    // 可恢复 trap 放最后：唯一 L3 教学陷阱，聚焦“白色沉淀 ≠ Ag⁺”。
    trap(
      "step2-misread",
      "addDrops",
      "凭瓶身并排位置取液，误把 6 mol/L HNO₃ 当 HCl 滴入",
      "demo-op-step2-misread",
      "K1",
      hazard(
        "exp07-H2",
        "L3",
        9,
        "K1",
        fb(
          "danger",
          "加的不是 HCl，Ag⁺ 不沉淀，“无白色沉淀”被误判为“无 Ag⁺”",
          "为什么：不引入 Cl⁻ 就不会析出 AgCl；无唯一标识、取液不核对标签时，8 支管的“上清液/沉淀”归属不可追溯，把上清液当沉淀、把别的对照液当试液，全流程结论错位、数据作废。",
          "正确做法：逐管编号，每次取液读标签，沉淀管与上清液管成对摆放；加错只能重做。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "离心分离与倾析洗涤",
  scene: "离心机 + 离心管架",
  demoId: "exp07-step3-centrifuge",
  judge: {
    criterion: "对称配平、3000 r/min 2.0 min；上清液目视澄清不夹带沉淀；沉淀用蒸馏水洗 2 次",
    competency: ["S1"],
  },
  hints: {
    h0: "离心没停稳就取液，吸进去的到底是什么？",
    h1: "上清液要“目视澄清”才叫分离完成，怎么保证？",
    h2: "高亮离心机参数与 3 号管：3000 r/min、2.0 min，完全停转后倾析。",
    h3: "演示设 3000 r/min、2.0 min→对称孔配平、盖盖启动→完全停转后倾上清液入 3 号管→沉淀用蒸馏水洗 2 次。",
    h4: H4,
  },
  accepts: ["step3-centrifuge", "step3-decant", "step3-wash", "step3-raw"],
  choices: [
    correct(
      "step3-centrifuge",
      "readInstrument",
      "设 3000 r/min、2.0 min，对称孔放等量水管配平，盖盖后启动",
      "demo-op-step3-centrifuge",
      "S1",
      {
        ...P({ rpm: 3000, minutes: 2 }),
        observation: { text: "离心机设 3000 r/min、2.0 min，对称孔配平、盖盖启动" },
      },
    ),
    correct(
      "step3-decant",
      "transfer",
      "完全停转后开盖，倾上清液入 3 号管（贴标签），目视澄清不夹带沉淀",
      "demo-op-step3-decant",
      "S1",
      {
        requires: ["step3-centrifuge"],
        observation: { text: "离心停转后倾析，3 号管上清液目视澄清，沉淀留在 2 号管" },
        entityPatch: { "tube-3": { note: "3 号离心管（HCl 组上清液，澄清）" } },
      },
    ),
    correct(
      "step3-wash",
      "washPrecipitate",
      "2 号管沉淀用 2.0 mL 蒸馏水洗 2 次，每次离心后再倾析，末次洗液回检无浑浊",
      "demo-op-step3-wash",
      "S1",
      {
        completesStep: true,
        requires: ["step3-decant"],
        ...P({ volume: 2 }),
        observation: { text: "AgCl 沉淀用蒸馏水洗 2 次，末次洗液回检无浑浊" },
        feedback: fb(
          "info",
          "分离与洗涤完成：配平离心、倾析澄清、蒸馏水洗 2 次",
          undefined,
          undefined,
          ["S004", "S015"],
        ),
      },
    ),
    // 可恢复 trap 放最后：L3 教学陷阱（未离心就取上清液）。
    trap(
      "step3-raw",
      "transfer",
      "不等离心停稳就倾倒上层液体，或直接用滴管从浑浊液上层吸取当“上清液”",
      "demo-op-step3-raw",
      "S1",
      hazard(
        "exp07-H6",
        "L3",
        9,
        "S1",
        fb(
          "danger",
          "上清液夹带白色 AgCl 进入 3 号管，后续各组判据被污染",
          "为什么：沉淀未沉降就取液，所谓“上清液”里混着 AgCl 微粒；3 号管既是上清又是沉淀，分离完成的判据不成立，后面每一组的“沉淀/溶液”归属都含糊，结论依据不足。",
          "正确做法：3000 r/min 离心 2.0 min，完全停转后再倾析；上清液目视澄清才算分离完成。",
          ["S015"],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "焰色与银组特征鉴定",
  scene: "酒精灯 + 镍铬丝 + 蓝色钴玻璃 + 通风橱",
  demoId: "exp07-step4-identify",
  judge: {
    criterion: "洗丝后空白焰色近无色；Na 黄 / 隔钴玻璃 K 紫；氨溶澄清、酸化白色复析、1 min 内入含银桶",
    competency: ["S2", "K1", "A1"],
  },
  hints: {
    h0: "玻璃里有哪些金属氧化物？它们自己也会显焰色。",
    h1: "钠黄光波长是多少、人眼对它多敏感？",
    h2: "高亮镍铬丝与蓝色钴玻璃：先洗丝至火焰无色做空白，K⁺ 必须隔钴玻璃看。",
    h3: "演示镍铬丝蘸 6 mol/L HCl 灼烧至近无色→蘸试液看黄色→隔蓝色钴玻璃看紫色→氨水溶 AgCl 后立即酸化并倒入含银废液桶。",
    h4: H4,
  },
  accepts: ["step4-blank", "step4-flame", "step4-silver", "step4-glass-rod", "step4-keep-silver"],
  choices: [
    correct(
      "step4-blank",
      "assemble",
      "镍铬丝蘸 6 mol/L HCl 在氧化焰中灼烧至火焰近无色，重复 2~3 次，做空白对照",
      "demo-op-step4-blank",
      "S2",
      { observation: { text: "镍铬丝蘸浓 HCl 灼烧 2~3 次，空白焰色近无色" } },
    ),
    correct(
      "step4-flame",
      "observe",
      "蘸试液看焰色：直接观察为黄色（Na⁺），隔蓝色钴玻璃后见紫色（K⁺）",
      "demo-op-step4-flame",
      "S2",
      {
        requires: ["step4-blank"],
        observation: { text: "直接观察焰色为黄色（Na⁺）；隔蓝色钴玻璃见紫色（K⁺）" },
      },
    ),
    correct(
      "step4-silver",
      "addDrops",
      "银组：6 mol/L 氨水 10 滴溶 AgCl 至澄清→离心取上清液→6 mol/L HNO₃ 酸化至白色复析→随即倒入含银废液桶",
      "demo-op-step4-silver",
      "K1",
      {
        completesStep: true,
        requires: ["step4-flame"],
        ...P({ drops: 10, concentration: 6 }),
        observation: {
          text: "AgCl 加氨水 10 滴溶解澄清；酸化后白色 AgCl 复析，随即倒入含银废液桶",
        },
        entityPatch: { "waste-ag": { note: "含银废液桶（AgCl + 酸化后的银氨残液，已贴签）" } },
        feedback: fb(
          "info",
          "银组鉴定完成：氨溶澄清→酸化白色复析→用完即毁，已入含银桶",
          undefined,
          undefined,
          ["S011", "S018"],
        ),
      },
    ),
    // L4 终止项：放在非最后位置（第 4 项）。
    trap(
      "step4-keep-silver",
      "addDrops",
      "把银氨溶液留到实验结束“统一处理”，或加热蒸干“看白色固体”",
      "demo-op-step4-keep-silver",
      "A1",
      hazard(
        "exp07-H5",
        "L4",
        20,
        "A1",
        fb(
          "danger",
          "银氨溶液久置/受热生成雷爆银，试管内爆轰性分解，碎片与银盐飞散（本次实验终止）",
          "为什么：[Ag(NH₃)₂]⁺ 久置或受热逐步生成 Ag₃N（雷爆银）等爆炸性银化物，对摩擦、撞击、受热极敏感；干燥过程使晶粒长大、敏感度进一步上升。",
          "正确做法：鉴定完立即加 HNO₃ 酸化破坏配离子，全部液体倒入含银废液桶；银氨溶液不留存、不加热、不蒸干。",
          ["S011", "S018"],
        ),
        { fx: "explosion", incidentId: "exp07-H5", terminate: true },
      ),
    ),
    // 可恢复 trap 放最后：L3 教学陷阱（玻璃棒蘸取灼烧）。
    trap(
      "step4-glass-rod",
      "observe",
      "用玻璃棒蘸取试液灼烧观察焰色",
      "demo-op-step4-glass-rod",
      "S2",
      hazard(
        "exp07-H3",
        "L3",
        9,
        "S2",
        fb(
          "danger",
          "玻璃棒本身含钠，灼烧即显黄，K⁺ 的紫色被完全掩盖",
          "为什么：普通玻璃含 Na₂O、CaO、SiO₂ 等，钠的焰色为 589 nm 强黄线，灼烧玻璃本身即显黄并带橙红；K⁺ 的紫色被钠黄完全掩盖，误判“无 K⁺”，碱金属结论错误。",
          "正确做法：用镍铬丝（或铂丝）蘸取，蘸前用浓 HCl 洗至火焰无色，并与钴亚硝酸钠法互相印证。",
          ["S001", "S018"],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "干扰排除：NH₄⁺ 掩蔽与介质控制",
  scene: "通风橱 + 离心管架 + 点滴板",
  demoId: "exp07-step5-mask",
  judge: {
    criterion: "pH 9~10 缓冲下只沉 Ca/Ba、Mg²⁺ 留液并可复验；HAc 介质（pH≈2.3）下只析出黄色 BaCrO₄",
    competency: ["K1", "K2", "A1"],
  },
  hints: {
    h0: "NH₄⁺ 怎么影响 CO₃²⁻ 的有效浓度？",
    h1: "MgCO₃ 的溶解度比 CaCO₃ 大还是小？不加 NH₄Cl 会怎样？",
    h2: "高亮 NH₄Cl 与 pH 试纸：先造缓冲再加 (NH₄)₂CO₃；溶碳酸盐用 HAc，绝不用硫酸。",
    h3: "演示 NH₄Cl 5 滴→氨水调 pH 9~10→(NH₄)₂CO₃ 10 滴沉 Ca/Ba→上清液加 Na₂HPO₄ 复验 Mg²⁺→沉淀用 HAc 溶解后加 K₂CrO₄ 检 Ba²⁺。",
    h4: H4,
  },
  accepts: ["step5-buffer", "step5-carbonate", "step5-chromate", "step5-sulfuric", "step5-conc-hcl"],
  choices: [
    correct(
      "step5-buffer",
      "addDrops",
      "先加 2.0 mol/L NH₄Cl 5 滴，再用 6 mol/L 氨水调至 pH 9~10（NH₃–NH₄Cl 缓冲）",
      "demo-op-step5-buffer",
      "K2",
      {
        ...P({ drops: 5, ph: "9~10" }),
        observation: { text: "加 NH₄Cl 5 滴后用氨水调至 pH 9~10，NH₃–NH₄Cl 缓冲建立" },
      },
    ),
    correct(
      "step5-carbonate",
      "addDrops",
      "加 1.0 mol/L (NH₄)₂CO₃ 10 滴沉 Ca²⁺/Ba²⁺，静置 2 min 后离心取液；上清液氨化后加 Na₂HPO₄ 5 滴复验 Mg²⁺",
      "demo-op-step5-carbonate",
      "K2",
      {
        requires: ["step5-buffer"],
        ...P({ drops: 10, concentration: 1 }),
        observation: {
          text: "白色 CaCO₃/BaCO₃ 析出；上清液氨化后加 Na₂HPO₄ 得白色结晶状 MgNH₄PO₄（Mg²⁺ 未共沉）",
        },
        entityPatch: {
          "tube-4": { precipitate: { substance: "CaCO₃/BaCO₃", amount: 1, color: "#f4f4f4" } },
        },
      },
    ),
    correct(
      "step5-chromate",
      "addDrops",
      "沉淀用 6 mol/L HAc 10 滴溶解并微热赶尽 CO₂，加 0.10 mol/L K₂CrO₄ 15 滴得黄色 BaCrO₄；上清液加 0.25 mol/L (NH₄)₂C₂O₄ 5 滴得白色 CaC₂O₄",
      "demo-op-step5-chromate",
      "K1",
      {
        completesStep: true,
        requires: ["step5-carbonate"],
        ...P({ drops: 15, concentration: 0.1 }),
        observation: {
          text: "HAc 介质（pH≈2.3）下析出黄色 BaCrO₄；上清液加草酸铵得白色 CaC₂O₄",
        },
        feedback: fb(
          "info",
          "干扰排除完成：缓冲掩蔽保住 Mg²⁺，HAc 介质让 Ba 沉而 Ca 不沉",
          undefined,
          undefined,
          ["S015"],
        ),
      },
    ),
    trap(
      "step5-sulfuric",
      "dissolve",
      "用 3 mol/L H₂SO₄ 代替 HAc 溶解碳酸盐沉淀",
      "demo-op-step5-sulfuric",
      "K1",
      hazard(
        "exp07-H11",
        "L2",
        5,
        "K1",
        fb(
          "warn",
          "白色 BaSO₄ 盖住黄色 BaCrO₄，Ba²⁺ 与 Ca²⁺ 双双误判",
          "为什么：Ba²⁺ 遇 SO₄²⁻ 立即生成白色 BaSO₄（Ksp 1.1×10⁻¹⁰），CaSO₄ 微溶也部分析出；白色沉淀掩盖黄色判据，本组数据作废。",
          "正确做法：用 6 mol/L HAc 溶解，弱酸介质既溶碳酸盐又不引入沉淀阴离子。",
          [],
        ),
      ),
    ),
    // 可恢复 trap 放最后：L3 教学陷阱（浓 HCl + 加热放 Cl₂）。
    trap(
      "step5-conc-hcl",
      "dissolve",
      "用浓 HCl 溶解 BaCrO₄ 沉淀并加热",
      "demo-op-step5-conc-hcl",
      "A1",
      hazard(
        "exp07-H12",
        "L3",
        8,
        "A1",
        fb(
          "danger",
          "Cr(VI) 在强酸、加热下氧化 Cl⁻，逸出黄绿色 Cl₂",
          "为什么：Cr₂O₇²⁻ + 6Cl⁻ + 14H⁺ → 2Cr³⁺ + 3Cl₂↑ + 7H₂O；强酸加热时 Cr(VI) 同时被还原、橙色消失，逸出的 Cl₂ 刺激眼与呼吸道，可致咳嗽、胸闷。",
          "正确做法：用稀 HAc 或 3 mol/L HCl 常温溶解，不加热；已逸出时立即撤离并开排风。",
          ["S007"],
        ),
        { fx: "toxic-gas", incidentId: "exp07-H12" },
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "ds 区鉴定、结论汇总与废液分类",
  scene: "点滴板 + 三个废液桶 + 水槽",
  demoId: "exp07-step6-tree",
  judge: {
    criterion: "深蓝色 [Cu(NH₃)₄]²⁺ 与白色 Zn[Hg(SCN)₄] 均可辨；10 个离子结论有原始现象支撑；三类废液分桶贴签",
    competency: ["S2", "K1", "A1"],
  },
  hints: {
    h0: "深蓝色肉眼可辨的最低浓度大概多少？稀释之后还看得出吗？",
    h1: "稀释 10 倍后 [Cu(NH₃)₄]²⁺ 的吸光度还剩多少？",
    h2: "高亮原滤液与三个废液桶：原液直接看蓝；银、汞、铬三类分开倒。",
    h3: "演示取原上清液 5 滴加过量氨水见深蓝→另取 5 滴加硫氰酸汞铵得白色沉淀→汇总 10 个离子结论→三类废液分桶贴签。",
    h4: H4,
  },
  accepts: ["step6-ammine", "step6-conclusion", "step6-waste", "step6-dilute", "step6-drain"],
  choices: [
    correct(
      "step6-ammine",
      "observe",
      "取原上清液 5 滴（不稀释）加 6 mol/L 氨水至过量得深蓝色 [Cu(NH₃)₄]²⁺；另取 5 滴加 0.10 mol/L (NH₄)₂[Hg(SCN)₄] 得白色 Zn[Hg(SCN)₄]",
      "demo-op-step6-ammine",
      "S2",
      {
        ...P({ drops: 5 }),
        observation: { text: "加过量氨水得深蓝色 [Cu(NH₃)₄]²⁺；硫氰酸汞铵法得白色 Zn[Hg(SCN)₄] 结晶" },
      },
    ),
    correct(
      "step6-conclusion",
      "compute",
      "汇总 10 个离子的检出结论（+ / −），逐条回填对应的原始现象",
      "demo-op-step6-conclusion",
      "K1",
      {
        requires: ["step6-ammine"],
        observation: { text: "10 个离子的检出结论逐条回填原始现象：Na⁺ K⁺ Mg²⁺ Ca²⁺ Ba²⁺ Al³⁺ Fe³⁺ Ag⁺ Cu²⁺ Zn²⁺" },
      },
    ),
    correct(
      "step6-waste",
      "transfer",
      "含银、含汞、含六价铬三类废液分三个专用桶倾倒，标签写明离子种类与日期；器皿清洗沥干归位",
      "demo-op-step6-waste",
      "A1",
      {
        completesStep: true,
        requires: ["step6-conclusion"],
        observation: { text: "三类废液分桶倾倒并贴签（离子种类 + 日期）；器皿清洗沥干、台面擦净" },
        entityPatch: {
          "waste-hg": { note: "含汞废液桶（硫氰酸汞铵残液，已贴签）" },
          "waste-cr": { note: "含六价铬废液桶（K₂CrO₄/BaCrO₄ 残液，已贴签）" },
        },
        feedback: fb(
          "info",
          "收尾完成：三类废液零混装、标签齐全，器皿归位",
          undefined,
          undefined,
          ["S011"],
        ),
      },
    ),
    trap(
      "step6-dilute",
      "observe",
      "先把滤液稀释 10 倍再找 Cu²⁺ 的深蓝色",
      "demo-op-step6-dilute",
      "S2",
      hazard(
        "exp07-H13",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "稀释后深蓝色淡到看不见，明明含 Cu²⁺ 却判“无 Cu²⁺”",
          "为什么：[Cu(NH₃)₄]²⁺ 的 ε ≈ 50 L·mol⁻¹·cm⁻¹，1 cm 光程下 c = 5 mmol·L⁻¹ 时 A ≈ 0.25 刚可辨；稀释 10 倍后 A ≈ 0.03，肉眼无法判断。",
          "正确做法：取原滤液直接加过量氨水观察，不稀释。",
          [],
        ),
      ),
    ),
    // 可恢复 trap 放最后：L3 教学陷阱（三类重金属废液混倒/入水槽）。
    trap(
      "step6-drain",
      "transfer",
      "三类废液合并倒入一个桶，或直接倾入水槽用水稀释冲走",
      "demo-op-step6-drain",
      "A1",
      hazard(
        "exp07-H15",
        "L3",
        9,
        "A1",
        fb(
          "danger",
          "含银、含汞、含六价铬废液混装或入下水，污染水体并违反危废管理规定",
          "为什么：Ag⁺、Hg²⁺ 对水生生物剧毒（μg·L⁻¹ 级即有毒性）；Cr(VI) 致癌且易迁移；三类废液处理工艺不同（银回收、汞硫化物沉淀、铬还原后沉淀），混装后无法分别处理。",
          "正确做法：三个专用桶分装，标签写明离子种类与日期，交有资质单位回收；不得稀释后倒入水槽。",
          ["S011"],
        ),
        { fx: "heavy-metal", incidentId: "exp07-H15" },
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp07Definition: ExperimentDefinition = {
  id: "exp07",
  title: "常见阳离子的分离与鉴定（一）",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5, step6],
  createState: (): ExperimentState => ({
    expId: "exp07",
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

export default exp07Definition;
