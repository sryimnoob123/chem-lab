import type { DemoScript } from "../types";

/**
 * exp04 演示：正确路径 → 第 4 步一次负反馈（L3 · toxic-gas → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp04/definition.ts。
 */
export const exp04Script: DemoScript = {
  id: "exp04",
  title: "实验 04 · 沉淀的生成与溶解平衡",
  page: "/exp/exp04",
  steps: [
    { kind: "caption", text: "实验 04：沉淀的生成与溶解平衡。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 离心管对光检查。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-check" },
    { kind: "click", target: "demo-op-step1-discard" },
    { kind: "click", target: "demo-op-step1-pick" },
    { kind: "caption", text: "第 2 步 · 制备 AgCl 沉淀。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-transfer" },
    { kind: "click", target: "demo-op-step2-add" },
    { kind: "caption", text: "第 3 步 · 离心分离与洗涤。", ms: 1500 },
    { kind: "click", target: "demo-op-step3-set" },
    { kind: "click", target: "demo-op-step3-balance" },
    { kind: "click", target: "demo-op-step3-wash" },
    { kind: "caption", text: "第 4 步 · 氨溶与沉淀转化。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：在开放台面开盖浓氨水，或俯身对管口直接闻/用手扇闻。", ms: 2000 },
    { kind: "click", target: "demo-op-step4-open-nh3" },
    { kind: "waitFor", target: "demo-feedback-fail-4", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-4", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step4-ammonia", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step4-ammonia" },
    { kind: "click", target: "demo-op-step4-convert" },
    { kind: "caption", text: "第 5 步 · 分步沉淀、弱电解质溶解与废液。", ms: 1500 },
    { kind: "click", target: "demo-op-step5-fractional" },
    { kind: "click", target: "demo-op-step5-weak" },
    { kind: "click", target: "demo-op-step5-waste" },
    { kind: "caption", text: "5 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
