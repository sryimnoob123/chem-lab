/**
 * 现象条目 → 一句真实化学方程式 / 离子式。
 *
 * 键必须与 `lib/chem/phenomena-table.ts` 的条目 id 一致；新增条目时同步补一句，
 * caption 才不会是 "看 note" 这种空话。上下标一律 Unicode（₂ ³⁺ ⇌ ↓ ↑）。
 */
export const PHENOMENON_EQUATIONS: Readonly<Record<string, string>> = {
  "neutralize-naoh-hcl": "H⁺ + OH⁻ → H₂O（中和放热，无可见现象）",
  "neutralize-hac-naoh": "CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O（放热，酚酞粉红褪去）",
  "h2so4-dilution-heat": "H₂SO₄ + nH₂O → H₂SO₄·nH₂O（稀释放热，必须酸入水）",
  "naoh-dissolve-heat": "NaOH(s) → Na⁺(aq) + OH⁻(aq)（溶解放热）",
  "na2co3-hcl-co2": "CO₃²⁻ + 2H⁺ → CO₂↑ + H₂O（大量无色气泡）",
  "nahco3-hcl-co2": "HCO₃⁻ + H⁺ → CO₂↑ + H₂O（白色固体溶解并持续冒泡）",

  "agno3-nacl-agcl": "Ag⁺ + Cl⁻ → AgCl↓（白色凝乳状沉淀）",
  "agno3-ki-agi": "Ag⁺ + I⁻ → AgI↓（黄色沉淀）",
  "agno3-kbr-agbr": "Ag⁺ + Br⁻ → AgBr↓（淡黄色沉淀）",
  "agno3-na2s-ag2s": "2Ag⁺ + S²⁻ → Ag₂S↓（黑色沉淀）",
  "agcl-nh3-dissolve": "AgCl + 2NH₃·H₂O → [Ag(NH₃)₂]⁺ + Cl⁻ + 2H₂O（沉淀溶解）",
  "agcl-ki-agcl-to-agi": "AgCl + I⁻ → AgI↓ + Cl⁻（白色沉淀转黄）",
  "agbr-na2s2o3-dissolve": "AgBr + 2S₂O₃²⁻ → [Ag(S₂O₃)₂]³⁻ + Br⁻（沉淀溶解）",
  "agi-na2s2o3-no-dissolve": "AgI + S₂O₃²⁻ → 不反应（K ≈ 2.5×10⁻³ ≪ 1，黄色沉淀不消失）",
  "agno3-nh3-hcl-reprecipitate": "[Ag(NH₃)₂]⁺ + Cl⁻ + 2H⁺ → AgCl↓ + 2NH₄⁺（白色沉淀复析）",

  "cuso4-naoh-cuoh2": "Cu²⁺ + 2OH⁻ → Cu(OH)₂↓（浅蓝色沉淀）",
  "cuso4-nh3-excess-deepblue": "Cu²⁺ + 4NH₃ → [Cu(NH₃)₄]²⁺（深蓝色溶液）",
  "cuso4-na2s-cus": "Cu²⁺ + S²⁻ → CuS↓（黑色沉淀）",
  "cus-h2so4-insoluble": "CuS + 2H⁺ → 不反应（Ksp ≈ 6.3×10⁻³⁶，稀硫酸不溶）",

  "fecl3-kscn-bloodred": "Fe³⁺ + SCN⁻ → [Fe(SCN)]²⁺（血红色溶液）",
  "fecl3-naoh-feoh3": "Fe³⁺ + 3OH⁻ → Fe(OH)₃↓（红褐色沉淀）",
  "alcl3-naoh-aloh3": "Al³⁺ + 3OH⁻ → Al(OH)₃↓（白色胶状沉淀）",
  "alcl3-naoh-excess-dissolve": "Al(OH)₃ + OH⁻ → [Al(OH)₄]⁻（过量碱中溶解）",
  "znso4-naoh-znoh2": "Zn²⁺ + 2OH⁻ → Zn(OH)₂↓（白色沉淀）",
  "mgcl2-naoh-mgoh2": "Mg²⁺ + 2OH⁻ → Mg(OH)₂↓（白色沉淀）",
  "mgoh2-nh4cl-dissolve": "Mg(OH)₂ + 2NH₄⁺ → Mg²⁺ + 2NH₃·H₂O（沉淀溶解）",

  "bacl2-na2so4-baso4": "Ba²⁺ + SO₄²⁻ → BaSO₄↓（白色沉淀）",
  "bacl2-na2co3-baco3": "Ba²⁺ + CO₃²⁻ → BaCO₃↓（白色沉淀）",
  "cacl2-na2co3-caco3": "Ca²⁺ + CO₃²⁻ → CaCO₃↓（白色沉淀）",
  "cacl2-nh42c2o4-cac2o4": "Ca²⁺ + C₂O₄²⁻ → CaC₂O₄↓（白色结晶状沉淀）",
  "bacl2-k2cro4-bacro4": "Ba²⁺ + CrO₄²⁻ → BaCrO₄↓（黄色沉淀）",
  "baco3-hac-dissolve": "BaCO₃ + 2CH₃COOH → Ba²⁺ + 2CH₃COO⁻ + CO₂↑ + H₂O（沉淀溶解并冒泡）",

  "k2cr2o7-ki-acid-iodine": "Cr₂O₇²⁻ + 14H⁺ + 6I⁻ → 2Cr³⁺ + 3I₂ + 7H₂O（橙色转棕黄）",
  "k2cr2o7-naoh-chromate": "Cr₂O₇²⁻ + 2OH⁻ → 2CrO₄²⁻ + H₂O（橙色转黄色）",
  "kio3-na2so3-starch": "2IO₃⁻ + 5SO₃²⁻ + 2H⁺ → I₂ + 5SO₄²⁻ + H₂O（淀粉变蓝）",
  "h2o2-ki-starch-blue": "H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O（淀粉变蓝）",
  "h2o2-kmno4-fade": "2MnO₄⁻ + 5H₂O₂ + 6H⁺ → 2Mn²⁺ + 5O₂↑ + 8H₂O（紫红褪去）",

  "phenolphthalein-naoh-pink": "HIn(无色) + OH⁻ → In⁻(粉红) + H₂O（pH > 8.2）",
  "phenolphthalein-hcl-colorless": "HIn ⇌ H⁺ + In⁻（pH < 8.2，酚酞保持无色）",
  "phenolphthalein-na2co3-pink": "CO₃²⁻ + H₂O ⇌ HCO₃⁻ + OH⁻（酚酞变粉红）",
  "methylorange-hcl-red": "HIn⁻(黄) + H⁺ → H₂In(红)（pH < 3.1）",
  "methylorange-naoh-yellow": "H₂In(红) + OH⁻ → HIn⁻(黄) + H₂O（pH > 4.4）",

  "h2s-cuso4-cus": "Cu²⁺ + H₂S → CuS↓ + 2H⁺（黑色沉淀）",
  "h2s-agno3-ag2s": "2Ag⁺ + H₂S → Ag₂S↓ + 2H⁺（黑色沉淀）",
  "starch-i2-blue": "淀粉 + I₂ → 淀粉-I₂ 包合物（深蓝色）",
  "k3fe(cn)6-kscn-no-red": "[Fe(CN)₆]³⁻ + SCN⁻ → 不显血红色（Fe³⁺ 已被 CN⁻ 强配位）",

  "nacl-flame-yellow": "Na⁺ 焰色反应 → 黄色火焰（589 nm）",
  "kcl-flame-purple": "K⁺ 焰色反应 → 紫色火焰（须隔蓝色钴玻璃观察）",
  "nabio3-hcl-chlorine": "NaBiO₃ + 6HCl → NaCl + BiCl₃ + Cl₂↑ + 3H₂O（黄绿色气体）",
};

/** 取该条目的方程式；未配置返回 undefined，由调用方兜底。 */
export function equationFor(phenomenonId: string): string | undefined {
  return PHENOMENON_EQUATIONS[phenomenonId];
}
