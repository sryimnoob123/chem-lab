/**
 * experiments/exp08/definition.ts —— 实验 08《清点仪器，分析天平称量练习》机器可执行定义。
 *
 * 唯一权威：docs/实验库/exp08.md。本文件只导出数据，不含 IO / React / 随机数。
 * 步骤、选项、判据与陷阱文案逐条来自规格 §6 / §7；线索（hints）来自规格 §6 最后一列。
 *
 * 场景说明：exp08 暂复用现有分析天平 / 烧杯 / 试剂素材，不新增 SVG；
 * 场景精修由后续轨道替换，定义层不依赖场景实现。
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
    note: "半自动电光分析天平，Max 200 g，分度值 0.1 mg",
  },
  "weigh-bottle": { id: "weigh-bottle", kind: "beaker", note: "扁形称量瓶 40 × 25 mm，磨口盖配套" },
  "beaker-100": { id: "beaker-100", kind: "beaker", note: "100 mL 烧杯（接收递减试样）" },
  "reagent-bottle": {
    id: "reagent-bottle",
    kind: "volumetric",
    note: "NaCl 试剂瓶，约 500 g；整瓶上秤即超载",
  },
  desiccator: { id: "desiccator", kind: "stand", note: "干燥器，内装变色硅胶" },
  "weigh-paper": { id: "weigh-paper", kind: "beaker", note: "折角称量纸（固定质量法）" },
  "brush-1": { id: "brush-1", kind: "wash", note: "软毛刷（清扫秤盘与天平箱）" },
  "record-book": { id: "record-book", kind: "stand", note: "原始记录本，不溶性墨水笔" },
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
 * 构造小工具（与 exp01 / exp09 同构）
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
const H4 = "连续犯同类错误 3 次：先停下复述这一步的天平操作顺序（调平—预热—校准—读数），再重做这一步。";

/* ------------------------------------------------------------------ *
 * 步骤定义（规格 §6）
 * ------------------------------------------------------------------ */

export const EXP08_STEP_DEMO_IDS: readonly string[] = [
  "exp08-step1-inventory",
  "exp08-step2-structure",
  "exp08-step3-calibrate",
  "exp08-step4-fixed-mass",
  "exp08-step5-decrement",
  "exp08-step6-record",
  "exp08-step7-restore",
];

const step1: StepDefinition = {
  index: 0,
  title: "清点认领仪器",
  scene: "天平室入口：认领台 + 清点清单",
  demoId: "exp08-step1-inventory",
  judge: {
    criterion: "清单件数与实物一致；称量瓶 1 只、盖配套、内壁无水珠；硅胶为蓝色",
    competency: ["S2", "A1"],
  },
  hints: {
    h0: "盖子和瓶子对得上吗？先看磨口配合面，再看内壁有没有水珠。",
    h1: "盖子和瓶子对得上吗？",
    h2: "高亮磨口配合面与干燥器里的硅胶颜色：蓝色可用，粉红须换。",
    h3: "演示“开盖—对号—盖回”，再逐项打勾件数、规格、配套。",
    h4: H4,
  },
  accepts: ["step1-bottle", "step1-silica", "step1-sign", "step1-count", "step1-broken"],
  choices: [
    correct(
      "step1-bottle",
      "observe",
      "逐件检查称量瓶是否洁净、干燥、磨口盖配套",
      "demo-op-step1-bottle",
      "S2",
      { observation: { text: "称量瓶 1 只、磨口盖配套、内壁无水珠" } },
    ),
    correct(
      "step1-silica",
      "observe",
      "看干燥器内变色硅胶：蓝色可用、粉红须换",
      "demo-op-step1-silica",
      "A1",
      { observation: { text: "干燥器内变色硅胶呈蓝色，可继续使用" } },
    ),
    correct(
      "step1-sign",
      "observe",
      "按认领清单逐件核对名称/规格/数量，登记编号并签字",
      "demo-op-step1-sign",
      "S2",
      {
        completesStep: true,
        requires: ["step1-bottle", "step1-silica"],
        ...P({ count: 13 }),
        observation: { text: "13 件器皿名称/规格/数量一致；称量瓶盖配套、内壁无水珠；硅胶蓝色" },
        feedback: fb("info", "清点完成：件数、规格、配套三项逐项打勾并签字", undefined, undefined, ["S001"]),
      },
    ),
    trap(
      "step1-count",
      "observe",
      "只数件数、不看规格与配套，直接签字",
      "demo-op-step1-count",
      "A1",
      hazard(
        "exp08-H9",
        "L1",
        2,
        "A1",
        fb(
          "warn",
          "缺件、错件事后无法追责，后续返工重领",
          "认领即责任移交；只数件数会漏掉规格错、缺盖与裂口，后续实验缺件停摆。",
          "件数、规格、配套三项逐项打勾后再签字。",
          ["S001"],
        ),
      ),
    ),
    trap(
      "step1-broken",
      "observe",
      "把缺盖或口沿有裂口的称量瓶混入合格件继续用",
      "demo-op-step1-broken",
      "S2",
      hazard(
        "exp08-H7",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "无盖称量瓶吸潮，递减法 m₂ 偏大、差减值偏小",
          "磨口不配套则密封失效，试样持续吸潮；m₂ 偏大使 m₁ − m₂ 系统性偏小 0.5~2 mg，三份一致性丧失。",
          "认领时逐件对号，缺盖/裂口当场更换；蓝色硅胶才可用。",
          ["S005"],
        ),
      ),
    ),
  ],
};

const step2: StepDefinition = {
  index: 1,
  title: "分析天平的构造认知",
  scene: "天平前",
  demoId: "exp08-step2-structure",
  judge: {
    criterion: "八个部件全部指认正确；铭牌参数已抄录；全程手不触刀刃与吊耳",
    competency: ["K1", "A1"],
  },
  hints: {
    h0: "天平最怕碰哪里？刀口与吊耳是精度基准，只能看、不能摸。",
    h1: "天平最怕碰哪里？",
    h2: "高亮刀口与吊耳的红圈：只碰底座和侧门把手。",
    h3: "演示“指认八部件—抄铭牌”，全程不动横梁与加码杆。",
    h4: H4,
  },
  accepts: ["step2-structure", "step2-nameplate", "step2-touch", "step2-carriage"],
  choices: [
    correct(
      "step2-structure",
      "observe",
      "对照结构图指认横梁、三棱刀口、立柱、阻尼器、秤盘、环砝码与加码杆、光学投影屏、水平泡与地脚螺栓",
      "demo-op-step2-structure",
      "K1",
      { observation: { text: "八个部件全部指认正确，能说出各自作用" } },
    ),
    correct(
      "step2-nameplate",
      "observe",
      "抄录铭牌上的最大载荷 200 g 与分度值 0.1 mg 进记录本",
      "demo-op-step2-nameplate",
      "A1",
      {
        completesStep: true,
        requires: ["step2-structure"],
        ...P({ maxLoad: 200, resolution: 0.0001 }),
        observation: { text: "铭牌：Max 200 g，d = 0.1 mg，已抄入记录本" },
        feedback: fb("info", "构造认知完成：八部件 + 铭牌参数", undefined, undefined, ["S003"]),
      },
    ),
    trap(
      "step2-touch",
      "observe",
      "用手指触摸、拨动刀口和吊耳，或抓着横梁把天平挪位",
      "demo-op-step2-touch",
      "A1",
      hazard(
        "exp08-H2",
        "L3",
        8,
        "A1",
        fb(
          "danger",
          "刀口崩缺、横梁变形，精度由 0.1 mg 劣化到 mg 级",
          "刀口是玛瑙/宝石材质，刃口半径仅微米级；指纹油污改变摩擦，磕碰造成缺口，横梁受力即变形。",
          "只接触底座、侧门把手与加码旋钮；搬动必须由教师整机托底。",
          ["S003"],
        ),
        { fx: "device-accident", incidentId: "exp08-H2" },
      ),
    ),
    trap(
      "step2-carriage",
      "observe",
      "为“看仔细”反复旋动加码杆、反复升降横梁",
      "demo-op-step2-carriage",
      "K1",
      hazard(
        "exp08-H14",
        "L1",
        2,
        "K1",
        fb(
          "warn",
          "环砝码挂钩错位，示值带固定偏差",
          "环砝码靠加码杆挂钩定位，反复加减易使挂钩错位、砝码落座不正，示值带 1~10 mg 固定偏差且不易察觉。",
          "构造认知只看不动；加码操作按“先大后小、逐级加减”。",
          ["S003"],
        ),
      ),
    ),
  ],
};

const step3: StepDefinition = {
  index: 2,
  title: "调平、预热与校准",
  scene: "天平前",
  demoId: "exp08-step3-calibrate",
  judge: {
    criterion: "水平泡居中；预热 ≥30 min；空载 0.0000 g 且漂移 ≤0.0002 g；回测偏差 ≤0.0002 g",
    competency: ["K1", "S1"],
  },
  hints: {
    h0: "水平泡在哪、圆不圆？先调平，再预热，最后校准。",
    h1: "水平泡在哪、圆不圆？",
    h2: "高亮地脚螺栓与投影屏零线：先调平、再预热、后校准、末回测。",
    h3: "演示调地脚螺栓使泡居中，开机 ≥30 min，内校后回零，再用 100 g 砝码回测。",
    h4: H4,
  },
  accepts: ["step3-level", "step3-preheat", "step3-zero", "step3-half-level", "step3-skip-cal"],
  choices: [
    correct(
      "step3-level",
      "calibrate",
      "旋转地脚螺栓，使水平泡居中",
      "demo-op-step3-level",
      "S1",
      { observation: { text: "水平泡居中，天平已调平" } },
    ),
    correct(
      "step3-preheat",
      "calibrate",
      "接通电源预热 ≥30 min，按校准键做内校，校后回零",
      "demo-op-step3-preheat",
      "S1",
      {
        requires: ["step3-level"],
        observation: { text: "预热 30 min，内校完成并回零" },
        entityPatch: { "balance-1": { reading: 0, note: "已预热 30 min，内校后空载回零" } },
      },
    ),
    correct(
      "step3-zero",
      "readInstrument",
      "确认空载示数 0.0000 g（10 s 漂移 ≤0.0002 g），再用 E2 级 100 g 砝码回测",
      "demo-op-step3-zero",
      "K1",
      {
        completesStep: true,
        requires: ["step3-level", "step3-preheat"],
        ...P({ mass: 100.0002 }),
        observation: { text: "空载 0.0000 g；100 g 砝码回测 100.0002 g，偏差 ≤0.0002 g" },
        entityPatch: { "balance-1": { reading: 0, note: "空载 0.0000 g，100 g 回测 100.0002 g" } },
        feedback: fb("info", "校准完成：调平—预热—内校—回零—砝码回测", undefined, undefined, ["S003"]),
      },
    ),
    trap(
      "step3-half-level",
      "calibrate",
      "水平泡偏半格，觉得“差不多”就开始称",
      "demo-op-step3-half-level",
      "S1",
      hazard(
        "exp08-H10",
        "L1",
        2,
        "S1",
        fb(
          "warn",
          "单盘受力，示数带 0.5~2 mg 系统偏差",
          "水平泡偏半格时秤盘与重力不垂直，等臂杠杆单盘受力不均，示数带 0.5~2 mg 系统偏差，且随放置位置变化。",
          "调地脚螺栓至水平泡完全居中，再预热、内校、回零。",
          ["S003"],
        ),
      ),
    ),
    trap(
      "step3-skip-cal",
      "calibrate",
      "跳过预热与校准，沿用上一位同学留下的零点",
      "demo-op-step3-skip-cal",
      "K1",
      hazard(
        "exp08-H11",
        "L1",
        3,
        "K1",
        fb(
          "warn",
          "零点漂移未消除，全部称量同向偏移 0.5~1 mg",
          "电子元件与灯泡未达热平衡，零点随温度漂移；沿用别人的零点会把系统偏差带进全部数据。",
          "预热 ≥30 min，内校后回零，并用 100 g 砝码回测。",
          ["S003"],
        ),
      ),
    ),
  ],
};

const step4: StepDefinition = {
  index: 3,
  title: "固定质量称量 0.5000 g NaCl",
  scene: "天平前",
  demoId: "exp08-step4-fixed-mass",
  judge: {
    criterion: "示数 0.4998~0.5002 g；10 s 内变化 ≤0.0002 g；称量纸完好、试样未洒落、秤盘无残留",
    competency: ["S2", "K2", "A1"],
    tolerance: { paramKey: "mass", expected: 0.5, unit: "g", tolerance: 0.0002 },
  },
  hints: {
    h0: "铭牌上的 Max 是多少？整瓶试剂直接上秤就是超载。",
    h1: "铭牌上的 Max 是多少？",
    h2: "高亮 200 g 与“整瓶≈500 g”的对比条：一律用药匙取样、纸上称量。",
    h3: "演示“折角称量纸—清零—先加约 0.45 g—轻敲补加—超量弃回收瓶”。",
    h4: H4,
  },
  accepts: ["step4-paper", "step4-add", "step4-adjust", "step4-bottle", "step4-direct"],
  choices: [
    correct(
      "step4-paper",
      "weigh",
      "把折角的称量纸（或表面皿）放在秤盘中央，关侧门，待示数稳定后清零",
      "demo-op-step4-paper",
      "S2",
      {
        observation: { text: "称量纸折角置秤盘中央，关侧门，示数稳定后清零" },
        entityPatch: { "balance-1": { reading: 0, note: "称量纸已清零" } },
      },
    ),
    correct(
      "step4-add",
      "weigh",
      "用药匙先加约 0.45 g，再轻敲药匙腕部逐点补加，示数稳定 10 s 后读数",
      "demo-op-step4-add",
      "S2",
      {
        requires: ["step4-paper"],
        ...P({ mass: 0.4500 }),
        observation: { text: "先加约 0.45 g，再逐点补加，示数稳定 10 s" },
        entityPatch: { "balance-1": { reading: 0.45 } },
      },
    ),
    correct(
      "step4-adjust",
      "weigh",
      "超出允差时取出多余试样弃入回收瓶，重新补加至 0.4998~0.5002 g",
      "demo-op-step4-adjust",
      "K2",
      {
        completesStep: true,
        requires: ["step4-paper", "step4-add"],
        ...P({ mass: 0.5001 }),
        observation: { text: "实称 0.5001 g，Δm = +0.0001 g，相对误差 0.02%" },
        entityPatch: { "balance-1": { reading: 0.5001, note: "固定质量 0.5001 g" } },
        feedback: fb("info", "固定质量法完成：0.5001 g，偏差 +0.0001 g", undefined, undefined, ["S005"]),
      },
    ),
    trap(
      "step4-bottle",
      "weigh",
      "图省事把约 500 g 的整瓶 NaCl 试剂瓶直接放上秤盘“称个总重”",
      "demo-op-step4-bottle",
      "A1",
      hazard(
        "exp08-H1",
        "L4",
        20,
        "A1",
        fb(
          "danger",
          "超出 Max 200 g，刀口崩裂、横梁变形，本次实验终止",
          "电光天平横梁由三棱刀口支承，设计载荷上限 200 g；机械天平没有电子过载保护，超载时刀口承压远超弹性极限。",
          "一律用药匙取样、在称量纸上称量；上秤前先看铭牌 Max；整瓶约 500 g，严禁上秤。",
          ["S003"],
        ),
        { fx: "device-accident", incidentId: "exp08-H1", terminate: true },
      ),
    ),
    trap(
      "step4-direct",
      "weigh",
      "不垫称量纸，直接把试样倒在秤盘上",
      "demo-op-step4-direct",
      "S2",
      hazard(
        "exp08-H4",
        "L2",
        5,
        "S2",
        fb(
          "warn",
          "试样嵌入秤盘缝隙、腐蚀盘面，示值长期失准",
          "固体嵌入盘面缝隙，NaCl 吸湿后腐蚀金属盘面，残留质量叠加到后续称量，全部数据带正偏差。",
          "称量纸折角或用表面皿盛放，试样不接触秤盘。",
          ["S005"],
        ),
      ),
    ),
  ],
};

const step5: StepDefinition = {
  index: 4,
  title: "递减法连续称三份",
  scene: "天平前",
  demoId: "exp08-step5-decrement",
  judge: {
    criterion: "三份各 0.3994~0.4004 g；极差 ≤0.0005 g；相对平均偏差 ≤0.1%；瓶外壁与台面无残留",
    competency: ["S2", "K2"],
    tolerance: { paramKey: "mass", expected: 0.3998, unit: "g", tolerance: 0.0005 },
  },
  hints: {
    h0: "盖子会跟着瓶子走吗？瓶与盖要分持，垂直放入秤盘中央。",
    h1: "盖子会跟着瓶子走吗？",
    h2: "高亮“瓶身—瓶盖”分持手势：开侧门取放，关侧门读数。",
    h3: "演示“称 m₁—在烧杯上方倾斜 45° 轻敲转移—盖盖复称 m₂—同法得 m₃、m₄”。",
    h4: H4,
  },
  accepts: ["step5-weigh", "step5-transfer", "step5-compute", "step5-handle", "step5-sweep"],
  choices: [
    correct(
      "step5-weigh",
      "weigh",
      "称量瓶连盖轻放秤盘中央，开侧门取放、关侧门读数，记 m₁",
      "demo-op-step5-weigh",
      "S2",
      {
        observation: { text: "m₁ = 18.2642 g（称量瓶 + 试样，初始）" },
        entityPatch: { "balance-1": { reading: 18.2642 } },
      },
    ),
    correct(
      "step5-transfer",
      "transfer",
      "在烧杯上方开盖，瓶身倾斜约 45°，轻敲瓶口上方使试样缓缓落下约 0.4 g，随即盖盖、复称 m₂",
      "demo-op-step5-transfer",
      "S2",
      {
        requires: ["step5-weigh"],
        observation: { text: "m₂ = 17.8644 g，第一份转移约 0.3998 g" },
        entityPatch: { "balance-1": { reading: 17.8644 } },
      },
    ),
    correct(
      "step5-compute",
      "compute",
      "同法连续转移得 m₃、m₄，按相邻两次示数之差算每份质量",
      "demo-op-step5-compute",
      "K2",
      {
        completesStep: true,
        requires: ["step5-weigh", "step5-transfer"],
        ...P({ mass: 0.3998 }),
        observation: {
          text: "m₃=17.4646 g，m₄=17.0647 g；三份 0.3998/0.3998/0.3999 g，平均 0.3998 g，极差 0.0001 g，相对平均偏差 0.008%",
        },
        entityPatch: { "beaker-100": { note: "已接收三份约 0.4 g NaCl" } },
        feedback: fb("info", "递减法完成：三份平均 0.3998 g，相对平均偏差 0.008%", undefined, undefined, ["S005"]),
      },
    ),
    trap(
      "step5-handle",
      "weigh",
      "单手连盖抓取、从侧门斜插着取放称量瓶",
      "demo-op-step5-handle",
      "S2",
      hazard(
        "exp08-H3",
        "L3",
        8,
        "S2",
        fb(
          "danger",
          "称量瓶跌落破碎，试样散落、玻璃碎片飞溅",
          "称量瓶为薄壁磨口玻璃，连盖抓取时盖与瓶相对滑动，斜插易撞侧门框；跌落时玻璃碎片可能划伤手部。",
          "瓶与盖分持，垂直放入秤盘中央，开侧门取放、关侧门读数。",
          ["S005"],
        ),
        { fx: "glass-break", incidentId: "exp08-H3" },
      ),
    ),
    trap(
      "step5-sweep",
      "transfer",
      "试样洒落台面后，用牛角勺扫回称量瓶继续称",
      "demo-op-step5-sweep",
      "K2",
      hazard(
        "exp08-H5",
        "L2",
        5,
        "K2",
        fb(
          "warn",
          "混入台面杂质与纸屑，三份数据全部作废",
          "台面混有纸屑、灰尘与前组残留，回扫即引入杂质；试样被污染，三份质量数据不可用。",
          "洒落试样弃入回收瓶，重新取洁净试样；不得扫回原瓶。",
          ["S021"],
        ),
      ),
    ),
  ],
};

const step6: StepDefinition = {
  index: 5,
  title: "原始记录与数据处理",
  scene: "实验台",
  demoId: "exp08-step6-record",
  judge: {
    criterion: "记录当场完成、无涂改液/无橡皮痕；每个质量 4 位小数；差减值 4 位有效数字",
    competency: ["K1", "K2", "A1"],
    tolerance: { paramKey: "relativeDeviation", expected: 0.008, unit: "%", tolerance: 0.001 },
  },
  hints: {
    h0: "这支笔能擦掉吗？原始记录要用不溶性墨水笔，错了划一条横线保留原值。",
    h1: "这支笔能擦掉吗？",
    h2: "高亮“划改 + 签名”示例：原值保留，旁边写正确值并签名。",
    h3: "演示“测一个、记一个”，不誊抄；差减值取到 0.0001 g（4 位有效数字）。",
    h4: H4,
  },
  accepts: ["step6-ink", "step6-strike", "step6-compute", "step6-pencil", "step6-digits"],
  choices: [
    correct(
      "step6-ink",
      "observe",
      "在记录本上当场用不溶性墨水笔记录，所有质量一律记到 0.0001 g",
      "demo-op-step6-ink",
      "A1",
      { observation: { text: "当场用不溶性墨水笔记录，质量均记到 0.0001 g" } },
    ),
    correct(
      "step6-strike",
      "observe",
      "写错的数字划一条横线保留原值，旁边写正确值并签名",
      "demo-op-step6-strike",
      "A1",
      { observation: { text: "错处划单横线、保留原值、旁写正确值并签名" } },
    ),
    correct(
      "step6-compute",
      "compute",
      "用 m₁ − m₂ 求每份质量，结果取到 0.0001 g（4 位有效数字），再算平均值、极差、相对平均偏差",
      "demo-op-step6-compute",
      "K2",
      {
        completesStep: true,
        requires: ["step6-ink", "step6-strike"],
        ...P({ relativeDeviation: 0.008 }),
        observation: {
          text: "三份 0.3998/0.3998/0.3999 g；平均 0.3998 g，极差 0.0001 g，相对平均偏差 0.008%",
        },
        feedback: fb("info", "数据处理完成：差减值 4 位有效数字，相对平均偏差 0.008%", undefined, undefined, ["S001"]),
      },
    ),
    trap(
      "step6-pencil",
      "observe",
      "用铅笔记录，课后按“应该的值”描改",
      "demo-op-step6-pencil",
      "A1",
      hazard(
        "exp08-H6",
        "L2",
        5,
        "A1",
        fb(
          "warn",
          "原始记录不可追溯，判定为篡改，本次数据作废",
          "原始记录须可追溯；铅笔可擦、事后修改无法区分笔误与编造，记录被判无效。",
          "不溶性墨水笔当场记录；错处划单横线、留原值、签名。",
          ["S001"],
        ),
      ),
    ),
    trap(
      "step6-digits",
      "observe",
      "把 0.5000 g 记成 0.5 g、把 0.3998 g 记成 0.4 g",
      "demo-op-step6-digits",
      "K1",
      hazard(
        "exp08-H12",
        "L1",
        2,
        "K1",
        fb(
          "warn",
          "有效数字位数错，相对误差算错一位",
          "位数即精度：少写位数等于宣称仪器只有 0.1 g 分辨力，后续相对误差会被算错一个数量级。",
          "凡天平示数一律记到 0.0001 g，差减值保留 4 位有效数字。",
          ["S001"],
        ),
      ),
    ),
  ],
};

const step7: StepDefinition = {
  index: 6,
  title: "自查、清扫与复原",
  scene: "天平前 + 实验台",
  demoId: "exp08-step7-restore",
  judge: {
    criterion: "秤盘与箱内无残留；加码杆回零；天平断电罩好；台面无粉",
    competency: ["S1", "A1"],
  },
  hints: {
    h0: "箱子里的粉去哪了？用软毛刷由内向外扫，不能吹、不能湿擦。",
    h1: "箱子里的粉去哪了？",
    h2: "高亮软毛刷与“由内向外”清扫路径。",
    h3: "演示“取下称量物—软毛刷清扫—加码杆回零—关机罩罩—断电”。",
    h4: H4,
  },
  accepts: ["step7-check", "step7-brush", "step7-shutdown", "step7-leave", "step7-wet"],
  choices: [
    correct(
      "step7-check",
      "compute",
      "核对三份质量的极差与相对平均偏差是否 ≤0.1%，超差先查操作再决定是否重称",
      "demo-op-step7-check",
      "S1",
      { ...P({ relativeDeviation: 0.008 }), observation: { text: "极差 0.0001 g、相对平均偏差 0.008%，均 ≤0.1%" } },
    ),
    correct(
      "step7-brush",
      "wash",
      "取下称量物，用软毛刷清扫秤盘与箱内散落试样，加码杆回零",
      "demo-op-step7-brush",
      "S1",
      {
        requires: ["step7-check"],
        observation: { text: "软毛刷由内向外清扫秤盘与箱内，加码杆回零" },
        entityPatch: { "balance-1": { reading: 0, note: "已清扫，加码杆回零" } },
      },
    ),
    correct(
      "step7-shutdown",
      "observe",
      "关天平、罩防尘罩、断电，试剂归位、台面擦净、椅子归位",
      "demo-op-step7-shutdown",
      "A1",
      {
        completesStep: true,
        requires: ["step7-check", "step7-brush"],
        observation: { text: "天平断电罩好，试剂归位，台面擦净，椅子归位" },
        feedback: fb("info", "复原完成：清扫—回零—关机—罩罩—断电", undefined, undefined, ["S003"]),
      },
    ),
    trap(
      "step7-leave",
      "observe",
      "天平不关、秤盘上留着称量纸就离场",
      "demo-op-step7-leave",
      "A1",
      hazard(
        "exp08-H13",
        "L1",
        2,
        "A1",
        fb(
          "warn",
          "下一位同学误用带载天平，零点被破坏",
          "带载关机使刀口长期受压，下一位同学误读残留示数；零点被破坏，下一组数据整体偏移。",
          "取下称量物、清扫、回零、关机、罩罩、断电。",
          ["S003"],
        ),
      ),
    ),
    trap(
      "step7-wet",
      "wash",
      "用湿抹布擦秤盘，或用嘴吹天平箱内的试样粉末",
      "demo-op-step7-wet",
      "S1",
      hazard(
        "exp08-H8",
        "L2",
        5,
        "S1",
        fb(
          "warn",
          "水汽使盘面锈蚀、粉末进入阻尼器缝隙",
          "水汽使盘面锈蚀、阻尼器受潮；口吹把粉末送入光学系统与刀口缝隙，示值漂移、阻尼失灵。",
          "软毛刷由内向外清扫，必要时由教师用洗耳球。",
          ["S003"],
        ),
      ),
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 实验定义
 * ------------------------------------------------------------------ */

export const exp08Definition: ExperimentDefinition = {
  id: "exp08",
  title: "清点仪器，分析天平称量练习",
  competencies: ["K1", "K2", "S1", "S2", "A1"],
  steps: [step1, step2, step3, step4, step5, step6, step7],
  createState: (): ExperimentState => ({
    expId: "exp08",
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

export default exp08Definition;
