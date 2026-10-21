/**
 * 物质表（chem-model 独占文件，纯数据 + 纯函数，无 IO、无运行时依赖）
 *
 * 覆盖范围：docs/实验库 exp01~exp10 出现的试剂与关键产物，外加任务书点名的
 * NaBiO3 / H₂S 水 / 乙醚 / EDTA。颜色一律用十六进制 CSS 值（契约 §3 的
 * `liquid.color` / `precipitate.color` 直接消费），不定颜色就写 `COLORS.colorless`。
 *
 * 数据口径：浓度取各实验 §4 试剂表；GHS 取该表标签；`ref` 记录口径来源。
 * 存疑条目在 `note` 里标 `【待核】`。
 */

export type Phase = "solid" | "liquid" | "aqueous" | "gas";

export type ConcentrationUnit = "mol/L" | "%" | "g/mL";

export interface Concentration {
  readonly value: number;
  readonly unit: ConcentrationUnit;
  readonly note?: string;
}

export interface Substance {
  readonly id: string;
  readonly nameZh: string;
  readonly formula: string;
  readonly phase: Phase;
  /** 十六进制 CSS 颜色；无色透明也用 #FFFFFF，透明度由渲染层按 phase 处理 */
  readonly color: string;
  readonly appearance?: string;
  readonly commonConcentrations: readonly Concentration[];
  /** GHS 危险标签；非危险品也要给一条"无"，保证判分/提示链路不必判空 */
  readonly hazards: readonly string[];
  readonly storage: string;
  readonly molarMass?: number;
  readonly aliases?: readonly string[];
  readonly note?: string;
  readonly ref: string;
}

/** 统一色板：键名即语义，值与契约示例一致（黄 #FFF59D、白 #FFFFFF）。 */
export const COLORS = {
  colorless: "#FFFFFF",
  white: "#FFFFFF",
  offWhite: "#FAFAFA",
  paleYellow: "#FFF59D",
  yellow: "#FFF59D",
  golden: "#FBC02D",
  orange: "#FB8C00",
  orangeRed: "#E65100",
  red: "#C62828",
  brickRed: "#B71C1C",
  bloodRed: "#8B0000",
  pink: "#F48FB1",
  purple: "#6A1B9A",
  lightBlue: "#81D4FA",
  blue: "#1E88E5",
  deepBlue: "#0D47A1",
  green: "#43A047",
  paleGreen: "#C5E1A5",
  brown: "#6D4C41",
  brownYellow: "#C8A200",
  black: "#212121",
  gray: "#9E9E9E",
  silver: "#B0BEC5",
} as const;

export type ColorToken = keyof typeof COLORS;

const mol = (value: number, note?: string): Concentration => ({ value, unit: "mol/L", ...(note ? { note } : {}) });
const pct = (value: number, note?: string): Concentration => ({ value, unit: "%", ...(note ? { note } : {}) });

const SPEC = "exp09 §4 试剂表";
const GHS_CORROSIVE = "GHS05 腐蚀";
const GHS_IRRITANT = "GHS07 刺激";
const GHS_OXIDIZER = "GHS03 氧化性";
const GHS_TOXIC = "GHS06 剧毒";
const GHS_HEALTH = "GHS08 健康危害（致癌/靶器官）";
const GHS_FLAMMABLE = "GHS02 易燃";
const GHS_ENV = "GHS09 环境危害";
const GHS_NONE = "无（非 GHS 危险品）";

export const SUBSTANCES: readonly Substance[] = [
  // ── 实验 01 / 09 / 10：酸碱与基准物质 ─────────────────────────────
  { id: "naoh", nameZh: "氢氧化钠", formula: "NaOH", phase: "solid", color: COLORS.white, appearance: "白色片状固体，强吸湿",
    commonConcentrations: [mol(0.1), mol(6), mol(19, "饱和溶液，20 ℃ 约 19 mol/L")],
    hazards: [GHS_CORROSIVE], storage: "干燥器内密封；碱液存聚乙烯瓶，橡胶塞/塑料螺纹盖", molarMass: 40.0, aliases: ["烧碱", "苛性钠"], ref: SPEC },
  { id: "hcl", nameZh: "盐酸", formula: "HCl", phase: "aqueous", color: COLORS.colorless, appearance: "无色透明液体，浓盐酸有刺激性酸雾",
    commonConcentrations: [mol(0.1, "粗配/待标定"), mol(3), mol(6), mol(12, "浓盐酸 w=37%，ρ≈1.19 g/mL")],
    hazards: [GHS_CORROSIVE, GHS_IRRITANT], storage: "通风橱内耐酸柜，原瓶取用，不转移", molarMass: 36.46, aliases: ["氢氯酸"], ref: SPEC },
  { id: "hac", nameZh: "乙酸", formula: "CH3COOH", phase: "liquid", color: COLORS.colorless, appearance: "无色液体，有强烈酸味",
    commonConcentrations: [mol(6), mol(17.4, "冰醋酸 ≥99.5%，约 17.4 mol/L"), mol(0.1, "标准溶液，以标定值为准")],
    hazards: [GHS_CORROSIVE, GHS_FLAMMABLE], storage: "通风橱内耐酸瓶密封，远离火源", molarMass: 60.05, aliases: ["醋酸", "冰醋酸"], ref: "exp03 §4 试剂表" },
  { id: "h2so4", nameZh: "硫酸", formula: "H2SO4", phase: "liquid", color: COLORS.colorless, appearance: "无色油状液体，浓硫酸强吸水",
    commonConcentrations: [mol(3), mol(18.4, "浓硫酸 98%，ρ=1.84 g/mL")],
    hazards: [GHS_CORROSIVE, GHS_OXIDIZER], storage: "通风橱内耐酸柜，原瓶取用；稀释必须酸入水", molarMass: 98.08, ref: "exp01 §4 试剂表" },
  { id: "na2co3", nameZh: "碳酸钠", formula: "Na2CO3", phase: "solid", color: COLORS.white, appearance: "白色粉末，易吸湿",
    commonConcentrations: [mol(0.1), mol(1.8, "饱和溶液 20 ℃ 约 1.8 mol/L")],
    hazards: [GHS_IRRITANT], storage: "干燥器内密封；基准物须 270~300 ℃ 干燥后冷至室温", molarMass: 105.99, aliases: ["纯碱", "苏打"], ref: "exp01 §4 / exp10 §4" },
  { id: "nahco3", nameZh: "碳酸氢钠", formula: "NaHCO3", phase: "solid", color: COLORS.white, appearance: "白色细晶体",
    commonConcentrations: [mol(0.1)], hazards: [GHS_NONE], storage: "干燥处密封", molarMass: 84.01, aliases: ["小苏打"], ref: "exp10 §3 双指示剂法" },
  { id: "nacl", nameZh: "氯化钠", formula: "NaCl", phase: "solid", color: COLORS.white, appearance: "白色晶体",
    commonConcentrations: [mol(0.1), mol(5.2, "饱和食盐水 20 ℃ 约 5.2 mol/L")],
    hazards: [GHS_NONE], storage: "广口瓶，干燥处密封", molarMass: 58.44, aliases: ["食盐"], ref: "exp04 §4 / exp08 §4" },
  { id: "kcl", nameZh: "氯化钾", formula: "KCl", phase: "solid", color: COLORS.white, appearance: "白色晶体",
    commonConcentrations: [mol(3, "电极保护液")], hazards: [GHS_NONE], storage: "试剂瓶，室温", molarMass: 74.55, ref: "exp03 §4 / exp07 焰色反应" },

  // ── 实验 02 / 04 / 06 / 07：沉淀、配位与鉴定 ───────────────────────
  { id: "agno3", nameZh: "硝酸银", formula: "AgNO3", phase: "solid", color: COLORS.white, appearance: "无色晶体，见光分解变黑",
    commonConcentrations: [mol(0.1)], hazards: [GHS_OXIDIZER, GHS_CORROSIVE, GHS_ENV], storage: "棕色瓶避光，室温", molarMass: 169.87, ref: "exp04 §4 试剂表" },
  { id: "ki", nameZh: "碘化钾", formula: "KI", phase: "solid", color: COLORS.white, appearance: "白色晶体，溶液无色",
    commonConcentrations: [mol(0.1)], hazards: [GHS_IRRITANT, GHS_ENV], storage: "棕色瓶避光，室温", molarMass: 166.00, ref: "exp04 §4 / exp05 §4" },
  { id: "kbr", nameZh: "溴化钾", formula: "KBr", phase: "solid", color: COLORS.white, appearance: "白色晶体",
    commonConcentrations: [mol(0.1)], hazards: [GHS_IRRITANT], storage: "试剂瓶，室温", molarMass: 119.00, ref: "exp06 §4 试剂表" },
  { id: "kscn", nameZh: "硫氰酸钾", formula: "KSCN", phase: "solid", color: COLORS.white, appearance: "白色晶体，溶液无色",
    commonConcentrations: [mol(0.1)], hazards: [GHS_HEALTH], storage: "试剂瓶，室温", molarMass: 97.18, ref: "exp06 §4 / exp07 §4" },
  { id: "cacl2", nameZh: "氯化钙", formula: "CaCl2", phase: "solid", color: COLORS.white, appearance: "白色颗粒/粉末",
    commonConcentrations: [mol(0.1)], hazards: [GHS_IRRITANT], storage: "干燥处密封", molarMass: 110.98, ref: "exp07 §4 试剂表" },
  { id: "bacl2", nameZh: "氯化钡", formula: "BaCl2", phase: "solid", color: COLORS.white, appearance: "白色晶体（二水合物）",
    commonConcentrations: [mol(1.0)], hazards: [GHS_TOXIC, GHS_ENV], storage: "专柜锁存，贴\"毒\"标签；含 Ba²⁺ 废液入重金属桶", molarMass: 244.26, ref: "exp02 §4 试剂表" },
  { id: "mgso4", nameZh: "硫酸镁", formula: "MgSO4", phase: "solid", color: COLORS.white, appearance: "白色晶体（七水合物）",
    commonConcentrations: [mol(0.1)], hazards: [GHS_NONE], storage: "干燥处密封", molarMass: 120.37, ref: "任务书点名；exp07 镁组鉴定" },
  { id: "mgcl2", nameZh: "氯化镁", formula: "MgCl2", phase: "solid", color: COLORS.white, appearance: "白色晶体，易潮解",
    commonConcentrations: [mol(0.1)], hazards: [GHS_IRRITANT], storage: "干燥处密封", molarMass: 95.21, ref: "exp04 §4 试剂表" },
  { id: "cuso4", nameZh: "硫酸铜", formula: "CuSO4", phase: "solid", color: COLORS.blue, appearance: "蓝色晶体（五水合物），溶液蓝色",
    commonConcentrations: [mol(0.1), mol(1.0)], hazards: [GHS_HEALTH, GHS_ENV], storage: "试剂瓶，室温；废液入重金属桶", molarMass: 159.61, aliases: ["胆矾", "CuSO4·5H2O"], ref: "exp05 §4 / exp06 §4" },
  { id: "znso4", nameZh: "硫酸锌", formula: "ZnSO4", phase: "solid", color: COLORS.white, appearance: "白色晶体，溶液无色",
    commonConcentrations: [mol(1.0)], hazards: [GHS_ENV], storage: "玻璃瓶，室温", molarMass: 161.44, ref: "exp05 §4 试剂表" },
  { id: "nh3", nameZh: "氨水", formula: "NH3·H2O", phase: "aqueous", color: COLORS.colorless, appearance: "无色液体，有强烈刺激性氨味",
    commonConcentrations: [mol(6, "由浓氨水稀释"), mol(16, "浓氨水 w≈25%，约 16 mol/L")],
    hazards: [GHS_CORROSIVE, GHS_IRRITANT, GHS_ENV], storage: "塑料瓶密封，通风橱内", molarMass: 35.05, aliases: ["氨溶液", "氢氧化铵"], ref: "exp04 §4 / exp06 §4" },
  { id: "nh4cl", nameZh: "氯化铵", formula: "NH4Cl", phase: "solid", color: COLORS.white, appearance: "白色晶体",
    commonConcentrations: [mol(2.0)], hazards: [GHS_IRRITANT], storage: "试剂瓶，室温", molarMass: 53.49, ref: "exp04 §4 试剂表" },
  { id: "na2s", nameZh: "硫化钠", formula: "Na2S", phase: "solid", color: COLORS.white, appearance: "白色晶体，遇酸放出 H₂S",
    commonConcentrations: [mol(0.1, "现配现用")], hazards: [GHS_TOXIC, GHS_CORROSIVE], storage: "通风橱内现配现用，密封", molarMass: 78.04, ref: "exp06 §4 试剂表" },
  { id: "na2s2o3", nameZh: "硫代硫酸钠", formula: "Na2S2O3", phase: "solid", color: COLORS.white, appearance: "白色晶体，溶液无色",
    commonConcentrations: [mol(0.5, "现配")], hazards: [GHS_NONE], storage: "试剂瓶避光", molarMass: 158.11, aliases: ["大苏打"], ref: "exp06 §4 试剂表" },
  { id: "fecl3", nameZh: "氯化铁", formula: "FeCl3", phase: "solid", color: COLORS.brownYellow, appearance: "黄棕色晶体，溶液黄棕",
    commonConcentrations: [mol(0.1)], hazards: [GHS_CORROSIVE, GHS_IRRITANT], storage: "试剂瓶，室温（易潮解）", molarMass: 162.20, ref: "exp06 §4 试剂表" },
  { id: "cocl2", nameZh: "氯化钴", formula: "CoCl2", phase: "solid", color: COLORS.pink, appearance: "粉红色晶体（六水合物）",
    commonConcentrations: [mol(0.1)], hazards: [GHS_HEALTH, GHS_ENV], storage: "试剂瓶，室温", molarMass: 129.84, ref: "exp06 §4 试剂表" },
  { id: "k3fe(cn)6", nameZh: "铁氰化钾", formula: "K3[Fe(CN)6]", phase: "solid", color: COLORS.paleGreen, appearance: "黄绿色晶体（赤血盐）",
    commonConcentrations: [mol(0.1)], hazards: [GHS_HEALTH, GHS_ENV], storage: "棕色瓶避光；遇酸放 HCN", molarMass: 329.24, aliases: ["赤血盐"], ref: "exp06 §4 试剂表" },
  { id: "en", nameZh: "乙二胺", formula: "C2H8N2", phase: "liquid", color: COLORS.colorless, appearance: "无色液体，有氨味",
    commonConcentrations: [mol(0.5)], hazards: [GHS_FLAMMABLE, GHS_CORROSIVE], storage: "通风橱内密封，有机废液单列", molarMass: 60.10, aliases: ["乙二胺(en)"], ref: "exp06 §4 / §6 步7" },
  { id: "edta", nameZh: "乙二胺四乙酸二钠", formula: "C10H14N2Na2O8", phase: "solid", color: COLORS.white, appearance: "白色结晶粉末",
    commonConcentrations: [mol(0.02)], hazards: [GHS_IRRITANT], storage: "干燥处密封", molarMass: 372.24, aliases: ["EDTA", "EDTA-2Na"], note: "【待核】本批实验未直接使用，按任务书要求预留配位滴定物质", ref: "任务书点名" },
  { id: "na2hpo4", nameZh: "磷酸氢二钠", formula: "Na2HPO4", phase: "solid", color: COLORS.white, appearance: "白色粉末",
    commonConcentrations: [mol(0.1)], hazards: [GHS_NONE], storage: "干燥处密封", molarMass: 141.96, ref: "exp07 §4 试剂表" },
  { id: "nh42c2o4", nameZh: "草酸铵", formula: "(NH4)2C2O4", phase: "solid", color: COLORS.white, appearance: "白色晶体",
    commonConcentrations: [mol(0.25)], hazards: [GHS_HEALTH], storage: "试剂瓶，室温", molarMass: 124.10, aliases: ["(NH4)2C2O4"], ref: "exp07 §4 试剂表" },
  { id: "na3co(no2)6", nameZh: "钴亚硝酸钠", formula: "Na3[Co(NO2)6]", phase: "aqueous", color: COLORS.golden, appearance: "橙黄色溶液（现配，含少量 HAc）",
    commonConcentrations: [mol(0.1, "现配")], hazards: [GHS_HEALTH, GHS_OXIDIZER], storage: "棕色瓶冷藏，一周内用完", molarMass: 403.94, aliases: ["钴亚硝酸钠"], ref: "exp07 §4 试剂表" },
  { id: "nh42hg(scn)4", nameZh: "硫氰酸汞铵", formula: "(NH4)2[Hg(SCN)4]", phase: "aqueous", color: COLORS.colorless, appearance: "无色溶液（现配）",
    commonConcentrations: [mol(0.1, "现配")], hazards: [GHS_TOXIC, GHS_ENV], storage: "滴瓶单独摆放，贴\"含汞\"标签", molarMass: 468.98, ref: "exp07 §4 试剂表" },
  { id: "aluminon", nameZh: "铝试剂", formula: "C22H23N3O9", phase: "aqueous", color: COLORS.red, appearance: "红色水溶液（0.10%）",
    commonConcentrations: [pct(0.1)], hazards: [GHS_IRRITANT], storage: "棕色瓶冷藏", molarMass: 473.44, aliases: ["aluminon"], note: "【待核】分子式/显色条件按教材铝试剂条目", ref: "exp07 §4 试剂表" },
  { id: "alcl3", nameZh: "氯化铝", formula: "AlCl3", phase: "solid", color: COLORS.white, appearance: "白色晶体，遇水水解",
    commonConcentrations: [mol(0.1)], hazards: [GHS_CORROSIVE, GHS_IRRITANT], storage: "干燥处密封", molarMass: 133.34, ref: "exp07 §6 步4" },
  { id: "na2so4", nameZh: "硫酸钠", formula: "Na2SO4", phase: "solid", color: COLORS.white, appearance: "白色粉末",
    commonConcentrations: [mol(0.1)], hazards: [GHS_NONE], storage: "干燥处密封", molarMass: 142.04, ref: "exp02 §6 步2（SO₄²⁻ 检验）" },

  // ── 实验 05：氧化还原 ────────────────────────────────────────────
  { id: "k2cr2o7", nameZh: "重铬酸钾", formula: "K2Cr2O7", phase: "solid", color: COLORS.orangeRed, appearance: "橙红色晶体，溶液橙色",
    commonConcentrations: [mol(0.05)], hazards: [GHS_TOXIC, GHS_HEALTH, GHS_OXIDIZER, GHS_ENV], storage: "专柜锁存，禁止干粉称量；含 Cr(Ⅵ) 废液单独收集", molarMass: 294.18, ref: "exp05 §4 试剂表" },
  { id: "k2cro4", nameZh: "铬酸钾", formula: "K2CrO4", phase: "solid", color: COLORS.golden, appearance: "黄色晶体，溶液黄色",
    commonConcentrations: [mol(0.1)], hazards: [GHS_HEALTH, GHS_ENV], storage: "塑料瓶，贴\"六价铬\"标签", molarMass: 194.19, ref: "exp07 §4 试剂表" },
  { id: "kio3", nameZh: "碘酸钾", formula: "KIO3", phase: "solid", color: COLORS.white, appearance: "白色晶体，溶液无色",
    commonConcentrations: [mol(0.1)], hazards: [GHS_OXIDIZER, GHS_HEALTH], storage: "玻璃瓶，室温", molarMass: 214.00, ref: "exp05 §4 试剂表" },
  { id: "na2so3", nameZh: "亚硫酸钠", formula: "Na2SO3", phase: "solid", color: COLORS.white, appearance: "白色粉末，溶液无色",
    commonConcentrations: [mol(0.1, "现配")], hazards: [GHS_IRRITANT], storage: "现用现配", molarMass: 126.04, ref: "exp05 §4 试剂表" },
  { id: "h2o2", nameZh: "过氧化氢", formula: "H2O2", phase: "aqueous", color: COLORS.colorless, appearance: "无色液体",
    commonConcentrations: [pct(3, "约 0.88 mol/L"), pct(30, "浓过氧化氢，须稀释后使用")],
    hazards: [GHS_OXIDIZER, GHS_IRRITANT], storage: "棕色瓶避光，远离还原性物质", molarMass: 34.01, aliases: ["双氧水"], ref: "exp05 §4 试剂表" },
  { id: "kmno4", nameZh: "高锰酸钾", formula: "KMnO4", phase: "solid", color: COLORS.purple, appearance: "紫黑色晶体，稀溶液紫红",
    commonConcentrations: [mol(0.01)], hazards: [GHS_OXIDIZER], storage: "棕色瓶避光", molarMass: 158.03, aliases: ["灰锰氧"], ref: "exp05 §4 试剂表" },
  { id: "starch", nameZh: "淀粉指示剂", formula: "(C6H10O5)n", phase: "aqueous", color: COLORS.colorless, appearance: "无色胶状溶液，遇 I₂ 变深蓝",
    commonConcentrations: [pct(0.5, "现配")], hazards: [GHS_NONE], storage: "现配现用", ref: "exp05 §4 试剂表" },
  { id: "i2", nameZh: "碘", formula: "I2", phase: "solid", color: COLORS.brownYellow, appearance: "紫黑色晶体，溶液棕黄/褐色",
    commonConcentrations: [], hazards: [GHS_IRRITANT, GHS_ENV], storage: "棕色瓶密封避光，低温", molarMass: 253.81, ref: "exp05 §6 步5（析出 I₂ 显棕黄）" },

  // ── 任务书点名、本批 10 个实验未直接使用 ───────────────────────────
  { id: "nabio3", nameZh: "铋酸钠", formula: "NaBiO3", phase: "solid", color: COLORS.yellow, appearance: "黄色/棕黄色粉末",
    commonConcentrations: [], hazards: [GHS_OXIDIZER, GHS_IRRITANT], storage: "干燥器内密封，避光", molarMass: 279.97, note: "【待核】强氧化剂，本批实验未涉及，只按任务书预留物质记录", ref: "任务书点名；通用无机化学试剂手册口径" },
  { id: "h2s", nameZh: "硫化氢水溶液", formula: "H2S", phase: "aqueous", color: COLORS.colorless, appearance: "无色溶液，有臭鸡蛋气味",
    commonConcentrations: [mol(0.1, "饱和溶液 20 ℃ 约 0.1 mol/L")], hazards: [GHS_TOXIC, GHS_CORROSIVE, GHS_ENV], storage: "通风橱内现配现用，不得敞口久置", molarMass: 34.08, aliases: ["氢硫酸", "H2S 水"], ref: "任务书点名；exp07 硫化氢分组" },
  { id: "ether", nameZh: "乙醚", formula: "(C2H5)2O", phase: "liquid", color: COLORS.colorless, appearance: "无色易挥发液体，有特殊气味",
    commonConcentrations: [], hazards: [GHS_FLAMMABLE, GHS_IRRITANT], storage: "防爆柜，避光密封，远离火源", molarMass: 74.12, note: "【待核】本批实验未直接使用，易燃低沸点，只预留物质记录", ref: "任务书点名；通用有机化学手册口径" },
  { id: "ethanol", nameZh: "无水乙醇", formula: "C2H5OH", phase: "liquid", color: COLORS.colorless, appearance: "无色液体",
    commonConcentrations: [pct(99.5)], hazards: [GHS_FLAMMABLE], storage: "防爆柜，远离火源", molarMass: 46.07, ref: "exp04 §4 试剂表" },
  { id: "distilledWater", nameZh: "蒸馏水", formula: "H2O", phase: "liquid", color: COLORS.colorless, appearance: "无色透明液体",
    commonConcentrations: [], hazards: [GHS_NONE], storage: "洗瓶/试剂瓶，室温", molarMass: 18.02, aliases: ["水", "去离子水"], ref: "exp01 §4 / 全部实验" },

  // ── 指示剂 ─────────────────────────────────────────────────────
  { id: "phenolphthalein", nameZh: "酚酞", formula: "C20H14O4", phase: "aqueous", color: COLORS.colorless, appearance: "无色乙醇溶液，pH 8.2~10.0 由无色变粉红",
    commonConcentrations: [pct(0.1, "乙醇溶液"), pct(0.2, "乙醇溶液")], hazards: [GHS_FLAMMABLE], storage: "滴瓶，远离火源", molarMass: 318.32, aliases: ["酚酞指示剂"], ref: "exp09 §4 / exp10 §4" },
  { id: "methylOrange", nameZh: "甲基橙", formula: "C14H14N3NaO3S", phase: "aqueous", color: COLORS.orange, appearance: "橙黄色水溶液，pH 3.1~4.4 由红变黄",
    commonConcentrations: [pct(0.1)], hazards: [GHS_HEALTH], storage: "滴瓶避光", molarMass: 327.33, aliases: ["甲基橙指示剂"], ref: "exp09 §4 / exp10 §4" },

  // ── 产物：沉淀 / 气体 / 显色物种（供 phenomena.ts 引用） ────────────
  { id: "agcl", nameZh: "氯化银", formula: "AgCl", phase: "solid", color: COLORS.white, appearance: "白色凝乳状沉淀",
    commonConcentrations: [], hazards: [GHS_ENV], storage: "含银废液桶集中回收", molarMass: 143.32, ref: "exp04 §6 步2；Ksp=1.8×10⁻¹⁰" },
  { id: "agi", nameZh: "碘化银", formula: "AgI", phase: "solid", color: COLORS.yellow, appearance: "黄色沉淀",
    commonConcentrations: [], hazards: [GHS_ENV], storage: "含银废液桶集中回收", molarMass: 234.77, ref: "exp04 §6 步6；Ksp=8.5×10⁻¹⁷" },
  { id: "agbr", nameZh: "溴化银", formula: "AgBr", phase: "solid", color: COLORS.paleYellow, appearance: "淡黄色沉淀",
    commonConcentrations: [], hazards: [GHS_ENV], storage: "含银废液桶集中回收", molarMass: 187.77, ref: "exp06 §6 步5；Ksp=5.0×10⁻¹³" },
  { id: "ag2s", nameZh: "硫化银", formula: "Ag2S", phase: "solid", color: COLORS.black, appearance: "黑色沉淀",
    commonConcentrations: [], hazards: [GHS_ENV], storage: "含银废液桶集中回收", molarMass: 247.80, ref: "exp06 §6 步5" },
  { id: "baso4", nameZh: "硫酸钡", formula: "BaSO4", phase: "solid", color: COLORS.white, appearance: "白色沉淀",
    commonConcentrations: [], hazards: [GHS_NONE], storage: "重金属废液桶", molarMass: 233.39, ref: "exp02 §6 步2；Ksp=1.1×10⁻¹⁰" },
  { id: "baco3", nameZh: "碳酸钡", formula: "BaCO3", phase: "solid", color: COLORS.white, appearance: "白色沉淀",
    commonConcentrations: [], hazards: [GHS_TOXIC], storage: "重金属废液桶", molarMass: 197.34, ref: "exp02 §6 步3；Ksp=5.1×10⁻⁹" },
  { id: "caco3", nameZh: "碳酸钙", formula: "CaCO3", phase: "solid", color: COLORS.white, appearance: "白色沉淀",
    commonConcentrations: [], hazards: [GHS_NONE], storage: "一般废液桶", molarMass: 100.09, ref: "exp02 §6 步3" },
  { id: "cac2o4", nameZh: "草酸钙", formula: "CaC2O4", phase: "solid", color: COLORS.white, appearance: "白色结晶状沉淀",
    commonConcentrations: [], hazards: [GHS_IRRITANT], storage: "一般废液桶", molarMass: 128.10, ref: "exp07 §6 步6" },
  { id: "bacro4", nameZh: "铬酸钡", formula: "BaCrO4", phase: "solid", color: COLORS.yellow, appearance: "黄色沉淀",
    commonConcentrations: [], hazards: [GHS_HEALTH, GHS_ENV], storage: "含六价铬废液桶", molarMass: 253.32, ref: "exp07 §6 步6；Ksp=1.2×10⁻¹⁰" },
  { id: "cuoh2", nameZh: "氢氧化铜", formula: "Cu(OH)2", phase: "solid", color: COLORS.lightBlue, appearance: "浅蓝色沉淀",
    commonConcentrations: [], hazards: [GHS_ENV], storage: "重金属废液桶", molarMass: 97.56, ref: "exp06 §6 步3；Ksp=5.6×10⁻²⁰" },
  { id: "feoh3", nameZh: "氢氧化铁", formula: "Fe(OH)3", phase: "solid", color: COLORS.brickRed, appearance: "红褐色沉淀",
    commonConcentrations: [], hazards: [GHS_NONE], storage: "一般废液桶", molarMass: 106.87, ref: "exp07 §6 步4" },
  { id: "aloh3", nameZh: "氢氧化铝", formula: "Al(OH)3", phase: "solid", color: COLORS.white, appearance: "白色胶状沉淀",
    commonConcentrations: [], hazards: [GHS_NONE], storage: "一般废液桶", molarMass: 78.00, ref: "exp07 §6 步4" },
  { id: "mgoh2", nameZh: "氢氧化镁", formula: "Mg(OH)2", phase: "solid", color: COLORS.white, appearance: "白色沉淀",
    commonConcentrations: [], hazards: [GHS_NONE], storage: "一般废液桶", molarMass: 58.32, ref: "exp04 §6 步8" },
  { id: "znoh2", nameZh: "氢氧化锌", formula: "Zn(OH)2", phase: "solid", color: COLORS.white, appearance: "白色沉淀，两性",
    commonConcentrations: [], hazards: [GHS_ENV], storage: "重金属废液桶", molarMass: 99.39, ref: "exp07 §6 步7（Zn²⁺ 氨水/碱行为）" },
  { id: "cus", nameZh: "硫化铜", formula: "CuS", phase: "solid", color: COLORS.black, appearance: "黑色沉淀",
    commonConcentrations: [], hazards: [GHS_ENV], storage: "重金属废液桶", molarMass: 95.61, ref: "exp06 §6 步4；Ksp=6.3×10⁻³⁶" },
  { id: "co2", nameZh: "二氧化碳", formula: "CO2", phase: "gas", color: COLORS.colorless, appearance: "无色无味气体，使澄清石灰水变浑浊",
    commonConcentrations: [], hazards: [GHS_NONE], storage: "通风处逸散，不在密闭空间积聚", molarMass: 44.01, ref: "exp10 §3；exp01 §7 稀释热讨论" },
  { id: "o2", nameZh: "氧气", formula: "O2", phase: "gas", color: COLORS.colorless, appearance: "无色无味气体，助燃",
    commonConcentrations: [], hazards: [GHS_OXIDIZER], storage: "通风处逸散", molarMass: 32.00, ref: "exp05 §6 步7（H₂O₂ 分解）" },
  { id: "cl2", nameZh: "氯气", formula: "Cl2", phase: "gas", color: COLORS.paleGreen, appearance: "黄绿色有刺激性气味气体",
    commonConcentrations: [], hazards: [GHS_TOXIC, GHS_OXIDIZER], storage: "通风橱内，禁止密闭收集", molarMass: 70.90, ref: "exp07 §7 H12；通用无机化学口径" },
];

const NORMALIZE = (raw: string): string => raw.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

const SUBSTANCE_BY_ID = new Map<string, Substance>(SUBSTANCES.map((s) => [s.id.toLowerCase(), s]));

const ALIAS_INDEX = new Map<string, string>();
for (const s of SUBSTANCES) {
  for (const key of [s.id, s.formula, s.nameZh, ...(s.aliases ?? [])]) {
    const k = NORMALIZE(key);
    if (!ALIAS_INDEX.has(k)) ALIAS_INDEX.set(k, s.id);
  }
}

/** 按 id（不区分大小写）取物质；不存在返回 undefined。 */
export function getSubstance(id: string): Substance | undefined {
  return SUBSTANCE_BY_ID.get(id.trim().toLowerCase());
}

/** 同 getSubstance，但不存在时抛错——数据表里引用了不存在的物质应当早失败。 */
export function requireSubstance(id: string): Substance {
  const s = getSubstance(id);
  if (!s) throw new Error(`未知物质 id：${id}（见 lib/chem/substances.ts）`);
  return s;
}

/** 把 id / 化学式 / 中文名 / 别名解析成规范 id；不识别返回 undefined。 */
export function resolveSubstanceId(token: string): string | undefined {
  return ALIAS_INDEX.get(NORMALIZE(token));
}

/** 全部物质 id（按表内顺序）。 */
export function listSubstanceIds(): readonly string[] {
  return SUBSTANCES.map((s) => s.id);
}

/** 取某状态下所有物质，供 UI 物质架按物态分组。 */
export function listSubstancesByPhase(phase: Phase): readonly Substance[] {
  return SUBSTANCES.filter((s) => s.phase === phase);
}
