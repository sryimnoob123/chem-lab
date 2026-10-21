import type { DemoScript } from "../types";

/**
 * exp03 演示：正确路径 → 第 5 步一次负反馈（L3 · glass-break → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp03/definition.ts。
 */
export const exp03Script: DemoScript = {
  id: "exp03",
  title: "实验 03 · 醋酸电离度和电离常数测定",
  page: "/exp/exp03",
  steps: [
    { kind: "caption", text: "实验 03：醋酸电离度和电离常数测定。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 配母液与安全操作。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-assemble" },
    { kind: "click", target: "demo-op-step1-transfer" },
    { kind: "click", target: "demo-op-step1-dilute" },
    { kind: "caption", text: "第 2 步 · 移液管系列稀释。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-wash" },
    { kind: "click", target: "demo-op-step2-transfer" },
    { kind: "click", target: "demo-op-step2-dilute" },
    { kind: "caption", text: "第 3 步 · 水浴恒温与温度记录。", ms: 1500 },
    { kind: "click", target: "demo-op-step3-heat" },
    { kind: "click", target: "demo-op-step3-read" },
    { kind: "caption", text: "第 4 步 · pH 计两点校准。", ms: 1500 },
    { kind: "click", target: "demo-op-step4-wash" },
    { kind: "click", target: "demo-op-step4-calibrate" },
    { kind: "caption", text: "第 5 步 · 测 4 份样品的 pH。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：电极球泡撞击杯壁/杯底，或手持电极时滑落。", ms: 2000 },
    { kind: "click", target: "demo-op-step5-hit" },
    { kind: "waitFor", target: "demo-feedback-fail-5", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-5", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step5-wash", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step5-wash" },
    { kind: "click", target: "demo-op-step5-read" },
    { kind: "caption", text: "第 6 步 · 数据处理与电极保养。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-compute" },
    { kind: "click", target: "demo-op-step6-average" },
    { kind: "click", target: "demo-op-step6-cleanup" },
    { kind: "caption", text: "6 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
