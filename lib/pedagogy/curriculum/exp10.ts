/**
 * 实验 10 教学数据（BOPPPS）。
 * 文字逐字取自 docs/实验库/exp10.md：目标 §2、导入 §3、测验 §9、总结 §10。
 */

import type { Curriculum } from "./types";

export const exp10Curriculum: Curriculum = {
  id: "exp10",
  bridgeIn: "HCl 不能直接配成准确浓度（浓盐酸挥发性强、含量不定），只能先配近似浓度再用基准物质标定。无水 Na₂CO₃ 纯度高、稳定、摩尔质量大，是最常用的基准物质；以甲基橙为指示剂滴至橙色，碳酸根被完全中和。",
  objectives: [
    { competency: "K1", text: "能写出 Na₂CO₃ 标定 HCl 与双指示剂法两步滴定的计量关系式，并说明 V₁ 与 V₂ 的大小关系分别对应 NaOH、Na₂CO₃、NaHCO₃ 的哪一种组成。" },
    { competency: "S2", text: "能独立完成 3 份平行标定与 3 份平行双指示剂滴定，使 c(HCl) 的相对平均偏差 ≤0.3%、总碱度（以 Na₂CO₃ 计）与教师参考值的相对误差 ≤0.5%（待老师核基准与容差）。" },
    { competency: "A1", text: "能说出浓盐酸必须在通风橱内稀释、移液管严禁口吸的两条硬规矩，并在酸液溅到皮肤、热锥形瓶炸裂两种情形下按\"先冲洗/先遮挡、再报告\"的顺序正确处置。" },
  ],
  pre: [
    {
      id: "exp10-pre-1",
      stage: "pre",
      competency: "K1",
      stem: "称取 0.1500 g 已在 280 ℃ 干燥过的无水 Na₂CO₃，溶于水后以甲基橙为指示剂，滴至橙色时耗去 HCl 溶液 28.30 mL。c(HCl) 为（M(Na₂CO₃)=105.99 g·mol⁻¹）：",
      options: [
        { key: "A", text: "0.1000 mol·L⁻¹" },
        { key: "B", text: "0.05000 mol·L⁻¹" },
        { key: "C", text: "0.2000 mol·L⁻¹" },
        { key: "D", text: "0.100 mol·L⁻¹" },
      ],
      answer: "A",
      explanation: "Na₂CO₃ 与 HCl 的计量比为 1:2，c=2m/(M·V)=2×0.1500/(105.99×0.02830)=0.3000/2.9995=0.1000 mol·L⁻¹。\nB 漏掉了计量比中的 2（按 1:1 算），C 把乘 2 当成了除 2，D 数值对但只有三位有效数字——m 与 V 都是四位，c 必须报四位。",
    },
    {
      id: "exp10-pre-2",
      stage: "pre",
      competency: "A1",
      stem: "由 37% 浓盐酸配制 1000 mL 约 0.1 mol·L⁻¹ 的 HCl 溶液，下列做法正确的是：",
      options: [
        { key: "A", text: "在实验台用移液管吸取浓盐酸，直接放入容量瓶后再加水至刻度" },
        { key: "B", text: "在通风橱内戴护目镜与手套，用量筒量取浓盐酸后沿壁缓缓加入水中，搅拌、稀释至刻度" },
        { key: "C", text: "先把水加到容量瓶刻度，再把浓盐酸沿壁加入" },
        { key: "D", text: "在通风橱内把水沿壁加入盛有浓盐酸的烧杯" },
      ],
      answer: "B",
      explanation: "浓盐酸蒸气压高，敞口即持续逸出 HCl 气体，必须在通风橱内操作并戴护目镜；稀释时\"酸入水、沿壁、边加边搅\"，避免局部过热和飞溅。\nA 既不在通风橱、又违反酸入水；C 顺序错——浓盐酸直接加进容量瓶难以混匀、局部浓度过高，正确做法是先在烧杯中稀释、冷却后再转移定容；D 虽在通风橱但顺序仍是\"水入酸\"，且浓酸先受热更易逸出。",
    },
    {
      id: "exp10-pre-3",
      stage: "pre",
      competency: "S2",
      stem: "用 50 mL 酸式滴定管滴定，读取初读数时俯视、读取终读数时仰视，则算得的消耗体积 V=V终−V初 将：",
      options: [
        { key: "A", text: "偏大" },
        { key: "B", text: "偏小" },
        { key: "C", text: "无影响" },
        { key: "D", text: "无法判断" },
      ],
      answer: "A",
      explanation: "滴定管刻度自上而下增大。俯视时视线与刻度的交点落在凹液面实际位置的上方，对应数值偏小，故 V初 偏小；仰视时交点落在下方，V终 偏大。V=V终−V初 因此偏大。\nB 是把量筒（刻度自下而上）的结论套到滴定管上；C 忽略了系统性的视差方向；D 方向其实可以判定。",
    },
  ],
  post: [
    {
      id: "exp10-post-1",
      stage: "post",
      competency: "K1",
      stem: "用 HCl 标准液对某工业纯碱试液做双指示剂法滴定，酚酞终点耗 V₁=15.20 mL，甲基橙终点又耗 V₂=15.20 mL。该试样中碱的组成是：",
      options: [
        { key: "A", text: "只含 Na₂CO₃" },
        { key: "B", text: "含 NaOH 与 Na₂CO₃" },
        { key: "C", text: "含 Na₂CO₃ 与 NaHCO₃" },
        { key: "D", text: "只含 NaHCO₃" },
      ],
      answer: "A",
      explanation: "Na₂CO₃ 先被中和到 NaHCO₃（耗 V₁），NaHCO₃ 再被中和到 H₂CO₃（耗 V₂），纯 Na₂CO₃ 两段等量，故 V₁=V₂。\n若 V₁>V₂，多出的 V₁−V₂ 对应 NaOH（B）；若 V₂>V₁，多出的 V₂−V₁ 对应原有 NaHCO₃（C）；纯 NaHCO₃ 在第一终点前不显酚酞红色，V₁≈0（D）。",
    },
    {
      id: "exp10-post-2",
      stage: "post",
      competency: "A1",
      stem: "标定时少量浓盐酸溅到前臂皮肤上，最恰当的处置顺序是：",
      options: [
        { key: "A", text: "先用 NaHCO₃ 溶液中和，再用水冲" },
        { key: "B", text: "立即用大量流水冲洗 ≥15 min，脱去污染衣物，同时呼叫老师并报告" },
        { key: "C", text: "用干布擦掉，涂上凡士林" },
        { key: "D", text: "用纸巾擦净后继续滴定，实验结束后再处理" },
      ],
      answer: "B",
      explanation: "化学灼伤的第一原则是\"稀释与移除\"——大量流水既稀释酸又带走残余，冲洗越早越充分，损伤越轻；随后报告以便判断是否需要就医。\nA 中和反应本身放热，会加重组织损伤且延误冲洗；C 干擦扩大损伤面、油脂封闭创面；D 延误处置，酸在皮肤上持续作用。",
    },
    {
      id: "exp10-post-3",
      stage: "post",
      competency: "S2",
      stem: "滴定前未排除尖嘴处的气泡，滴定过程中气泡被液流带出并消失。若仍按终读数减初读数计算，所得 V 将：",
      options: [
        { key: "A", text: "偏大" },
        { key: "B", text: "偏小" },
        { key: "C", text: "不受影响" },
        { key: "D", text: "取决于指示剂种类" },
      ],
      answer: "A",
      explanation: "气泡占据的体积在滴定中被\"算进\"了放出的液量，但并未真正进入锥形瓶参与反应，故读出的体积偏大，算得的 c(HCl) 偏小（标定）或总碱度偏高（测碱）。\nB 方向相反；C 忽略了气泡体积；D 与指示剂无关，这是体积计量问题。正确做法是装液后先排气泡、调零再开始滴定。",
    },
  ],
  transfer: [],
  summary: "操作分 = clamp(100 − Σ违规扣分 − Σ事故扣分, 0, 100)；L4 触发即终止，操作分记 0 并强制安全复盘。",
};
