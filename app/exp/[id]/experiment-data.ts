export type LabStepState = "done" | "current" | "todo";

export type LabStep = {
  id: string;
  index: string;
  title: string;
  instruction: string;
  criterion: string;
  state: LabStepState;
};

export const EXPERIMENT = {
  id: "exp09",
  no: "09",
  code: "03600004",
  title: "酸碱标准溶液的配制与浓度比较",
  college: "新能源与智能制造学院",
  course: "无机及分析化学实验",
  teacher: "刘建彩",
  hours: 3,
  currentStepIndex: 2,
  currentReadout: "0.04",
  readingUnit: "mL",
  expectedReading: "0.00 ± 0.05 mL",
  stepTotal: 6,
} as const;

export const STEPS: readonly LabStep[] = [
  {
    id: "step-01",
    index: "01",
    title: "检查并润洗滴定管",
    instruction: "检查活塞与管尖，用待装液润洗 2~3 次。",
    criterion: "润洗次数 ≥ 2，且用待装液，不用蒸馏水。",
    state: "done",
  },
  {
    id: "step-02",
    index: "02",
    title: "装液、排气泡、调零",
    instruction: "装液至零刻线以上，排出管尖气泡，调至 0.00。",
    criterion: "管尖无气泡，液面在零刻度附近。",
    state: "done",
  },
  {
    id: "step-03",
    index: "03",
    title: "记录初读数",
    instruction: "视线与凹液面最低点水平，读至 0.01 mL。调零后的读数应接近 0.00。",
    criterion: "读数与真值差 ≤ 0.05 mL。",
    state: "current",
  },
  {
    id: "step-04",
    index: "04",
    title: "移取 HCl 并加指示剂",
    instruction: "移取 20.00 mL HCl 入锥形瓶，加甲基橙 2 滴。",
    criterion: "指示剂 2~3 滴，溶液呈黄色。",
    state: "todo",
  },
  {
    id: "step-05",
    index: "05",
    title: "滴定至近终点",
    instruction: "边摇边滴，先快后慢；近终点改半滴，挂壁液用洗瓶洗下。",
    criterion: "不成线流，不局部过量；临近终点颜色变化变慢。",
    state: "todo",
  },
  {
    id: "step-06",
    index: "06",
    title: "判终点并读数",
    instruction: "判终点：黄变橙，30 秒不褪。读末读数并计算体积 V。",
    criterion: "终点色卡匹配 ±1 档；V 与真值差 ≤ 0.05 mL。",
    state: "todo",
  },
];

export const CURRENT_STEP = STEPS[EXPERIMENT.currentStepIndex];

export const CRITERIA: readonly { id: string; item: string; requirement: string }[] = [
  { id: "judge-01", item: "液面位置", requirement: "调零后接近 0.00" },
  { id: "judge-02", item: "视线", requirement: "与凹液面最低点水平" },
  { id: "judge-03", item: "读数精度", requirement: "估读至 0.01 mL" },
  { id: "judge-04", item: "管尖", requirement: "无气泡，无挂液" },
];

export const READING_ROWS: readonly { id: string; label: string; value: string }[] = [
  { id: "reading-01", label: "初读数", value: "0.00 mL" },
  { id: "reading-02", label: "末读数", value: "—" },
  { id: "reading-03", label: "已用体积 V", value: "—" },
];
