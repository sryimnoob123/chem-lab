/**
 * 实验 05 教学数据（BOPPPS）。
 * 文字逐字取自 docs/实验库/exp05.md：目标 §2、导入 §3、测验 §9、总结 §10。
 */

import type { Curriculum } from "./types";

export const exp05Curriculum: Curriculum = {
  id: "exp05",
  bridgeIn: "原电池把氧化还原反应的化学能转为电能，电动势由两电极电势之差决定，电极电势随浓度按 Nernst 方程变化：",
  objectives: [
    { competency: "K1", text: "能写出 Cu-Zn 原电池的正负极反应与电池符号，能用 Nernst 方程定量解释\"Cu²⁺ 浓度每降 10 倍，电动势降约 0.0296 V\"；能说明酸度为何改变 K₂Cr₂O₇ 的氧化性（Cr₂O₇²⁻ ⇌ 2CrO₄²⁻）。" },
    { competency: "S1", text: "能在 3 学时内独立完成电极预处理、盐桥安装、原电池装配与四个浓度点的电动势测量，单点相对误差 ≤3%，且原始记录含温度、浓度、盐桥类型。" },
    { competency: "A1", text: "能说出含 Cr(Ⅵ)、Cu²⁺、I₂ 废液的分类收集要求并正确处置；能说明浓硫酸与 30% H₂O₂ 在本实验中的两处具体风险及规避动作。" },
  ],
  pre: [
    {
      id: "exp05-pre-1",
      stage: "pre",
      competency: "K1",
      stem: "25 ℃ 下 Cu-Zn 原电池的标准电动势为 1.104 V。若只把 CuSO₄ 由 1.00 mol/L 稀释到 0.0100 mol/L，其他条件不变，电动势约为：",
      options: [
        { key: "A", text: "1.163 V" },
        { key: "B", text: "1.104 V" },
        { key: "C", text: "1.045 V" },
        { key: "D", text: "0.986 V" },
      ],
      answer: "C",
      explanation: "25 ℃ 下每稀释 10 倍，二电子电极电势降 0.0592/2 = 0.0296 V。稀释 100 倍即降\n2×0.0296 = 0.0592 V，1.104 − 0.059 ≈ 1.045 V。A 是把浓度降低当成升高，D 是符号弄反。",
    },
    {
      id: "exp05-pre-2",
      stage: "pre",
      competency: "A1",
      stem: "本实验需用 H₂SO₄ 酸化 K₂Cr₂O₇ 溶液。下列做法正确的是：",
      options: [
        { key: "A", text: "从公用架取 18 mol/L 浓 H₂SO₄，直接滴入盛液的试管" },
        { key: "B", text: "取 3 mol/L H₂SO₄，沿管壁缓慢加入并摇匀" },
        { key: "C", text: "先把 K₂Cr₂O₇ 与 KI 混合加热，再加酸" },
        { key: "D", text: "用 6 mol/L NaOH 代替 H₂SO₄ 提供\"介质\"" },
      ],
      answer: "B",
      explanation: "浓硫酸遇水放热剧烈，局部沸腾会喷溅（L4，本实验唯一 L4 事故）；C 加热会加速\nI₂ 与酸雾逸出；D 碱性下 Cr(Ⅵ) 转为 CrO₄²⁻，氧化性大幅下降，实验目的落空。",
    },
    {
      id: "exp05-pre-3",
      stage: "pre",
      competency: "S2",
      stem: "用数字万用表直流 2 V 档测原电池电动势，读数在 1.09↔1.11 V 间跳动。正确做法是：",
      options: [
        { key: "A", text: "取跳动范围的最大值" },
        { key: "B", text: "取跳动范围的最小值" },
        { key: "C", text: "等读数波动 ≤0.001 V 后读数；仍漂移则先查盐桥气泡与电极接触" },
        { key: "D", text: "换到 200 V 档再读，量程大更稳" },
      ],
      answer: "C",
      explanation: "漂移来自盐桥气泡或接触不良，属系统问题，取极值或换大量程只会把误差放大或降低分辨率。",
    },
  ],
  post: [
    {
      id: "exp05-post-1",
      stage: "post",
      competency: "K1",
      stem: "把 Cu-Zn 原电池的 Zn 半电池改为 c(Zn²⁺) = 0.0100 mol/L（Cu²⁺ 仍 1.00 mol/L），电动势将：",
      options: [
        { key: "A", text: "增大 0.0296 V" },
        { key: "B", text: "减小 0.0296 V" },
        { key: "C", text: "不变" },
        { key: "D", text: "减小 0.0592 V" },
      ],
      answer: "A",
      explanation: "E(电池) = E(正) − E(负)。Zn²⁺ 稀释使 E(Zn²⁺/Zn) 更负（降 0.0296 V），被减数变小，\n电池电动势反而升高 0.0296 V。",
    },
    {
      id: "exp05-post-2",
      stage: "post",
      competency: "A1",
      stem: "做 H₂O₂ 性质实验需 3% H₂O₂，但只找到 30% 的。正确做法是：",
      options: [
        { key: "A", text: "直接取用，浓度高反应更明显" },
        { key: "B", text: "用量筒取后塞住管口，防止气体逸出" },
        { key: "C", text: "在通风橱内稀释到 3% 再用，不塞管口，滴加不宜过快" },
        { key: "D", text: "先加热浓缩再使用，效果更好" },
      ],
      answer: "C",
      explanation: "30% H₂O₂ 在 I⁻ 或金属离子催化下剧烈分解放氧并放热，密闭会憋压致试管炸裂（L3）。\nA、D 都在放大危险；B 正是本实验 L3 事故的触发动作。",
    },
    {
      id: "exp05-post-3",
      stage: "post",
      competency: "S2",
      stem: "记录电动势原始数据时，下列哪组信息必须同时记录，否则数据无法复核？",
      options: [
        { key: "A", text: "当天气温的整数部分" },
        { key: "B", text: "测定时的溶液温度、c(Cu²⁺)/c(Zn²⁺) 与盐桥类型" },
        { key: "C", text: "万用表的品牌与型号" },
        { key: "D", text: "同组同学姓名" },
      ],
      answer: "B",
      explanation: "Nernst 方程含温度与浓度，缺任一项都算不出理论值、做不了误差分析；盐桥类型决定液接电势大小。",
    },
  ],
  transfer: [],
  summary: "报告分：数据完整性 30% + 计算正确 30% + 误差分析 20% + 安全复盘 20%。",
};
