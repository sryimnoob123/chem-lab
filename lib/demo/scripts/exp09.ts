import type { DemoScript } from "../types";

/**
 * 实验 09 标准流程：6 步正确操作 → 交卷。
 * 这些 demoId 都经过实测（scripts/walk-steps.mjs 逐步验证能推进步骤），
 * 点完引擎会走到第 7 步，交卷后进入报告页，得分为"操作 100 分"的干净路径。
 */
export const exp09Script: DemoScript = {
  id: "exp09",
  title: "实验 09 · 酸碱标准溶液的配制与浓度比较",
  page: "/exp/exp09",
  steps: [
    { kind: "caption", text: "实验 09：先配 NaOH 标准溶液，再用它比较盐酸的浓度。", ms: 2400 },
    {
      kind: "click",
      target: "demo-op-step1-transfer",
      text: "第 1 步 称量配制：戴上丁腈手套快速称 2.0 g NaOH，转入聚乙烯瓶定容。",
    },
    { kind: "caption", text: "考点：NaOH 极易吸潮，称量要快、容器不能用玻璃磨口塞。", ms: 2000 },
    {
      kind: "click",
      target: "demo-op-step1-bare-hands",
      text: "现在演示做错的样子：徒手抓取 NaOH 固体。",
    },
    {
      kind: "caption",
      text: "失败分支：器皿抖动 + 灼伤特效，两行说明——错在哪、为什么，44px 的「重做本步」可退回。",
      ms: 3000,
    },
    {
      kind: "click",
      target: "demo-retry-1",
      text: "点「重做本步」，回到这一步开头，刚才的错误只记过程、不影响继续操作。",
    },
    { kind: "caption", text: "重做后重新选择正确操作。", ms: 1600 },
    {
      kind: "click",
      target: "demo-op-step1-transfer",
      text: "戴着丁腈手套快速称量，转入聚乙烯瓶。",
    },
    {
      kind: "click",
      target: "demo-op-step2-transfer",
      text: "第 2 步 稀释浓盐酸：只能酸入水，沿壁缓缓加入并不断搅拌。",
    },
    { kind: "caption", text: "考点：反过来（水入酸）会局部暴沸，酸雾冲出伤人。", ms: 2000 },
    {
      kind: "click",
      target: "demo-op-step3-rinse",
      text: "第 3 步 洗涤润洗：滴定管用待装液润洗三次，否则残留水会稀释标准液。",
    },
    { kind: "caption", text: "考点：润洗三次是定量分析的基本功，少一次结果就偏低。", ms: 2000 },
    {
      kind: "click",
      target: "demo-op-step4-zero",
      text: "第 4 步 装液调零：排尽尖嘴气泡，液面调到 0.00 mL。",
    },
    { kind: "caption", text: "考点：气泡没排尽，读数会一路偏大，终点必然判错。", ms: 1800 },
    {
      kind: "click",
      target: "demo-op-step5-indicator",
      text: "第 5 步 移液加指示剂：移液管润洗后放液停 15 秒，加 2 滴甲基橙。",
    },
    {
      kind: "click",
      target: "demo-op-step6-read-end",
      text: "第 6 步 滴定读数：先快后慢，近终点改半滴，读凹液面最低点，估读到 0.01 mL。",
    },
    { kind: "caption", text: "考点：终点是橙色刚好转黄，并保持 30 秒不褪。", ms: 2000 },
    { kind: "caption", text: "七步做完，交卷——每一步都被记进了时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", text: "交卷，自动生成报告。", ms: 3000 },
  ],
};
