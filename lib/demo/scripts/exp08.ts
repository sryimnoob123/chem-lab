import type { DemoScript } from "../types";

/**
 * exp08 演示：正确路径 → 第 2 步一次负反馈（L3 · device-accident → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp08/definition.ts。
 */
export const exp08Script: DemoScript = {
  id: "exp08",
  title: "实验 08 · 清点仪器，分析天平称量练习",
  page: "/exp/exp08",
  steps: [
    { kind: "caption", text: "实验 08：清点仪器，分析天平称量练习。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 清点认领仪器。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-bottle" },
    { kind: "click", target: "demo-op-step1-silica" },
    { kind: "click", target: "demo-op-step1-sign" },
    { kind: "caption", text: "第 2 步 · 分析天平的构造认知。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：用手指触摸、拨动刀口和吊耳，或抓着横梁把天平挪位。", ms: 2000 },
    { kind: "click", target: "demo-op-step2-touch" },
    { kind: "waitFor", target: "demo-feedback-fail-2", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-2", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step2-structure", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step2-structure" },
    { kind: "click", target: "demo-op-step2-nameplate" },
    { kind: "caption", text: "第 3 步 · 调平、预热与校准。", ms: 1500 },
    { kind: "click", target: "demo-op-step3-level" },
    { kind: "click", target: "demo-op-step3-preheat" },
    { kind: "click", target: "demo-op-step3-zero" },
    { kind: "caption", text: "第 4 步 · 固定质量称量 0.5000 g NaCl。", ms: 1500 },
    { kind: "click", target: "demo-op-step4-paper" },
    { kind: "click", target: "demo-op-step4-add" },
    { kind: "click", target: "demo-op-step4-adjust" },
    { kind: "caption", text: "第 5 步 · 递减法连续称三份。", ms: 1500 },
    { kind: "click", target: "demo-op-step5-weigh" },
    { kind: "click", target: "demo-op-step5-transfer" },
    { kind: "click", target: "demo-op-step5-compute" },
    { kind: "caption", text: "第 6 步 · 原始记录与数据处理。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-ink" },
    { kind: "click", target: "demo-op-step6-strike" },
    { kind: "click", target: "demo-op-step6-compute" },
    { kind: "caption", text: "第 7 步 · 自查、清扫与复原。", ms: 1500 },
    { kind: "click", target: "demo-op-step7-check" },
    { kind: "click", target: "demo-op-step7-brush" },
    { kind: "click", target: "demo-op-step7-shutdown" },
    { kind: "caption", text: "7 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
