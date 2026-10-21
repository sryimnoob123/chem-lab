/**
 * 有效数字高频问答（从 uncertainty.ts 拆出的纯数据）
 *
 * UI 的「数据记录」页可直接渲染；口径与依据写在每条的 rule / basis 里。
 */
export interface SigFigFaqItem {
  readonly id: string;
  readonly question: string;
  readonly answerSigFigs: number;
  readonly answerDisplay: string;
  readonly rule: string;
  readonly basis: string;
}

/** 高频有效数字问答，UI"数据记录"页可直接渲染（含题目要求的示例）。 */
export const SIG_FIG_FAQ: readonly SigFigFaqItem[] = [
  {
    id: "nominal-concentration-times-volume",
    question: "0.1 mol/L 与 25.00 mL 相乘，结果保留几位？",
    answerSigFigs: 3,
    answerDisplay: "2.50 mmol",
    rule: "平台口径：浓度按标称值至少 3 位（0.1 → 0.100）参与乘除；体积 25.00 为 4 位，故结果取 3 位，n = 0.100 × 25.00 = 2.50 mmol。",
    basis: "乘除法本应取有效数字最少者（0.1 字面只有 1 位）；但 0.1 mol/L 是标称浓度而非原始读数，其精度由配制记录（称样/定容/标定）决定。exp09 §8 把粗配 c 记为 0.10（2 位）；若严格按字面 1 位，2.5 mmol 按四舍六入五成双只剩 2 mmol，会丢掉实验本可分辨的精度，故平台统一按 3 位报，并在报告里注明 c 的来源。严格字面版见 SIG_FIG_FAQ 的 strict 条目。",
  },
  {
    id: "strict-literal-digits",
    question: "同一道题若严格按字面位数（0.1 只有 1 位）算呢？",
    answerSigFigs: 1,
    answerDisplay: "2 mmol",
    rule: "严格乘除规则：结果有效数字 = 各量最少者，0.1 为 1 位、25.00 为 4 位，故取 1 位；2.5 mmol 修约到 1 位为 2 mmol（四舍六入五成双）。",
    basis: "这是教科书对\"0.1\"字面位数的机械应用。实际报告若把粗配浓度记成 0.10（2 位），则结果应为 2.5 mmol（2 位）——见 exp09 §8 数据表口径。三种写法的差异必须在报告里说明，不能混用。",
  },
  {
    id: "burette-two-decimals",
    question: "滴定管读数为什么必须记到小数点后两位？",
    answerSigFigs: 4,
    answerDisplay: "24.84 mL",
    rule: "滴定管最小分度 0.1 mL，估读到分度 1/10 即 0.01 mL，故记两位小数（如 24.84），共 4 位有效数字。",
    basis: "exp09 §6 步4 / §9 前测3：读数 24.8 + 0.04 = 24.84 mL；记成 24.8 少一位、24.840 多一位（虚假精度）。初读数同样要如实记录并参与 V = V终 − V初 的减法。",
  },
];

/** 按 id 取问答条目。 */
export function getSigFigFaq(id: string): SigFigFaqItem | undefined {
  return SIG_FIG_FAQ.find((item) => item.id === id);
}

