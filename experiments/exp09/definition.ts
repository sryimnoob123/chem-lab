/**
 * experiments/exp09/definition.ts —— 实验 09《酸碱标准溶液的配制与浓度比较》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp09.md（两者不一致以规格为准，先改规格再改这里）。
 * 本文件只导出**数据**（含纯工厂 createState），不含 IO / React / 随机数。
 *
 * 结构约定：
 * - 每步最后一个正确动作 completesStep: true（执行完进下一步）；
 * - 每个陷阱动作 role: "trap" + hazard（等级/扣分/规范条目/反馈文案见规格 §7）；
 * - 有 fx 的陷阱 → incident 事件（真实事故动画）；无 fx → violation 事件（文字+音效）；
 * - demoId 的步级 id 与规格 §6 最后一列逐字一致；动作级 id 按契约 §10 命名。
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
 * 初始器材/试剂状态
 * ------------------------------------------------------------------ */

const INITIAL_ENTITIES: Record<string, EntityState> = {
  "balance-1": { id: "balance-1", kind: "balance", reading: 0, note: "托盘天平，感量 0.1 g" },
  "beaker-100": { id: "beaker-100", kind: "beaker", note: "100 mL 烧杯（称量 NaOH）" },
  "beaker-400": { id: "beaker-400", kind: "beaker", note: "400 mL 烧杯（稀释浓盐酸）" },
  "poly-bottle-naoh": { id: "poly-bottle-naoh", kind: "volumetric", note: "500 mL 聚乙烯试剂瓶（NaOH）" },
  "poly-bottle-hcl": { id: "poly-bottle-hcl", kind: "volumetric", note: "500 mL 聚乙烯试剂瓶（HCl）" },
  "cylinder-10": { id: "cylinder-10", kind: "cylinder", note: "10 mL 量筒，0.1 mL 分度" },
  "burette-base": { id: "burette-base", kind: "burette", note: "碱式滴定管（橡胶管 + 玻璃珠）" },
  "burette-acid": { id: "burette-acid", kind: "burette", note: "酸式滴定管（玻璃活塞）" },
  "stand-1": { id: "stand-1", kind: "stand", note: "铁架台 + 滴定管夹" },
  "pipette-25": { id: "pipette-25", kind: "pipette", note: "25.00 mL 单标线移液管，A 级" },
  "cylinder-500": { id: "cylinder-500", kind: "cylinder", note: "500 mL 量筒，5 mL 分度" },
  "flask-1": { id: "flask-1", kind: "flask", note: "锥形瓶 1（250 mL）" },
  "flask-2": { id: "flask-2", kind: "flask", note: "锥形瓶 2（250 mL）" },
  "flask-3": { id: "flask-3", kind: "flask", note: "锥形瓶 3（250 mL）" },
  "wash-bottle": { id: "wash-bottle", kind: "wash", note: "蒸馏水洗瓶" },
  "white-plate": { id: "white-plate", kind: "stand", note: "白瓷板（终点衬底）" },
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
 * 构造小工具（只做数据拼装，不含判定语义）
 * ------------------------------------------------------------------ */

type CorrectExtra = Partial<Omit<ChoiceDefinition, "choiceId" | "type" | "label" | "demoId" | "competency" | "role">>;

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
  extra: { fx?: FxKey; incidentId?: string; terminate?: boolean } = {},
): ChoiceHazard {
  const out: ChoiceHazard = { ruleId, level, deduct, competency, terminate: extra.terminate ?? false, feedback };
  if (extra.fx !== undefined) out.fx = extra.fx;
  if (extra.incidentId !== undefined) out.incidentId = extra.incidentId;
  return out;
}

const P = (params: ActionParams): { params: ActionParams } => ({ params });
const H4 = "连续犯同类错误 3 次：先停下复述这一步的规范顺序（谁先谁后、用什么器皿），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6）
 * ------------------------------------------------------------------ */

/** 与规格 §6 最后一列逐字一致的 7 个步级 data-demo-id。 */
export const EXP09_STEP_DEMO_IDS: readonly string[] = [
  "exp09-step1-naoh",
  "exp09-step2-hcl",
  "exp09-step3-wash",
  "exp09-step4-fill",
  "exp09-step5-pipette",
  "exp09-step6-titrate",
  "exp09-step7-compute",
];

const step1: StepDefinition = {
  index: 0,
  title: "称 NaOH 配约 0.1 mol/L 溶液 500 mL",
  scene: "天平台 + 配液台",
  demoId: "exp09-step1-naoh",
  judge: {
    criterion: "固体全溶、溶液澄清无悬浮物；定容 500 mL；标签含名称/浓度/日期/姓名；瓶身为聚乙烯",
    competency: ["A1"],
    tolerance: { paramKey: "volume", expected: 500, unit: "mL", tolerance: 5 },
  },
  hints: {
    h0: "这一步出了安全问题：先别继续操作，想一想取用腐蚀性固体的规范。",
    h1: "称碱为什么要戴手套？",
    h2: "高亮手套与聚乙烯瓶图标：取用 NaOH 必须丁腈手套 + 药匙 + 在烧杯中称量。",
    h3: "演示药匙取用 → 快速称量 → 加蒸馏水溶解 → 冷却后定容 → 转入聚乙烯瓶贴标签。",
    h4: H4,
  },
  accepts: [
    "step1-weigh",
    "step1-dissolve",
    "step1-transfer",
    "step1-bare-hands-naoh",
    "step1-glass-stopper",
    "step1-hot-dissolve",
  ],
  choices: [
    correct(
      "step1-weigh",
      "weigh",
      "戴丁腈手套，用药匙在 100 mL 烧杯中快速称取 2.0 g NaOH",
      "demo-op-step1-weigh",
      "A1",
      {
        observation: { text: "称取 NaOH 2.0 g（托盘天平，感量 0.1 g）", value: 2 },
        entityPatch: { "balance-1": { reading: 2 }, "beaker-100": { note: "已称入 2.0 g NaOH" } },
      },
    ),
    correct(
      "step1-dissolve",
      "dissolve",
      "加约 200 mL 蒸馏水，玻璃棒搅拌至固体全部溶解",
      "demo-op-step1-dissolve",
      "A1",
      {
        observation: { text: "固体全部溶解，溶液澄清、无悬浮物", value: 200 },
        entityPatch: {
          "beaker-100": { liquid: { substance: "NaOH(aq)", level: 200, color: "#cfe3f5", opacity: 0.35 } },
        },
      },
    ),
    correct(
      "step1-transfer",
      "transfer",
      "冷却至室温后转入 500 mL 聚乙烯瓶，补蒸馏水至刻度，盖紧摇匀并贴标签",
      "demo-op-step1-transfer",
      "A1",
      {
        completesStep: true,
        requires: ["step1-weigh", "step1-dissolve"],
        observation: { text: "定容至 500 mL，转入聚乙烯瓶并贴标签（NaOH ≈ 0.1 mol/L，含日期/姓名）", value: 500 },
        entityPatch: {
          "poly-bottle-naoh": { liquid: { substance: "NaOH(aq)", level: 500, color: "#cfe3f5", opacity: 0.35 } },
          "beaker-100": { liquid: { substance: "NaOH(aq)", level: 0, color: "#cfe3f5", opacity: 0.2 } },
        },
        feedback: fb("info", "配液完成：聚乙烯瓶 + 标签", undefined, undefined, ["S003", "S008"]),
      },
    ),
    trap(
      "step1-bare-hands-naoh",
      "weigh",
      "徒手抓取 NaOH 固体，或称在称量纸上再倒入量筒",
      "demo-op-step1-bare-hands",
      "A1",
      hazard("exp09-H2", "L3", 10, "A1", fb(
        "danger",
        "NaOH 潮解皂化皮肤，滑腻灼痛",
        "NaOH 强吸湿，遇皮肤表面水分即溶解并皂化脂肪、同时放热，碱液向深层渗透持续损伤。",
        "药匙取用、戴丁腈手套、在烧杯中称量，称后立即密封试剂瓶。",
        ["S003"],
      ), { fx: "burn", incidentId: "exp09-H2" }),
    ),
    trap(
      "step1-glass-stopper",
      "transfer",
      "把配好的 NaOH 溶液装玻璃细口瓶并塞玻璃磨口塞",
      "demo-op-step1-glass-stopper",
      "A1",
      hazard("exp09-H10", "L2", 5, "A1", fb(
        "warn",
        "磨口被腐蚀黏结、瓶塞打不开，试剂报废",
        "NaOH 与玻璃中 SiO₂ 缓慢反应生成硅酸钠，磨口处黏结；长期存放还引入硅酸盐。",
        "存于聚乙烯瓶，橡胶塞/塑料螺纹盖，贴标签并注明日期。",
        ["S004", "S008"],
      )),
    ),
    trap(
      "step1-hot-dissolve",
      "dilute",
      "用热水加速溶解，未冷却即定容至刻度",
      "demo-op-step1-hot-dissolve",
      "A1",
      hazard("exp09-H9", "L2", 5, "A1", fb(
        "warn",
        "热液冷却后体积收缩，c 偏低约 1%",
        "水的体膨胀系数约 2×10⁻⁴ K⁻¹，20→60 ℃ 体积增大约 1.6%，冷却后液面低于刻度。",
        "冷却至室温后再定容（可水浴冷却烧杯外壁，不骤冷）。",
        ["S004"],
      )),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "量浓盐酸配约 0.1 mol/L 溶液 500 mL",
  scene: "通风橱内",
  demoId: "exp09-step2-hcl",
  judge: {
    criterion: "加酸过程无可见酸雾逸出、液温 ≤40 ℃；标签完整；ρ 与 w 抄自瓶标并记录",
    competency: ["A1", "K1"],
    tolerance: { paramKey: "volume", expected: 500, unit: "mL", tolerance: 5 },
  },
  hints: {
    h0: "这一步出了安全事故：先停手，回忆稀释浓盐酸的先后顺序。",
    h1: "谁倒进谁里？",
    h2: "高亮“酸入水”箭头与通风橱图标：酸沿壁缓缓注入水中，边加边搅拌。",
    h3: "演示：通风橱内先加水 → 量酸 → 沿壁注入并搅拌 → 冷却后转移定容。",
    h4: H4,
  },
  accepts: [
    "step2-add-water",
    "step2-measure-acid",
    "step2-add-acid",
    "step2-transfer",
    "step2-water-into-acid",
  ],
  choices: [
    correct(
      "step2-add-water",
      "observe",
      "戴护目镜 + 丁腈手套，在通风橱内先向 400 mL 烧杯加约 300 mL 蒸馏水",
      "demo-op-step2-add-water",
      "A1",
      {
        observation: { text: "通风橱内，400 mL 烧杯已加约 300 mL 蒸馏水", value: 300 },
        entityPatch: {
          "beaker-400": { liquid: { substance: "蒸馏水", level: 300, color: "#dcecf7", opacity: 0.3 } },
        },
      },
    ),
    correct(
      "step2-measure-acid",
      "readInstrument",
      "用 10 mL 量筒量取 4.2 mL 浓盐酸，抄录瓶标 ρ=1.19 g/mL、w=37%",
      "demo-op-step2-measure-acid",
      "A1",
      {
        ...P({ volume: 4.2, density: 1.19, massFraction: 0.37 }),
        observation: { text: "量取浓盐酸 4.2 mL（瓶标 ρ=1.19 g/mL，w=37%，c≈12 mol/L）", value: 4.2 },
      },
    ),
    correct(
      "step2-add-acid",
      "dilute",
      "沿烧杯内壁缓缓将浓盐酸注入水中，边加边搅拌",
      "demo-op-step2-add-acid",
      "K1",
      {
        observation: { text: "酸沿壁注入水中并搅拌，无酸雾逸出，液温 ≤40 ℃", value: 40 },
        entityPatch: {
          "beaker-400": { liquid: { substance: "HCl(aq)", level: 304, color: "#e7f0f8", opacity: 0.28 } },
        },
      },
    ),
    correct(
      "step2-transfer",
      "transfer",
      "冷却至室温后转入 500 mL 聚乙烯瓶，补蒸馏水至 500 mL，摇匀贴标签",
      "demo-op-step2-transfer",
      "K1",
      {
        completesStep: true,
        requires: ["step2-add-water", "step2-measure-acid", "step2-add-acid"],
        observation: { text: "定容至 500 mL，转入聚乙烯瓶并贴标签（HCl ≈ 0.1 mol/L）", value: 500 },
        entityPatch: {
          "poly-bottle-hcl": { liquid: { substance: "HCl(aq)", level: 500, color: "#e7f0f8", opacity: 0.28 } },
        },
        feedback: fb("info", "配酸完成：酸入水 + 通风橱 + 聚乙烯瓶", undefined, undefined, ["S003"]),
      },
    ),
    trap(
      "step2-water-into-acid",
      "dilute",
      "把水沿烧杯内壁缓缓倒入盛有浓盐酸的烧杯，并俯身观察",
      "demo-op-step2-water-into-acid",
      "A1",
      hazard("exp09-H1", "L4", 20, "A1", fb(
        "danger",
        "水入酸：溶解热集中使局部过热，酸雾与热液喷溅",
        "浓盐酸 ρ=1.19 g/mL > 水，水浮于酸面；HCl 溶解热约 −75 kJ/mol 集中在水层，局部瞬间过热并促使 HCl 急剧逸出；俯身使高浓度酸雾直冲面部。",
        "通风橱内、护目镜 + 手套，先加水后加酸，酸沿壁缓缓注入水中并搅拌，冷却后再转移。",
        ["S003", "S010"],
      ), { fx: "boil-over", incidentId: "exp09-H1", terminate: true }),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "滴定管检漏、洗涤与润洗",
  scene: "滴定台",
  demoId: "exp09-step3-wash",
  judge: {
    criterion: "内壁形成均匀水膜、不挂水珠；活塞转动灵活、橡胶管无老化裂纹；尖嘴通畅",
    competency: ["S1"],
  },
  hints: {
    h0: "润洗不到位会让后面三次数据同时作废，先想清楚洗涤顺序。",
    h1: "内壁挂水珠吗？",
    h2: "高亮“润洗 3 次”动画：自来水 → 蒸馏水 3 次 → 待装液 3 次。",
    h3: "演示转动使内壁全部润湿、每次约 5 mL、由管尖放出。",
    h4: H4,
  },
  accepts: ["step3-inspect", "step3-wash", "step3-rinse", "step3-tap-water-only"],
  choices: [
    correct(
      "step3-inspect",
      "observe",
      "对光检查管壁与尖嘴有无裂纹，试转活塞、捏放玻璃珠看是否灵活漏液",
      "demo-op-step3-inspect",
      "S1",
      { observation: { text: "管壁与尖嘴无裂纹，活塞/玻璃珠灵活不漏液" }, entityPatch: { "burette-base": { note: "已检漏，完好" } } },
    ),
    correct(
      "step3-wash",
      "wash",
      "洗洁精刷洗 → 自来水冲净 → 蒸馏水淋洗 3 次",
      "demo-op-step3-wash",
      "S1",
      { observation: { text: "内壁不挂水珠，蒸馏水淋洗 3 次完成" }, entityPatch: { "burette-base": { note: "已洗涤（自来水 + 蒸馏水 3 次）" } } },
    ),
    correct(
      "step3-rinse",
      "wash",
      "用待装液润洗 3 次、每次约 5 mL，转动全润湿后由管尖放出",
      "demo-op-step3-rinse",
      "S1",
      {
        completesStep: true,
        requires: ["step3-inspect", "step3-wash"],
        observation: { text: "待装液润洗 3 次完成，内壁水膜均匀", value: 15 },
        entityPatch: { "burette-base": { note: "已用待装液润洗 3 次" } },
      },
    ),
    trap(
      "step3-tap-water-only",
      "wash",
      "只用自来水冲一遍即装液，不作润洗",
      "demo-op-step3-tap-water-only",
      "S1",
      hazard("exp09-H5", "L2", 5, "S1", fb(
        "warn",
        "内壁残留水膜稀释溶液，消耗体积偏大 0.3%~0.8%",
        "残留水膜稀释装入的溶液，实际浓度低于标称值，三次数据同时作废。",
        "洗洁精 + 自来水 → 蒸馏水淋洗 3 次 → 待装液润洗 3 次（每次约 5 mL）。",
        ["S004"],
      )),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "装液、排气泡、调零",
  scene: "滴定台",
  demoId: "exp09-step4-fill",
  judge: {
    criterion: "尖嘴无气泡、液面在 0.00 mL；初读数记到 0.01 mL；滴定管稳固不晃动",
    competency: ["S1", "K2"],
    tolerance: { paramKey: "initialReading", expected: 0, unit: "mL", tolerance: 0.02 },
  },
  hints: {
    h0: "装液这一步出错，后面所有读数都不可信。",
    h1: "尖嘴里有气泡吗？",
    h2: "高亮排气泡放液路径：装至零刻度上方，管尖朝下快速放液冲出气泡。",
    h3: "演示“碱用碱式管、酸用酸式管”与垂直夹持、管尖入瓶口 2~3 cm。",
    h4: H4,
  },
  accepts: [
    "step4-clamp",
    "step4-fill",
    "step4-zero",
    "step4-skip-bubble",
    "step4-naoh-in-acid-burette",
    "step4-hold-burette-tilted",
  ],
  choices: [
    correct(
      "step4-clamp",
      "assemble",
      "滴定管垂直夹于铁架台，管尖伸入锥形瓶口内 2~3 cm",
      "demo-op-step4-clamp",
      "S1",
      { observation: { text: "滴定管垂直稳固夹持，管尖伸入瓶口 2~3 cm" }, entityPatch: { "burette-base": { note: "已垂直夹持" } } },
    ),
    correct(
      "step4-fill",
      "titrate",
      "装液至零刻度上方，管尖朝下快速放液冲出尖嘴气泡",
      "demo-op-step4-fill",
      "S1",
      {
        observation: { text: "尖嘴气泡已排尽，液面在零刻度上方" },
        entityPatch: {
          "burette-base": { liquid: { substance: "NaOH(aq)", level: 50, color: "#cfe3f5", opacity: 0.35 }, bubbles: false },
        },
      },
    ),
    correct(
      "step4-zero",
      "readInstrument",
      "调液面至 0.00 mL 并读初读数，记到 0.01 mL",
      "demo-op-step4-zero",
      "K2",
      {
        completesStep: true,
        requires: ["step4-clamp", "step4-fill"],
        ...P({ initialReading: 0 }),
        observation: { text: "初读数 0.00 mL（估读到 0.01 mL，两位小数）", value: 0 },
        entityPatch: { "burette-base": { reading: 0, note: "液面已调至 0.00 mL" } },
      },
    ),
    trap(
      "step4-skip-bubble",
      "titrate",
      "气泡未排尽就调零开始滴定",
      "demo-op-step4-skip-bubble",
      "S1",
      hazard("exp09-H6", "L2", 5, "S1", fb(
        "warn",
        "气泡逸出致液面突降，读数跳变 0.05~0.3 mL",
        "气泡占据刻度体积，滴定中逸出使液面突降，终读数与真实放液量不符，该次数据不可用。",
        "装液至零刻度上方，管尖朝下快速放液冲出气泡，再调至 0.00 mL。",
        ["S004"],
      )),
    ),
    trap(
      "step4-naoh-in-acid-burette",
      "assemble",
      "把 NaOH 溶液装入酸式（玻璃活塞）滴定管，活塞发涩后强行扭转",
      "demo-op-step4-naoh-in-acid-burette",
      "S1",
      hazard("exp09-H3", "L3", 9, "S1", fb(
        "danger",
        "磨口被碱腐蚀黏结，强拧致活塞折断、管身崩裂",
        "2NaOH + SiO₂ → Na₂SiO₃ + H₂O，磨口玻璃被腐蚀生成硅酸钠而黏结；强行扭转使活塞柄折断、管身应力集中崩裂。",
        "碱液一律用碱式滴定管（橡胶管 + 玻璃珠），酸液用酸式滴定管；活塞发涩先查明原因不硬拧。",
        ["S004"],
      ), { fx: "glass-break", incidentId: "exp09-H3" }),
    ),
    trap(
      "step4-hold-burette-tilted",
      "assemble",
      "手持滴定管倾斜排气泡，或管夹未夹紧",
      "demo-op-step4-hold-burette-tilted",
      "S1",
      hazard("exp09-H4", "L3", 8, "S1", fb(
        "danger",
        "滴定管跌落，试液与玻璃碎片飞溅",
        "50 mL 滴定管装液后重心高、管壁薄，一旦脱手即自由落体。",
        "滴定管垂直夹在铁架台，管尖伸入瓶口 2~3 cm，全程不手持操作。",
        ["S004", "S009"],
      ), { fx: "device-accident", incidentId: "exp09-H4" }),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "移取 HCl 并加指示剂",
  scene: "滴定台",
  demoId: "exp09-step5-pipette",
  judge: {
    criterion: "放出体积 25.00 ±0.03 mL；锥形瓶内溶液无色透明；指示剂 2 滴",
    competency: ["S2", "K2"],
    tolerance: { paramKey: "volume", expected: 25, unit: "mL", tolerance: 0.03 },
  },
  hints: {
    h0: "移取体积不准，浓度比会系统性偏差。",
    h1: "润洗了吗？停留够 15 s 了吗？",
    h2: "高亮润洗与“停留 15 s”：润洗 3 次、自然流尽、不吹残液。",
    h3: "演示“2 滴刚好、多了色深难判”，以及凹液面与 25.00 mL 相切。",
    h4: H4,
  },
  accepts: [
    "step5-rinse-pipette",
    "step5-pipette",
    "step5-indicator",
    "step5-skip-rinse",
    "step5-excess-indicator",
  ],
  choices: [
    correct(
      "step5-rinse-pipette",
      "wash",
      "移液管用蒸馏水洗净后，用待移取 HCl 润洗 3 次",
      "demo-op-step5-rinse-pipette",
      "S2",
      { observation: { text: "移液管已用待移取 HCl 润洗 3 次" }, entityPatch: { "pipette-25": { note: "已润洗 3 次" } } },
    ),
    correct(
      "step5-pipette",
      "transfer",
      "洗耳球吸液至刻度上方，调至凹液面与 25.00 mL 相切，管尖靠瓶内壁自然流下、停留 15 s",
      "demo-op-step5-pipette",
      "S2",
      {
        ...P({ volume: 25, waitSeconds: 15 }),
        observation: { text: "移取 HCl 25.00 mL，自然流尽并停留 15 s", value: 25 },
        entityPatch: {
          "flask-1": { liquid: { substance: "HCl(aq)", level: 25, color: "#e7f0f8", opacity: 0.25 } },
        },
      },
    ),
    correct(
      "step5-indicator",
      "addDrops",
      "加 2 滴酚酞，轻摇锥形瓶使混匀",
      "demo-op-step5-indicator",
      "S2",
      {
        completesStep: true,
        requires: ["step5-rinse-pipette", "step5-pipette"],
        ...P({ drops: 2, indicator: "phenolphthalein" }),
        observation: { text: "加入 2 滴酚酞（约 0.05~0.1 mL），溶液无色透明", value: 2 },
        entityPatch: { "flask-1": { note: "已加 2 滴酚酞" } },
      },
    ),
    trap(
      "step5-skip-rinse",
      "transfer",
      "不润洗直接用，或把管尖残液吹入锥形瓶",
      "demo-op-step5-skip-rinse",
      "S2",
      hazard("exp09-H7", "L2", 5, "S2", fb(
        "warn",
        "移取体积偏差 0.1%~0.2%，c(HCl) 偏低",
        "不润洗时残留水稀释试液使 c 偏低；吹残液则多放出 0.02~0.05 mL（A 级移液管已按“自然流尽”校准）。",
        "润洗 3 次；自然流尽后停留 15 s 取出，绝不吹。",
        ["S007"],
      )),
    ),
    trap(
      "step5-excess-indicator",
      "addDrops",
      "加 5~6 滴酚酞使颜色明显加深",
      "demo-op-step5-excess-indicator",
      "S2",
      hazard("exp09-H11", "L1", 3, "S2", fb(
        "warn",
        "指示剂耗碱且色深，终点提前 0.02~0.05 mL",
        "指示剂本身是弱酸、消耗少量碱；且颜色过深使终点变色不敏锐。",
        "2 滴（约 0.05~0.1 mL）即可，颜色过深须重取。",
        ["S005"],
      )),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "滴定至终点",
  scene: "滴定台",
  demoId: "exp09-step6-titrate",
  judge: {
    criterion: "终点为浅粉红、30 s 不褪；消耗体积与参考值偏差 ≤0.5%；无成股液流",
    competency: ["S2", "K1"],
    tolerance: { paramKey: "volume", expected: 25.2, unit: "mL", tolerance: 0.13 },
  },
  hints: {
    h0: "终点判早了或判晚了，这次数据就废了。",
    h1: "颜色变粉了吗？30 s 后还粉吗？",
    h2: "高亮“半滴 + 吹下 + 摇匀”，并提示衬白瓷板比色。",
    h3: "演示 30 s 计时、先快后慢、近终点逐滴/半滴加入。",
    h4: H4,
  },
  accepts: [
    "step6-titrate-fast",
    "step6-half-drop",
    "step6-read-end",
    "step6-line-flow",
    "step6-over-titrate",
  ],
  choices: [
    correct(
      "step6-titrate-fast",
      "titrate",
      "左手控制活塞或捏放玻璃珠，右手旋摇锥形瓶，先快后慢，近终点逐滴加入",
      "demo-op-step6-titrate-fast",
      "S2",
      { observation: { text: "滴定至近终点，锥形瓶内呈浅粉色（尚可褪去）" } },
    ),
    correct(
      "step6-half-drop",
      "addDrops",
      "终点前改用半滴：管尖靠瓶内壁，用洗瓶吹下，摇匀",
      "demo-op-step6-half-drop",
      "S2",
      {
        ...P({ drops: 0.5 }),
        observation: { text: "半滴加入并吹下摇匀，颜色转为浅粉红", value: 0.5 },
      },
    ),
    correct(
      "step6-read-end",
      "readInstrument",
      "粉红色 30 s 不褪即为终点，立即读终读数并记到 0.01 mL",
      "demo-op-step6-read-end",
      "K1",
      {
        completesStep: true,
        requires: ["step6-titrate-fast", "step6-half-drop"],
        ...P({ finalReading: 25.18, holdSeconds: 30 }),
        observation: { text: "终点读数 25.18 mL，浅粉红保持 30 s 不褪", value: 25.18 },
        entityPatch: {
          "burette-base": { reading: 25.18 },
          "flask-1": { liquid: { substance: "NaCl(aq)", level: 50, color: "#f6d7de", opacity: 0.3 } },
        },
      },
    ),
    trap(
      "step6-line-flow",
      "titrate",
      "开大流量成线流，摇动跟不上",
      "demo-op-step6-line-flow",
      "S2",
      hazard("exp09-H12", "L1", 3, "S2", fb(
        "warn",
        "局部过量致提前变色，读数偏高 0.05~0.2 mL",
        "局部 NaOH 过量使 pH 骤升、指示剂提前变色，摇匀后又褪去，终点反复、判断困难。",
        "先快后慢，近终点逐滴、半滴加入，边加边旋摇。",
        ["S005"],
      )),
    ),
    trap(
      "step6-over-titrate",
      "titrate",
      "溶液已呈深红色仍继续滴加",
      "demo-op-step6-over-titrate",
      "S2",
      hazard("exp09-H8", "L2", 5, "S2", fb(
        "warn",
        "滴定过量，V(NaOH) 偏大 ≥0.1 mL，本次数据作废",
        "超过化学计量点后过量 NaOH 使酚酞深度显色，V(NaOH) 系统性偏大。",
        "近终点半滴/四分之一滴加入，摇匀至浅粉红 30 s 不褪即停。",
        ["S005"],
      )),
    ),
  ],
};

const step7: StepDefinition = {
  index: 6,
  title: "平行测定与浓度比计算",
  scene: "滴定台 + 计算台",
  demoId: "exp09-step7-compute",
  judge: {
    criterion: "三次平行相对极差 ≤0.2%；浓度比与参考值偏差 ≤0.5%；原始读数三次齐全",
    competency: ["K1", "K2"],
    tolerance: { paramKey: "relativeRange", expected: 0, unit: "%", tolerance: 0.2 },
  },
  hints: {
    h0: "数据完整性/公式方向错了，报告分会被扣。",
    h1: "谁除以谁？",
    h2: "高亮公式 c₁V₁ = c₂V₂ 的变量对应：c(NaOH)/c(HCl) = V(HCl)/V(NaOH)。",
    h3: "演示“体积比 → 取倒数 → 浓度比”，并核对“浓度大的那方消耗体积小”。",
    h4: H4,
  },
  accepts: [
    "step7-repeat",
    "step7-record",
    "step7-compute",
    "step7-single-trial",
    "step7-inverted-ratio",
  ],
  choices: [
    correct(
      "step7-repeat",
      "titrate",
      // 这一步是「平行测定」：把滴定重复到 3 次，不是回到第 5 步。
      // 原文案「重复步 5~6 共 3 次」读起来像在描述别的步骤（红队 2026-10-22 报）。
      // 再改一次（用户 2026-10-22）：只写「再滴定 2 次」和第 7 步标题「平行测定与浓度比计算」对不上，
      // 补上「补齐 3 次平行」这个目的，并点明后面还要记录与计算。
      "补齐 3 次平行滴定（当前 1 次），每次记初/终读数",
      "demo-op-step7-repeat",
      "K2",
      { ...P({ trials: 3 }), observation: { text: "三次平行滴定完成（消耗 25.18 / 25.22 / 25.20 mL）", value: 3 } },
    ),
    correct(
      "step7-record",
      "readInstrument",
      "如实记录三次初/终读数，平均消耗体积与极差",
      "demo-op-step7-record",
      "K2",
      {
        ...P({ meanVolume: 25.2, range: 0.04 }),
        observation: { text: "平均消耗 V̄(NaOH)=25.20 mL，极差 0.04 mL，相对极差 0.16%", value: 25.2 },
      },
    ),
    correct(
      "step7-compute",
      "compute",
      "按 c(NaOH)/c(HCl) = V(HCl)/V(NaOH) 求浓度比，并算平均体积与相对极差",
      "demo-op-step7-compute",
      "K1",
      {
        completesStep: true,
        requires: ["step7-repeat", "step7-record"],
        ...P({ ratio: 0.992, relativeRange: 0.16 }),
        observation: { text: "浓度比 c(NaOH)/c(HCl) = 25.00 ÷ 25.20 = 0.992，相对极差 0.16% ≤0.2%", value: 0.992 },
      },
    ),
    trap(
      "step7-single-trial",
      "compute",
      "只做 1 次平行测定就取平均值",
      "demo-op-step7-single-trial",
      "K2",
      hazard("exp09-H13", "L1", 3, "K2", fb(
        "warn",
        "无法估计随机误差，数据完整性扣分",
        "单次测定无法估计随机误差，读数偶然误差不可发现。",
        "平行测定 3 次，相对极差 ≤0.2%。",
        ["S005"],
      )),
    ),
    trap(
      "step7-inverted-ratio",
      "compute",
      "把浓度比写成 V(NaOH)/V(HCl)，直接拿体积比当浓度比",
      "demo-op-step7-inverted-ratio",
      "K1",
      hazard("exp09-H14", "L1", 3, "K1", fb(
        "warn",
        "比值取倒数，与参考值差约 1.6%",
        "由 c(碱)·V(碱) = c(酸)·V(酸) 得 c(碱)/c(酸) = V(酸)/V(碱)，是倒数关系。",
        "先写公式再代数，代入后检查“浓度大的那方消耗体积小”是否成立。",
        ["S005"],
      )),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp09Definition: ExperimentDefinition = {
  id: "exp09",
  title: "酸碱标准溶液的配制与浓度比较",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5, step6, step7],
  createState: (): ExperimentState => ({
    expId: "exp09",
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

export default exp09Definition;
