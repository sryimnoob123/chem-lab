import type { DemoScript } from "../types";

/**
 * exp02 演示：正确路径 → 第 5 步一次负反馈（L3 · boil-over → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp02/definition.ts。
 */
export const exp02Script: DemoScript = {
  id: "exp02",
  title: "实验 02 · 试剂级氯化钠制备",
  page: "/exp/exp02",
  steps: [
    { kind: "caption", text: "实验 02：试剂级氯化钠制备。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 粗盐溶解与除 SO₄²⁻。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-weigh" },
    { kind: "click", target: "demo-op-step1-dissolve" },
    { kind: "click", target: "demo-op-step1-bacl2" },
    { kind: "caption", text: "第 2 步 · 除 Ca²⁺、Mg²⁺ 与过量 Ba²⁺。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-naoh" },
    { kind: "click", target: "demo-op-step2-na2co3" },
    { kind: "click", target: "demo-op-step2-verify" },
    { kind: "caption", text: "第 3 步 · 过滤分离沉淀。", ms: 1500 },
    { kind: "click", target: "demo-op-step3-assemble" },
    { kind: "click", target: "demo-op-step3-filter" },
    { kind: "click", target: "demo-op-step3-wash" },
    { kind: "caption", text: "第 4 步 · 除去过量 CO₃²⁻。", ms: 1500 },
    { kind: "click", target: "demo-op-step4-acid" },
    { kind: "click", target: "demo-op-step4-boil" },
    { kind: "caption", text: "第 5 步 · 蒸发浓缩与结晶。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：蒸干后继续强热。", ms: 2000 },
    { kind: "click", target: "demo-op-step5-dry" },
    { kind: "waitFor", target: "demo-feedback-fail-5", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-5", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step5-evaporate", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step5-evaporate" },
    { kind: "click", target: "demo-op-step5-cool" },
    { kind: "caption", text: "第 6 步 · 抽滤、干燥与产率计算。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-assemble" },
    { kind: "click", target: "demo-op-step6-wash" },
    { kind: "click", target: "demo-op-step6-yield" },
    { kind: "caption", text: "6 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
