import type { DemoScript } from "../types";

/**
 * exp06 演示：正确路径 → 第 4 步一次负反馈（L3 · burn → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp06/definition.ts。
 */
export const exp06Script: DemoScript = {
  id: "exp06",
  title: "实验 06 · 配合物的生成和性质",
  page: "/exp/exp06",
  steps: [
    { kind: "caption", text: "实验 06：配合物的生成和性质。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 准备与就位（通风橱 · 编号 · 滴管校准）。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-wash" },
    { kind: "click", target: "demo-op-step1-assemble" },
    { kind: "click", target: "demo-op-step1-drop-rate" },
    { kind: "caption", text: "第 2 步 · 配离子与简单离子的区别。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-transfer" },
    { kind: "click", target: "demo-op-step2-kscn" },
    { kind: "click", target: "demo-op-step2-observe" },
    { kind: "caption", text: "第 3 步 · 铜氨配合物的生成（逐级配位）。", ms: 1500 },
    { kind: "click", target: "demo-op-step3-transfer" },
    { kind: "click", target: "demo-op-step3-add-ammonia" },
    { kind: "click", target: "demo-op-step3-read-volume" },
    { kind: "caption", text: "第 4 步 · 配位平衡的移动（加酸 / 加碱 / 加沉淀剂）。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：用 18 mol/L 浓 H₂SO₄ 代替 3 mol/L 稀硫酸去“酸化”深蓝液。", ms: 2000 },
    { kind: "click", target: "demo-op-step4-conc-acid" },
    { kind: "waitFor", target: "demo-feedback-fail-4", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-4", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step4-acid", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step4-acid" },
    { kind: "click", target: "demo-op-step4-sulfide" },
    { kind: "click", target: "demo-op-step4-alkali" },
    { kind: "caption", text: "第 5 步 · 银氨配离子与稳定性的逐级比较。", ms: 1500 },
    { kind: "click", target: "demo-op-step5-agcl" },
    { kind: "click", target: "demo-op-step5-dissolve" },
    { kind: "click", target: "demo-op-step5-three-stage" },
    { kind: "caption", text: "第 6 步 · 螯合物稳定性比较与数据、废液。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-en" },
    { kind: "click", target: "demo-op-step6-reverse" },
    { kind: "click", target: "demo-op-step6-compute" },
    { kind: "click", target: "demo-op-step6-waste" },
    { kind: "caption", text: "6 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
