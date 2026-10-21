/**
 * 实验 09 教学数据（BOPPPS）。
 * 文字逐字取自 docs/实验库/exp09.md：目标 §2、导入 §3、测验 §9、总结 §10。
 */

import type { Curriculum } from "./types";

export const exp09Curriculum: Curriculum = {
  id: "exp09",
  bridgeIn: "一元强酸与强碱按 1:1 定量反应，化学计量点时物质的量相等，故用同一移液管移取等体积酸液时，消耗碱液体积比即为浓度比。",
  objectives: [
    { competency: "K1", text: "能用 c(NaOH)·V(NaOH) = c(HCl)·V(HCl) 推导\"等体积移取时消耗体积比 = 浓度比\"，并说明 0.1 mol/L 强酸强碱互滴的 pH 突跃（约 4.3~9.7）为何使酚酞与甲基橙都可作指示剂。" },
    { competency: "S2", text: "能独立完成\"配液 → 滴定管洗涤润洗 → 装液排气泡调零 → 移取加指示剂 → 半滴滴定至终点\"全流程，三次平行测定相对极差 ≤0.2%，相对极差与终点体积均在判分容差内。" },
    { competency: "A1", text: "能说出浓盐酸必须\"酸入水、沿壁、通风橱、护目镜\"以及\"碱液只用碱式滴定管和聚乙烯瓶\"的依据，并在酸/碱溅到皮肤时正确执行\"大量流水冲洗 ≥15 min + 报告\"。" },
  ],
  pre: [
    {
      id: "exp09-pre-1",
      stage: "pre",
      competency: "K1",
      stem: "用 0.1000 mol/L NaOH 标准溶液滴定 25.00 mL 盐酸，达终点时消耗 NaOH 溶液 24.80 mL。该盐酸的浓度 c(HCl) 为：",
      options: [
        { key: "A", text: "0.09920 mol/L" },
        { key: "B", text: "0.1008 mol/L" },
        { key: "C", text: "0.0992 mol/L" },
        { key: "D", text: "0.1000 mol/L" },
      ],
      answer: "A",
      explanation: "化学计量点时 c(NaOH)·V(NaOH) = c(HCl)·V(HCl)，\nc(HCl) = 0.1000 × 24.80 ÷ 25.00 = 0.09920 mol/L。\n有效数字由 24.80 与 25.00 各 4 位共同决定，结果取 4 位；\nC 少一位属丢失准确度信息，B 把比值倒过来了。",
    },
    {
      id: "exp09-pre-2",
      stage: "pre",
      competency: "A1",
      stem: "配制 0.1 mol/L 盐酸时，稀释浓盐酸的正确做法是：",
      options: [
        { key: "A", text: "将水沿烧杯内壁缓缓倒入盛有浓盐酸的烧杯中，边加边搅拌" },
        { key: "B", text: "在通风橱内、戴护目镜与手套，将浓盐酸沿壁缓慢注入水中，边加边搅拌" },
        { key: "C", text: "在开放台面快速混合后立即盖住瓶口，减少酸雾逸出" },
        { key: "D", text: "先分别量好浓盐酸与水的体积，再同时倒入烧杯" },
      ],
      answer: "B",
      explanation: "浓盐酸 ρ = 1.19 g/mL > 水，若\"水入酸\"，水浮在上层，\n溶解热（约 −75 kJ/mol HCl）集中在水层，局部瞬间过热并促使 HCl 急剧逸出，\n形成酸雾与液滴喷溅。必须\"酸入水、沿壁、缓慢、搅拌\"，并在通风橱内戴护目镜操作。\nC 未控温也未在通风橱内，D 等同随机混合，都会造成局部过热。",
    },
    {
      id: "exp09-pre-3",
      stage: "pre",
      competency: "K2",
      stem: "滴定管最小分度为 0.1 mL。某次读数时，凹液面最低点位于 24.8 mL 刻度线下方约五分之二小格处，正确记录为：",
      options: [
        { key: "A", text: "24.8 mL" },
        { key: "B", text: "24.84 mL" },
        { key: "C", text: "24.80 mL" },
        { key: "D", text: "24.840 mL" },
      ],
      answer: "B",
      explanation: "滴定管读数须估读到最小分度的 1/10，即 0.01 mL，且必须记到小数点后两位。\n24.8 + 0.04 = 24.84 mL。A 少记一位、C 把估读当 0、D 多记一位（虚假精度）。",
    },
  ],
  post: [
    {
      id: "exp09-post-1",
      stage: "post",
      competency: "K1",
      stem: "用 0.2000 mol/L 盐酸滴定 20.00 mL 氢氧化钠溶液，达终点时消耗盐酸 19.60 mL。该 NaOH 溶液的浓度为：",
      options: [
        { key: "A", text: "0.1960 mol/L" },
        { key: "B", text: "0.2041 mol/L" },
        { key: "C", text: "0.196 mol/L" },
        { key: "D", text: "0.2000 mol/L" },
      ],
      answer: "A",
      explanation: "c(NaOH) = c(HCl)·V(HCl) ÷ V(NaOH) = 0.2000 × 19.60 ÷ 20.00 = 0.1960 mol/L。\n滴定方向反过来不影响计量关系，仍按\"浓度 × 体积 = 浓度 × 体积\"列式；\nB 是取倒数（0.2000 × 20.00 ÷ 19.60）的错误结果，C 位数不足。",
    },
    {
      id: "exp09-post-2",
      stage: "post",
      competency: "A1",
      stem: "关于 0.1 mol/L NaOH 溶液的配制与保存，下列说法正确的是：",
      options: [
        { key: "A", text: "应盛放在玻璃细口瓶中并配玻璃磨口塞，便于长期保存" },
        { key: "B", text: "应盛放在聚乙烯瓶中，用橡胶塞或塑料螺纹盖，并贴标签注明浓度与日期" },
        { key: "C", text: "碱式滴定管装碱前不必检查橡胶管与玻璃珠，只要不漏就行" },
        { key: "D", text: "皮肤沾上碱液后，先用稀盐酸中和再用水冲洗" },
      ],
      answer: "B",
      explanation: "2NaOH + SiO₂ → Na₂SiO₃ + H₂O，碱液会腐蚀玻璃磨口使其黏结、瓶塞打不开，\n故碱液必须用聚乙烯瓶保存、用碱式滴定管量取（橡胶管+玻璃珠，用前须检查老化与卡阻）。\nD 尤其危险：酸碱中和放热，会加重组织损伤，正确做法是立即大量流水冲洗 ≥15 min 并报告。",
    },
    {
      id: "exp09-post-3",
      stage: "post",
      competency: "K2",
      stem: "某次滴定初读数为 0.02 mL，终读数为 23.10 mL，消耗体积应记为：",
      options: [
        { key: "A", text: "23.1 mL" },
        { key: "B", text: "23.08 mL" },
        { key: "C", text: "23.080 mL" },
        { key: "D", text: "23.10 mL" },
      ],
      answer: "B",
      explanation: "V = 23.10 − 0.02 = 23.08 mL。两次读数都读到 0.01 mL（两位小数），\n其差值仍记两位小数、共 4 位有效数字。A 少一位；C 多一位属虚假精度；\nD 忘了减初读数——滴定管从不为\"正好 0.00\"起读，初读数必须如实参与计算。",
    },
  ],
  transfer: [],
  summary: "L4 触发即终止本次实验：操作分记 0，须完成安全复盘并重做。",
};
