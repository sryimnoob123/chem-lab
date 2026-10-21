/**
 * 实验 02 教学数据（BOPPPS）。
 * 文字逐字取自 docs/实验库/exp02.md：目标 §2、导入 §3、测验 §9、总结 §10。
 */

import type { Curriculum } from "./types";

export const exp02Curriculum: Curriculum = {
  id: "exp02",
  bridgeIn: "粗盐中 SO₄²⁻、Ca²⁺、Mg²⁺ 以可溶盐形式存在，用\"沉淀—过滤\"逐级除去：先加 BaCl₂ 使 SO₄²⁻ 成 BaSO₄；再以 NaOH 沉 Mg²⁺ 为 Mg(OH)₂、以 Na₂CO₃ 沉 Ca²⁺ 为 CaCO₃，同时把过量的 Ba²⁺ 沉为 BaCO₃；过滤后加 HCl 除去过量 CO₃²⁻；蒸发结晶得 NaCl。",
  objectives: [
    { competency: "K1", text: "能写出本实验 5 个沉淀反应方程式，并用 Ksp 解释\"为什么先除 SO₄²⁻、后除 Ca²⁺/Mg²⁺、最后除 CO₃²⁻\"。" },
    { competency: "S1", text: "能独立完成溶解—沉淀—过滤—除碳酸根—蒸发结晶—抽滤干燥全流程，产品纯度检验 4 项全部合格，产率落在 65%~85%。" },
    { competency: "A1", text: "能说出可溶性钡盐的毒性（口服约 0.8~1 g 可致中毒）与皮肤接触处置，能在蒸发浓缩时主动判断\"该停火的时刻\"而非蒸干。" },
  ],
  pre: [
    {
      id: "exp02-pre-1",
      stage: "pre",
      competency: "K1",
      stem: "粗盐中含 SO₄²⁻、Ca²⁺、Mg²⁺，除杂试剂的加入顺序正确的是？",
      options: [
        { key: "A", text: "Na₂CO₃ → BaCl₂ → NaOH → HCl" },
        { key: "B", text: "BaCl₂ → NaOH → Na₂CO₃ → HCl" },
        { key: "C", text: "NaOH → HCl → BaCl₂ → Na₂CO₃" },
        { key: "D", text: "BaCl₂ → HCl → NaOH → Na₂CO₃" },
      ],
      answer: "B",
      explanation: "BaCl₂ 必须先加并过量，使 SO₄²⁻ 全部成 BaSO₄（Ksp 1.1×10⁻¹⁰）；再加 NaOH 沉 Mg²⁺，加 Na₂CO₃ 沉 Ca²⁺ 并顺带沉掉过量 Ba²⁺（BaCO₃ Ksp 5.1×10⁻⁹）；HCl 必须最后加，用来除去过量 CO₃²⁻ 和 OH⁻。若先加 Na₂CO₃，后加的 Ba²⁺ 会被 CO₃²⁻ 截留成 BaCO₃，除不尽 SO₄²⁻。",
    },
    {
      id: "exp02-pre-2",
      stage: "pre",
      competency: "S2",
      stem: "需要取 5 mL 1.0 mol/L BaCl₂ 溶液，下列做法正确的是？",
      options: [
        { key: "A", text: "用移液管直接口吸，快且准" },
        { key: "B", text: "用量筒量取；不慎溅到皮肤，立即用大量流水冲洗并报告老师" },
        { key: "C", text: "用手直接伸入试剂瓶蘸取" },
        { key: "D", text: "溅到手上不用处理，可溶性钡盐无毒" },
      ],
      answer: "B",
      explanation: "可溶性钡盐有剧毒，口服约 0.8~1 g 即可致低钾血症与心律失常，严禁口吸移液管；皮肤接触应立即用大量流水冲洗。含 Ba²⁺ 废液须倒入重金属废液桶。",
    },
    {
      id: "exp02-pre-3",
      stage: "pre",
      competency: "S1",
      stem: "用 10 mL 量筒量取蒸馏水，读数 4.50 mL。下列读数做法正确的是？",
      options: [
        { key: "A", text: "俯视凹液面，读作 4.6 mL" },
        { key: "B", text: "视线与凹液面最低点水平，估读到 0.01 mL" },
        { key: "C", text: "仰视凹液面，读作 4.4 mL" },
        { key: "D", text: "只对齐刻度线，不需要估读" },
      ],
      answer: "B",
      explanation: "10 mL 量筒最小分度 0.1 mL，读数时视线与凹液面最低点相切，并估读到分度值的 1/10（0.01 mL），故记 4.50 mL（3 位有效数字）。俯视读数偏大、仰视读数偏小。",
    },
  ],
  post: [
    {
      id: "exp02-post-1",
      stage: "post",
      competency: "K1",
      stem: "现改用含 SO₄²⁻、Ca²⁺ 的粗 KCl 制备试剂级 KCl，应加入的试剂及顺序是？",
      options: [
        { key: "A", text: "K₂CO₃ → BaCl₂ → HCl" },
        { key: "B", text: "BaCl₂ → K₂CO₃ → HCl" },
        { key: "C", text: "HCl → BaCl₂ → K₂CO₃" },
        { key: "D", text: "BaCl₂ → HCl → K₂CO₃" },
      ],
      answer: "B",
      explanation: "顺序逻辑与 NaCl 完全相同——先 BaCl₂ 除 SO₄²⁻ 并过量，再 K₂CO₃ 除 Ca²⁺ 与过量 Ba²⁺，最后 HCl 除 CO₃²⁻。区别在于产品是钾盐，所以沉淀剂要用钾盐（K₂CO₃）而不是钠盐，否则引入 Na⁺ 杂质。",
    },
    {
      id: "exp02-post-2",
      stage: "post",
      competency: "S2",
      stem: "同学误饮少量 Ba(NO₃)₂ 溶液，最先应做的是？",
      options: [
        { key: "A", text: "立即报告老师并送医院，医生可用硫酸钠/硫酸镁处理" },
        { key: "B", text: "大量饮清水稀释即可，不必报告" },
        { key: "C", text: "观察 1 h 无不适再决定" },
        { key: "D", text: "服稀盐酸中和" },
      ],
      answer: "A",
      explanation: "可溶性钡盐中毒进展快（低钾血症、心律失常），必须立即报告并送医；医学上用 Na₂SO₄/MgSO₄ 使 Ba²⁺ 转为不溶的 BaSO₄。自行观察或仅饮水会延误处置。",
    },
    {
      id: "exp02-post-3",
      stage: "post",
      competency: "A1",
      stem: "制得试剂级 NaCl 3.2516 g，粗盐 5.0 g、w(NaCl)=92.50%，产率应记为？",
      options: [
        { key: "A", text: "65%（3.2516 ÷ 5.0）" },
        { key: "B", text: "70%（3.2516 ÷ 4.625，按 2 位有效数字）" },
        { key: "C", text: "70.3%（保留 3 位）" },
        { key: "D", text: "71%（四舍五入到整数）" },
      ],
      answer: "B",
      explanation: "理论产量 = 5.0 g × 0.9250 = 4.625 g（中间量不修约）；η = 3.2516 ÷ 4.625 × 100% = 70.3%。因 m₀ 只有 2 位有效数字，结果只能报 2 位，即 70%。A 漏乘纯度，产率被低估约 5 个百分点。",
    },
  ],
  transfer: [],
  summary: "报告分：数据完整性 30% + 计算正确 30% + 误差分析 20% + 安全复盘 20%。误差分析必须解释 1.373 g 损失的去向。",
};
