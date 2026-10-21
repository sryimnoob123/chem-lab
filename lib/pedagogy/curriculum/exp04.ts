/**
 * 实验 04 教学数据（BOPPPS）。
 * 文字逐字取自 docs/实验库/exp04.md：目标 §2、导入 §3、测验 §9、总结 §10。
 */

import type { Curriculum } from "./types";

export const exp04Curriculum: Curriculum = {
  id: "exp04",
  bridgeIn: "难溶电解质溶液中，离子浓度幂之积 J 与溶度积 Ksp 比较决定沉淀生成（J > Ksp）或溶解（J < Ksp）。降低任一构晶离子浓度即可使平衡右移——生成弱电解质、生成配离子或转化为更难溶的沉淀，都是\"抽走离子\"的三条路径。分步沉淀时，所需沉淀剂浓度越小者先析出；两种沉淀 Ksp 相差足够大时可完全分离。",
  objectives: [
    { competency: "K1", text: "能写出沉淀溶解平衡式与 Ksp 表达式，用 J 与 Ksp 的大小判断沉淀生成或溶解，并说明生成弱电解质、生成配离子、转化为更难溶盐三条溶解路径各自降低了什么离子的浓度。" },
    { competency: "S1", text: "能独立完成\"沉淀—离心—洗涤—溶解—转化\"全流程，AgCl 沉淀洗至末次洗液加 AgNO₃ 无浑浊，分步沉淀中先黄（AgI）后白（AgCl）的顺序可复现，实测滴数与理论值（10 / 20 滴）偏差 ≤2 滴。" },
    { competency: "A1", text: "能说出离心机配平与浓氨水必须在通风橱操作的规范，并在离心管破裂、含银废液处置两种情形下正确应对。" },
  ],
  pre: [
    {
      id: "exp04-pre-1",
      stage: "pre",
      competency: "K1",
      stem: "25 ℃ 时 Ksp(AgCl)=1.8×10⁻¹⁰、Ksp(AgBr)=5.0×10⁻¹³。向 c(Cl⁻)=c(Br⁻)=0.10 mol·L⁻¹ 的混合液中逐滴加入 AgNO₃，首先析出的是：",
      options: [
        { key: "A", text: "AgCl，因为它的 Ksp 数值更大" },
        { key: "B", text: "AgBr，因为它开始沉淀所需的 c(Ag⁺) 更小" },
        { key: "C", text: "两者同时析出，因为 c(Cl⁻)=c(Br⁻)" },
        { key: "D", text: "无法判断，需知道 AgNO₃ 的加入速度" },
      ],
      answer: "B",
      explanation: "开始沉淀所需 c(Ag⁺)=Ksp/c(卤离子)。AgBr 需 5.0×10⁻¹²，AgCl 需 1.8×10⁻⁹，前者低约 360 倍，故先达到 Ksp。\nA 把\"Ksp 大\"误当\"先沉淀\"；C 忽略了 Ksp 差异；D 混淆了\"先后顺序\"（由 Ksp 决定）与\"混合程度\"（由操作决定）。",
    },
    {
      id: "exp04-pre-2",
      stage: "pre",
      competency: "A1",
      stem: "离心前发现只有一支离心管装了样品，正确做法是：",
      options: [
        { key: "A", text: "时间短，单管离心无妨" },
        { key: "B", text: "在转子对称孔放一支装等量蒸馏水的离心管配平后离心" },
        { key: "C", text: "把样品管尽量靠近转子中心放置" },
        { key: "D", text: "用手按住离心机机身再启动" },
      ],
      answer: "B",
      explanation: "转子高速旋转时，质量偏心会产生与转速平方成正比的离心力矩，轻则剧烈振动移位，重则转子与轴承损毁、离心管甩出。\nA、C 没有消除不平衡；D 是用手对抗数百倍自重的力，只会让伤害落到人身上。",
    },
    {
      id: "exp04-pre-3",
      stage: "pre",
      competency: "S1",
      stem: "10 mL 离心管最小分度为 0.1 mL，液面凹面最低点位于 3.4 与 3.5 两条刻线正中间，正确记录为：",
      options: [
        { key: "A", text: "3 mL" },
        { key: "B", text: "3.4 mL" },
        { key: "C", text: "3.45 mL" },
        { key: "D", text: "3.450 mL" },
      ],
      answer: "C",
      explanation: "仪器读数应估读到最小分度的下一位，分度 0.1 mL → 估读到 0.01 mL，得 3.45 mL（3 位有效数字）。\nA、B 未估读；D 多估了一位，离心管达不到 0.001 mL 的精度。",
    },
  ],
  post: [
    {
      id: "exp04-post-1",
      stage: "post",
      competency: "K1",
      stem: "已知 Ksp(BaSO₄)=1.1×10⁻¹⁰、Ksp(BaCO₃)=5.1×10⁻⁹。向 c(SO₄²⁻)=c(CO₃²⁻)=0.010 mol·L⁻¹ 的混合液中逐滴加 BaCl₂，下列判断正确的是：",
      options: [
        { key: "A", text: "BaCO₃ 先沉淀，因为它的 Ksp 更大" },
        { key: "B", text: "BaSO₄ 先沉淀，所需 c(Ba²⁺)=1.1×10⁻⁸ mol·L⁻¹" },
        { key: "C", text: "两者同时沉淀，因浓度相同" },
        { key: "D", text: "BaSO₄ 先沉淀，且沉淀完全时 BaCO₃ 一定还未开始沉淀" },
      ],
      answer: "B",
      explanation: "所需 c(Ba²⁺) 分别为 1.1×10⁻⁸（BaSO₄）与 5.1×10⁻⁷（BaCO₃），BaSO₄ 先析出。\nA 方向反了；D 结论下得太早——本题 Ksp 只差 46 倍，SO₄²⁻ 沉淀完全（≤10⁻⁵）时所需 c(Ba²⁺)=1.1×10⁻⁵ 已高于 BaCO₃ 的起始值 5.1×10⁻⁷，两者会重叠，不能完全分离。这正是\"Ksp 差得不够大就分不开\"的判据。",
    },
    {
      id: "exp04-post-2",
      stage: "post",
      competency: "A1",
      stem: "实验结束，台面上有：①含 Ag⁺ 与 AgI 沉淀的离心管残液 ②用过的 KI 溶液 ③清洗后的空管。正确处置是：",
      options: [
        { key: "A", text: "①倒入水槽冲走，②③正常清洗" },
        { key: "B", text: "①连同沉淀倒入重金属废液桶，②按含碘废液回收或交教师，③清洗沥干" },
        { key: "C", text: "①加大量水稀释后倒入水槽" },
        { key: "D", text: "①静置取上清液倒掉，沉淀留在管内晾干" },
      ],
      answer: "B",
      explanation: "Ag⁺ 属重金属污染物，即使稀释也不改变总量，必须按危废分类回收；含 I⁻ 废液氧化后可能析出 I₂，也应单独收集。\nA、C 都是把污染物转移给下水；D 把沉淀留在敞口管内，干燥后扬尘且后续无人处置。",
    },
    {
      id: "exp04-post-3",
      stage: "post",
      competency: "S1",
      stem: "用最小分度为 0.5 mL 的 10 mL 刻度离心管量取蒸馏水，液面在 4.0 与 4.5 之间、偏向 4.0 一侧约五分之一处。正确记录为：",
      options: [
        { key: "A", text: "4 mL" },
        { key: "B", text: "4.1 mL" },
        { key: "C", text: "4.10 mL" },
        { key: "D", text: "4.25 mL" },
      ],
      answer: "B",
      explanation: "分度 0.5 mL 只能估读到 0.1 mL，读到 4.1 mL（2 位有效数字）。\nA 未估读；C 多估一位；D 把\"正中间\"当成了题目给的 1/5 处，读数位置判断错误。",
    },
  ],
  transfer: [],
  summary: "结构性校验（不通过即按 L2 计，不重复扣分）：AgCl 沉淀量达到理论值 14 mg 的目测下限（沉淀层 ≥2 mm）；末次洗液加 AgNO₃ 无浑浊；黄色沉淀加氨水不溶。",
};
