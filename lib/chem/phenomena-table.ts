/**
 * 现象数据表（chem-model 独占文件 · 纯数据）
 *
 * 每条现象 = 试剂组合 + 可选条件 → 可判定的现象（沉淀/气体/变色/放热）。
 * 查表逻辑在 ./phenomena.ts，这里只放类型与数据，便于单测直接遍历校验。
 * 颜色一律 hex（契约 §3 的 liquid.color / precipitate.color 直接消费）。
 * 每条数据的 `ref` 写口径来源；存疑条目 `uncertain: true` 或在 note 里标【待核】。
 */

import { COLORS } from "./substances";

export type Temperature = "room" | "heated";
export type Medium = "acidic" | "neutral" | "basic";
export type ObserveMethod = "flameTest" | "default";

export interface PhenomenaCondition {
  readonly temperature?: Temperature;
  readonly medium?: Medium;
  /** 某试剂过量时才有该现象（如氨水过量才生成铜氨配离子深蓝色） */
  readonly excessOf?: string;
  readonly method?: ObserveMethod;
}

export interface PrecipitateSpec {
  readonly substance: string;
  readonly color: string;
  readonly appearance?: string;
  /** 继续加过量试剂后沉淀消失（配位/弱电解质/两性溶解） */
  readonly dissolvesInExcess?: boolean;
}

export interface GasSpec {
  readonly substance: string;
  readonly color: string;
  readonly bubbles: boolean;
  readonly odor?: string;
}

export interface ColorChangeSpec {
  readonly from: string;
  readonly to: string;
  readonly description: string;
}

export interface Phenomenon {
  readonly precipitate?: PrecipitateSpec;
  readonly gas?: GasSpec;
  readonly colorChange?: ColorChangeSpec;
  readonly heat?: boolean;
  readonly note: string;
  readonly ref: string;
  readonly uncertain?: boolean;
}

export interface PhenomenaEntry extends Phenomenon {
  readonly id: string;
  readonly reagents: readonly string[];
  readonly condition?: PhenomenaCondition;
}

/** lookup 命中：现象字段直接平铺在结果上（契约里 UI 只读现象字段）。 */
export interface LookupHit extends Phenomenon {
  readonly matched: true;
  readonly unknown: false;
  readonly id: string;
  readonly reagents: readonly string[];
  readonly condition?: PhenomenaCondition;
}

/** lookup 未命中：绝不瞎编，返回提示与相关条目建议。 */
export interface LookupMiss {
  readonly matched: false;
  readonly unknown: true;
  readonly hint: string;
  /** 与该组合部分相关的已收录条目 id（最多 3 条） */
  readonly suggestions: readonly string[];
}

export type LookupResult = LookupHit | LookupMiss;

const E = (
  id: string,
  reagents: readonly string[],
  phenomenon: Phenomenon,
  condition?: PhenomenaCondition,
): PhenomenaEntry => ({ id, reagents, ...phenomenon, ...(condition ? { condition } : {}) });

const ACID: PhenomenaCondition = { medium: "acidic" };
const BASE: PhenomenaCondition = { medium: "basic" };
const EXCESS = (id: string): PhenomenaCondition => ({ excessOf: id });

const WHITE = COLORS.white;
const YELLOW = COLORS.yellow;

export const PHENOMENA: readonly PhenomenaEntry[] = [
  // ── 中和、溶解热、气体 ─────────────────────────────────────────
  E("neutralize-naoh-hcl", ["naoh", "hcl"],
    { heat: true, note: "强酸强碱按 1:1 中和，无可见现象但放热；终点只能靠指示剂判断（酚酞粉红褪去 / 甲基橙黄变橙）。",
      ref: "exp09 §3；中和热约 −57 kJ/mol（教材附录口径）" }),
  E("neutralize-hac-naoh", ["hac", "naoh"],
    { heat: true, note: "弱酸与强碱中和，放热略少；酚酞由粉红变无色即终点。", ref: "exp03 §3 / §6" }),
  E("h2so4-dilution-heat", ["h2so4", "distilledWater"],
    { heat: true, note: "浓硫酸稀释放热约 85 kJ/mol，必须酸入水、沿壁、搅拌、冷却；水入酸会局部沸腾爆溅。",
      ref: "exp01 §3 原理；exp01 §7 事故 H1" }),
  E("naoh-dissolve-heat", ["naoh", "distilledWater"],
    { heat: true, note: "NaOH 溶解放热；未冷却即定容会使冷却后液面低于刻度、c 偏低约 1%。", ref: "exp09 §6 步1 事故 H9" }),
  E("na2co3-hcl-co2", ["na2co3", "hcl"],
    { gas: { substance: "co2", color: WHITE, bubbles: true, odor: "无味" },
      note: "产生大量无色无味气泡（CO₂），可使澄清石灰水变浑浊；标定时须煮沸驱尽 CO₂ 再判终点。",
      ref: "exp10 §3 / §6 步4" }),
  E("nahco3-hcl-co2", ["nahco3", "hcl"],
    { gas: { substance: "co2", color: WHITE, bubbles: true, odor: "无味" },
      note: "白色固体溶解并持续冒泡（CO₂）；酚酞终点前只中和到 HCO₃⁻，甲基橙终点才完全中和。",
      ref: "exp10 §3 双指示剂法" }),

  // ── 银体系：沉淀、配位溶解、转化 ───────────────────────────────
  E("agno3-nacl-agcl", ["agno3", "nacl"],
    { precipitate: { substance: "agcl", color: WHITE, appearance: "白色凝乳状" },
      note: "白色凝乳状 AgCl；取上清液再加 NaCl 无新浑浊即沉淀完全。", ref: "exp04 §6 步2；Ksp(AgCl)=1.8×10⁻¹⁰" }),
  E("agno3-ki-agi", ["agno3", "ki"],
    { precipitate: { substance: "agi", color: YELLOW, appearance: "黄色沉淀" },
      note: "黄色 AgI 沉淀，Ksp 比 AgCl 小 7 个数量级，先于 AgCl 析出。", ref: "exp04 §6 步6；Ksp(AgI)=8.5×10⁻¹⁷" }),
  E("agno3-kbr-agbr", ["agno3", "kbr"],
    { precipitate: { substance: "agbr", color: COLORS.paleYellow, appearance: "淡黄色沉淀" },
      note: "淡黄色 AgBr 沉淀；可被过量 S₂O₃²⁻ 配位溶解。", ref: "exp06 §6 步5；Ksp(AgBr)=5.0×10⁻¹³" }),
  E("agno3-na2s-ag2s", ["agno3", "na2s"],
    { precipitate: { substance: "ag2s", color: COLORS.black, appearance: "黑色沉淀" },
      note: "黑色 Ag₂S 沉淀，Ksp 极小，稀酸不溶。", ref: "exp06 §6 步5；exp07 §6 步3" }),
  E("agcl-nh3-dissolve", ["agcl", "nh3"],
    { precipitate: { substance: "agcl", color: WHITE, appearance: "白色沉淀逐渐消失", dissolvesInExcess: true },
      note: "须用 6 mol/L 氨水逐滴加至沉淀恰好消失，得澄清银氨溶液；K≈2.0×10⁻³ 偏小，稀氨水溶不动。银氨溶液当日加酸破坏，禁止加热蒸干（Ag₃N 爆炸）。",
      ref: "exp04 §6 步5；exp06 §3 / §6 步5" }),
  E("agcl-ki-agcl-to-agi", ["agcl", "ki"],
    { colorChange: { from: "白色", to: "黄色", description: "沉淀由白转黄，AgCl 转化为更难溶的 AgI" },
      note: "K=2.1×10⁶，转化进行到底；黄色 AgI 不溶于氨水，可据此与 AgCl 区分。", ref: "exp04 §6 步6" }),
  E("agbr-na2s2o3-dissolve", ["agbr", "na2s2o3"],
    { precipitate: { substance: "agbr", color: COLORS.paleYellow, appearance: "淡黄色沉淀溶解", dissolvesInExcess: true },
      note: "K=Ksp·β≈15，过量 S₂O₃²⁻ 可把 AgBr 溶完（摄影定影原理）。", ref: "exp06 §3 / §6 步5" }),
  E("agi-na2s2o3-no-dissolve", ["agi", "na2s2o3"],
    { note: "K≈2.5×10⁻³≪1，S₂O₃²⁻ 溶不动 AgI，黄色沉淀不消失。", ref: "exp06 §11 延伸题" }),
  E("agno3-nh3-hcl-reprecipitate", ["agno3", "nh3", "hcl"],
    { precipitate: { substance: "agcl", color: WHITE, appearance: "酸化后白色重新析出" },
      note: "银氨溶液加 HNO₃/HCl 酸化即破坏配离子、白色 AgCl 复析；须随即倒入含银废液桶，不留存、不加热。",
      ref: "exp07 §6 步3 / 事故 H5" }),

  // ── 铜 / 铁 / 铝 / 镁 / 锌 ─────────────────────────────────────
  E("cuso4-naoh-cuoh2", ["cuso4", "naoh"],
    { precipitate: { substance: "cuoh2", color: COLORS.lightBlue, appearance: "浅蓝色沉淀" },
      note: "浅蓝色 Cu(OH)₂ 沉淀；氨水少量时也先生成同类浅蓝色碱式盐沉淀。", ref: "exp06 §6 步3；Ksp(Cu(OH)₂)=5.6×10⁻²⁰" }),
  E("cuso4-nh3-excess-deepblue", ["cuso4", "nh3"],
    { colorChange: { from: "浅蓝", to: "深蓝", description: "沉淀溶解，溶液转为深蓝色 [Cu(NH₃)₄]²⁺" },
      note: "须氨水过量至沉淀恰好消失；β₄=2.1×10¹³，深蓝色为 Cu²⁺ 鉴定特征。",
      ref: "exp06 §6 步3；exp07 §6 步7" }, EXCESS("nh3")),
  E("cuso4-na2s-cus", ["cuso4", "na2s"],
    { precipitate: { substance: "cus", color: COLORS.black, appearance: "黑色沉淀" },
      note: "黑色 CuS 沉淀，Ksp=6.3×10⁻³⁶，稀硫酸不溶——配位平衡被沉淀彻底拉断（不可逆）。", ref: "exp06 §6 步4" }),
  E("cus-h2so4-insoluble", ["cus", "h2so4"],
    { note: "黑色 CuS 不溶于稀硫酸（Ksp 极小），不能据此说\"配位平衡都不可逆\"。", ref: "exp06 §6 步4 / 事故 H11" }),
  E("fecl3-kscn-bloodred", ["fecl3", "kscn"],
    { colorChange: { from: "黄棕", to: "血红", description: "生成 [Fe(SCN)]²⁺，溶液呈血红色" },
      note: "游离 Fe³⁺ 与 SCN⁻ 配位显血红色，是 Fe³⁺ 的特征鉴定；配离子中 Fe³⁺ 被强配位则不复显色。", ref: "exp06 §6 步2；exp07 §6 步4" }),
  E("fecl3-naoh-feoh3", ["fecl3", "naoh"],
    { precipitate: { substance: "feoh3", color: COLORS.brickRed, appearance: "红褐色沉淀" },
      note: "红褐色 Fe(OH)₃ 沉淀，不溶于过量 NaOH，可与两性 Al(OH)₃ 分离。", ref: "exp07 §6 步4" }),
  E("alcl3-naoh-aloh3", ["alcl3", "naoh"],
    { precipitate: { substance: "aloh3", color: WHITE, appearance: "白色胶状沉淀" },
      note: "白色胶状 Al(OH)₃；继续加过量 NaOH 会因两性而溶解。", ref: "exp07 §6 步4" }),
  E("alcl3-naoh-excess-dissolve", ["alcl3", "naoh"],
    { precipitate: { substance: "aloh3", color: WHITE, appearance: "白色胶状沉淀溶解", dissolvesInExcess: true },
      note: "Al(OH)₃ 两性，过量 NaOH 生成 [Al(OH)₄]⁻ 而溶解；Fe(OH)₃ 不溶，据此分离 Al³⁺/Fe³⁺。",
      ref: "exp07 §6 步4" }, EXCESS("naoh")),
  E("znso4-naoh-znoh2", ["znso4", "naoh"],
    { precipitate: { substance: "znoh2", color: WHITE, appearance: "白色沉淀" },
      note: "白色 Zn(OH)₂；与 Al(OH)₃ 同为两性，过量 NaOH 中生成 [Zn(OH)₄]²⁻。", ref: "exp07 §6 步7" }),
  E("mgcl2-naoh-mgoh2", ["mgcl2", "naoh"],
    { precipitate: { substance: "mgoh2", color: WHITE, appearance: "白色沉淀" },
      note: "白色 Mg(OH)₂ 沉淀；Mg²⁺ 需在 pH≈11 下用 OH⁻ 沉，CO₃²⁻ 沉不彻底。", ref: "exp04 §6 步8；exp02 §6 步3" }),
  E("mgoh2-nh4cl-dissolve", ["mgoh2", "nh4cl"],
    { precipitate: { substance: "mgoh2", color: WHITE, appearance: "白色沉淀溶解", dissolvesInExcess: true },
      note: "NH₄⁺ 结合 OH⁻ 生成 NH₃·H₂O，Mg(OH)₂ 溶解平衡右移；换 NaCl 无此作用（不生成弱电解质）。", ref: "exp04 §6 步8 / 事故 H11" }),

  // ── 钡 / 钙 / 铬酸根 ───────────────────────────────────────────
  E("bacl2-na2so4-baso4", ["bacl2", "na2so4"],
    { precipitate: { substance: "baso4", color: WHITE, appearance: "白色沉淀" },
      note: "白色 BaSO₄，Ksp=1.1×10⁻¹⁰；加 BaCl₂ 后取上清液回检无浑浊才叫\"除尽\"。", ref: "exp02 §6 步2" }),
  E("bacl2-na2co3-baco3", ["bacl2", "na2co3"],
    { precipitate: { substance: "baco3", color: WHITE, appearance: "白色沉淀" },
      note: "白色 BaCO₃，用于沉淀过量的 Ba²⁺；可溶于 HAc 并放出 CO₂。", ref: "exp02 §6 步3" }),
  E("cacl2-na2co3-caco3", ["cacl2", "na2co3"],
    { precipitate: { substance: "caco3", color: WHITE, appearance: "白色沉淀" },
      note: "白色 CaCO₃；Na₂CO₃ 同时除去 Ca²⁺ 与过量 Ba²⁺。", ref: "exp02 §6 步3" }),
  E("cacl2-nh42c2o4-cac2o4", ["cacl2", "nh42c2o4"],
    { precipitate: { substance: "cac2o4", color: WHITE, appearance: "白色结晶状沉淀" },
      note: "白色 CaC₂O₄ 结晶，Ca²⁺ 特征鉴定；在 HAc 介质中与 BaCrO₄ 分离后检出。", ref: "exp07 §6 步6" }),
  E("bacl2-k2cro4-bacro4", ["bacl2", "k2cro4"],
    { precipitate: { substance: "bacro4", color: YELLOW, appearance: "黄色沉淀" },
      note: "黄色 BaCrO₄；HAc 介质（pH≈2.3）下只析出 BaCrO₄ 而 Ca²⁺ 留液，是 Ba/Ca 分离的判据。", ref: "exp07 §6 步6" }),
  E("baco3-hac-dissolve", ["baco3", "hac"],
    { gas: { substance: "co2", color: WHITE, bubbles: true, odor: "无味" },
      note: "白色沉淀溶解并冒泡（CO₂）；用 HAc 溶碳酸盐可避免引入 SO₄²⁻，否则 BaSO₄ 白色会盖住黄色 BaCrO₄。",
      ref: "exp07 §6 步6 / 事故 H11" }),

  // ── 氧化还原显色 ──────────────────────────────────────────────
  E("k2cr2o7-ki-acid-iodine", ["k2cr2o7", "ki"],
    { colorChange: { from: "橙色", to: "棕黄", description: "析出 I₂，溶液由橙转棕黄；加淀粉变蓝" },
      note: "Cr₂O₇²⁻+14H⁺+6e⁻→2Cr³⁺+7H₂O；酸度不足反应不明显，碱性下 Cr(Ⅵ) 转为 CrO₄²⁻、氧化性大降。",
      ref: "exp05 §3 / §6 步5" }, ACID),
  E("k2cr2o7-naoh-chromate", ["k2cr2o7", "naoh"],
    { colorChange: { from: "橙色", to: "黄色", description: "Cr₂O₇²⁻ 转为 CrO₄²⁻，溶液变黄" },
      note: "碱性条件下 Cr(Ⅵ) 以黄色 CrO₄²⁻ 存在，氧化能力显著下降，故酸性介质才与 I⁻ 明显反应。",
      ref: "exp05 §3 / §6 步5" }, BASE),
  E("kio3-na2so3-starch", ["kio3", "na2so3", "starch"],
    { colorChange: { from: "无色", to: "蓝色", description: "IO₃⁻ 过量时生成 I₂，淀粉变蓝" },
      note: "继续逐滴加 Na₂SO₃ 至蓝色恰好褪去（I₂ 被还原为 I⁻）；两段用量比约 5:1，一次倒入会看不到渐变。",
      ref: "exp05 §6 步6" }),
  E("h2o2-ki-starch-blue", ["h2o2", "ki", "starch"],
    { colorChange: { from: "无色", to: "蓝色", description: "H₂O₂ 氧化 I⁻ 生成 I₂，淀粉变蓝" },
      note: "H₂O₂ 作氧化剂（O 由 −1→−2）；须用 3% 而非 30%，30% 与塞口加热会冲开管口。", ref: "exp05 §6 步7" }, ACID),
  E("h2o2-kmno4-fade", ["h2o2", "kmno4"],
    { colorChange: { from: "紫红", to: "近无色", description: "紫红色褪去（Mn²⁺ 近无色）" },
      gas: { substance: "o2", color: WHITE, bubbles: true, odor: "无味" },
      note: "H₂O₂ 作还原剂放出 O₂；紫红褪尽即终点，两管分别证明 H₂O₂ 的氧化性与还原性。", ref: "exp05 §6 步7" }, ACID),

  // ── 指示剂 ───────────────────────────────────────────────────
  E("phenolphthalein-naoh-pink", ["phenolphthalein", "naoh"],
    { colorChange: { from: "无色", to: "粉红", description: "pH>8.2 酚酞显粉红" },
      note: "终点为浅粉红且 30 s 不褪；颜色过深说明碱过量、V(NaOH) 偏大。", ref: "exp09 §4 / §6 步6" }),
  E("phenolphthalein-hcl-colorless", ["phenolphthalein", "hcl"],
    { note: "酸性下酚酞无色（变色 pH 8.2~10.0）；加 2 滴即足够，多加会消耗碱并使终点不敏锐。", ref: "exp09 §6 步5 / 事故 H11" }),
  E("phenolphthalein-na2co3-pink", ["phenolphthalein", "na2co3"],
    { colorChange: { from: "无色", to: "粉红", description: "CO₃²⁻ 水解显碱性，酚酞变粉红" },
      note: "双指示剂法第一终点：酚酞红色刚好消失时 CO₃²⁻ 只被中和到 HCO₃⁻。", ref: "exp10 §3 / §6 步7" }),
  E("methylorange-hcl-red", ["methylorange", "hcl"],
    { colorChange: { from: "黄", to: "红", description: "pH<3.1 甲基橙显红" },
      note: "强酸滴碱时由黄变红；标定碳酸钠须滴至橙色（黄变橙）而非红色终点。", ref: "exp10 §6 步3/步4" }),
  E("methylorange-naoh-yellow", ["methylorange", "naoh"],
    { colorChange: { from: "红", to: "黄", description: "pH>4.4 甲基橙显黄" },
      note: "NaOH 滴 HCl 时由红变黄，变色点略早于化学计量点，V(NaOH) 偏小约 0.1%。", ref: "exp09 §9 迁移题参考要点" }),

  // ── 其他鉴定 / 储备 ───────────────────────────────────────────
  E("h2s-cuso4-cus", ["h2s", "cuso4"],
    { precipitate: { substance: "cus", color: COLORS.black, appearance: "黑色沉淀" },
      note: "H₂S 水通入 Cu²⁺ 溶液生成黑色 CuS，是硫化氢分组中 Cu²⁺ 的沉淀判据。", ref: "任务书点名；exp07 阳离子分组口径" }),
  E("h2s-agno3-ag2s", ["h2s", "agno3"],
    { precipitate: { substance: "ag2s", color: COLORS.black, appearance: "黑色沉淀" },
      note: "黑色 Ag₂S 沉淀，Ksp 极小；含银废液须入重金属桶。", ref: "任务书点名；exp07 阳离子分组口径" }),
  E("starch-i2-blue", ["starch", "i2"],
    { colorChange: { from: "无色", to: "深蓝", description: "I₂ 与淀粉生成深蓝色包合物" },
      note: "碘量法经典指示：蓝色出现/褪去对应 I₂ 的生成/消耗。", ref: "exp05 §6 步5/步6" }),
  E("k3fe(cn)6-kscn-no-red", ["k3fe(cn)6", "kscn"],
    { note: "Fe³⁺ 已被 CN⁻ 强配位（β=1.0×10⁴²），游离 c(Fe³⁺) 极低，加 KSCN 不显血红色，溶液仍黄绿。",
      ref: "exp06 §6 步2" }),
  E("nacl-flame-yellow", ["nacl"],
    { colorChange: { from: "无色", to: COLORS.yellow, description: "焰色反应呈黄色（Na⁺）" },
      note: "Na⁺ 焰色黄色肉眼极易辨；K⁺ 的紫色会被钠黄掩盖，须隔蓝色钴玻璃观察。", ref: "exp07 §6 步2" },
    { method: "flameTest" }),
  E("kcl-flame-purple", ["kcl"],
    { colorChange: { from: "无色", to: COLORS.purple, description: "隔蓝色钴玻璃见紫色火焰（K⁺）" },
      note: "K⁺ 焰色须隔蓝色钴玻璃滤去钠黄；可与钴亚硝酸钠法（黄色沉淀）互相印证。", ref: "exp07 §6 步2" },
    { method: "flameTest" }),
  E("nabio3-hcl-chlorine", ["nabio3", "hcl"],
    { gas: { substance: "cl2", color: COLORS.paleGreen, bubbles: true, odor: "刺激性" },
      colorChange: { from: "黄色固体", to: "黄绿色气体", description: "强氧化剂氧化 Cl⁻ 放出 Cl₂" },
      note: "【待核】本批 10 个实验未使用 NaBiO₃；按强氧化剂通性暂列，若教学内容不涉及可删。",
      ref: "【待核】任务书点名；强氧化剂与浓盐酸反应通性", uncertain: true }),
];
