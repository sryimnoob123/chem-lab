import type { DemoScript } from "../types";

/**
 * exp05 演示：正确路径 → 第 3 步一次负反馈（L3 · device-accident → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp05/definition.ts。
 */
export const exp05Script: DemoScript = {
  id: "exp05",
  title: "实验 05 · 氧化还原反应和电化学",
  page: "/exp/exp05",
  steps: [
    { kind: "caption", text: "实验 05：氧化还原反应和电化学。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 电极准备与打磨。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-bridge-check" },
    { kind: "click", target: "demo-op-step1-polish" },
    { kind: "click", target: "demo-op-step1-multimeter" },
    { kind: "caption", text: "第 2 步 · 组装原电池与盐桥。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-electrodes" },
    { kind: "click", target: "demo-op-step2-bridge" },
    { kind: "click", target: "demo-op-step2-polarity" },
    { kind: "caption", text: "第 3 步 · 电动势测定（读数规范）。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：把万用表置于直流电流档（mA）并联在两电极上测电动势。", ms: 2000 },
    { kind: "click", target: "demo-op-step3-current-mode" },
    { kind: "waitFor", target: "demo-feedback-fail-3", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-3", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step3-calibrate", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step3-calibrate" },
    { kind: "click", target: "demo-op-step3-record" },
    { kind: "click", target: "demo-op-step3-read" },
    { kind: "caption", text: "第 4 步 · 浓度/温度对电动势的影响。", ms: 1500 },
    { kind: "click", target: "demo-op-step4-series" },
    { kind: "click", target: "demo-op-step4-read" },
    { kind: "click", target: "demo-op-step4-temperature" },
    { kind: "caption", text: "第 5 步 · 酸度对氧化还原反应的影响。", ms: 1500 },
    { kind: "click", target: "demo-op-step5-chromate" },
    { kind: "click", target: "demo-op-step5-medium" },
    { kind: "click", target: "demo-op-step5-observe" },
    { kind: "caption", text: "第 6 步 · 数据处理与电极回收。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-compute" },
    { kind: "click", target: "demo-op-step6-electrode-recover" },
    { kind: "click", target: "demo-op-step6-waste" },
    { kind: "caption", text: "6 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
