/**
 * 实验 01 教学数据（BOPPPS）。
 * 文字逐字取自 docs/实验库/exp01.md：目标 §2、导入 §3、测验 §9、总结 §10。
 */

import type { Curriculum } from "./types";

export const exp01Curriculum: Curriculum = {
  id: "exp01",
  bridgeIn: "稀释热：浓硫酸与水混合放热约 85 kJ/mol（H₂SO₄），局部可使液温瞬间超过 100 ℃；水密度小、浮于酸面，若\"水入酸\"则热量集中在水层，先沸腾后爆溅。",
  objectives: [
    { competency: "K1", text: "能说明分析天平 0.1 mg 感量与\"称量结果记到小数点后 4 位\"的对应关系，并算出本实验的最小称样量（0.2 g）。" },
    { competency: "S1", text: "能独立完成\"调水平 → 校准 → 差减法称样 → 溶解转移 → 定容 → 移取\"全流程，所配 c(Na₂CO₃) 与理论值 0.1000 mol/L 相对误差 ≤0.2%。" },
    { competency: "A1", text: "能说出稀释浓硫酸\"酸入水、沿壁、搅拌、冷却\"四条要点，并在溅液时正确执行\"大量流水冲洗 ≥15 min + 报告\"。" },
  ],
  pre: [
    {
      id: "exp01-pre-1",
      stage: "pre",
      competency: "K1",
      stem: "一台感量 0.1 mg 的分析天平，用差减法称取约 1 g 试样，结果应记为：",
      options: [
        { key: "A", text: "1.1 g" },
        { key: "B", text: "1.06 g" },
        { key: "C", text: "1.060 g" },
        { key: "D", text: "1.0599 g" },
      ],
      answer: "D",
      explanation: "感量 0.1 mg = 0.0001 g，差减法两次读数均须记到小数点后 4 位，故 1.0599 g。\n另：为使称量相对误差 ≤0.1%，最小称样量 = 2×0.0001 g ÷ 0.1% = 0.2 g，本实验取 1 g 左右满足要求。",
    },
    {
      id: "exp01-pre-2",
      stage: "pre",
      competency: "A1",
      stem: "稀释浓硫酸的正确操作是：",
      options: [
        { key: "A", text: "将水沿烧杯内壁缓缓倒入浓硫酸，并不断搅拌" },
        { key: "B", text: "将浓硫酸沿烧杯内壁缓缓倒入水中，并不断搅拌" },
        { key: "C", text: "把浓硫酸与水同时倒入烧杯后搅匀" },
        { key: "D", text: "先加少量水润湿烧杯，再迅速倒入浓硫酸并快速搅匀" },
      ],
      answer: "B",
      explanation: "浓硫酸密度 1.84 g/mL，远大于水；若\"水入酸\"，水浮在上层，稀释热集中在水层使其瞬间沸腾而爆溅。\n必须\"酸入水、沿壁、缓慢、搅拌\"，必要时用冰水浴降温。",
    },
    {
      id: "exp01-pre-3",
      stage: "pre",
      competency: "S2",
      stem: "用 100 mL 容量瓶定容，读数时视线应：",
      options: [
        { key: "A", text: "俯视刻度线，便于看准" },
        { key: "B", text: "仰视刻度线，避免超过" },
        { key: "C", text: "与刻度线保持水平，使凹液面最低点与刻度线相切" },
        { key: "D", text: "从瓶口正上方垂直向下看" },
      ],
      answer: "C",
      explanation: "\"三位一线\"——眼睛、刻度线、凹液面最低点在同一条水平线上。\n俯视会使实际液面偏低（V 偏小、c 偏高），仰视反之。",
    },
  ],
  post: [
    {
      id: "exp01-post-1",
      stage: "post",
      competency: "K1",
      stem: "用 250 mL A 级容量瓶（允差 ±0.15 mL）配制溶液，其体积应记为：",
      options: [
        { key: "A", text: "250 mL" },
        { key: "B", text: "250.0 mL" },
        { key: "C", text: "250.00 mL" },
        { key: "D", text: "250.000 mL" },
      ],
      answer: "B",
      explanation: "允差 ±0.15 mL 对应 0.1 mL 量级，记录到小数点后 1 位即 4 位有效数字，故 250.0 mL。\n多写位数属虚假精度，少写位数则损失准确度信息。",
    },
    {
      id: "exp01-post-2",
      stage: "post",
      competency: "A1",
      stem: "用约 16 mol/L 的浓硝酸配制稀硝酸，下列做法正确的是：",
      options: [
        { key: "A", text: "将水沿壁缓缓倒入浓硝酸中" },
        { key: "B", text: "在通风橱内，将浓硝酸沿壁缓慢加入冰水浴冷却的水中，边加边搅拌" },
        { key: "C", text: "在开放台面上快速混合后立即加盖，减少酸雾" },
        { key: "D", text: "先倒入浓硝酸，再加等体积水稀释" },
      ],
      answer: "B",
      explanation: "与浓硫酸同理，\"酸入水\"；浓硝酸易分解逸出 NO₂（有毒），必须在通风橱内操作并冷却控温。\nA、D 均违反\"酸入水\"，C 既未控温也未在通风橱内。",
    },
    {
      id: "exp01-post-3",
      stage: "post",
      competency: "S2",
      stem: "定容时俯视刻度线，所配溶液的浓度将：",
      options: [
        { key: "A", text: "偏高" },
        { key: "B", text: "偏低" },
        { key: "C", text: "不变" },
        { key: "D", text: "无法判断" },
      ],
      answer: "A",
      explanation: "俯视时视线斜向下，\"看起来已到刻度\"而实际液面仍低于刻度，V 偏小；由 c = n/V，c 偏高。\n该偏差是系统性的，会使后续全部计算结果同向偏离。",
    },
  ],
  transfer: [],
  summary: "报告分：数据完整性 30% + 计算正确 30% + 误差分析 20% + 安全复盘 20%",
};
