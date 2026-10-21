import type { DemoScript } from "../types";

/**
 * exp07 演示：正确路径 → 第 5 步一次负反馈（L3 · toxic-gas → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp07/definition.ts。
 */
export const exp07Script: DemoScript = {
  id: "exp07",
  title: "实验 07 · 常见阳离子的分离与鉴定（一）",
  page: "/exp/exp07",
  steps: [
    { kind: "caption", text: "实验 07：常见阳离子的分离与鉴定（一）。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 器皿检查与试样准备。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-rinse" },
    { kind: "click", target: "demo-op-step1-inspect" },
    { kind: "click", target: "demo-op-step1-number" },
    { kind: "caption", text: "第 2 步 · 分组沉淀：HCl 组。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-sample" },
    { kind: "click", target: "demo-op-step2-hcl" },
    { kind: "click", target: "demo-op-step2-recheck" },
    { kind: "caption", text: "第 3 步 · 离心分离与倾析洗涤。", ms: 1500 },
    { kind: "click", target: "demo-op-step3-centrifuge" },
    { kind: "click", target: "demo-op-step3-decant" },
    { kind: "click", target: "demo-op-step3-wash" },
    { kind: "caption", text: "第 4 步 · 焰色与银组特征鉴定。", ms: 1500 },
    { kind: "click", target: "demo-op-step4-blank" },
    { kind: "click", target: "demo-op-step4-flame" },
    { kind: "click", target: "demo-op-step4-silver" },
    { kind: "caption", text: "第 5 步 · 干扰排除：NH₄⁺ 掩蔽与介质控制。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：用浓 HCl 溶解 BaCrO₄ 沉淀并加热。", ms: 2000 },
    { kind: "click", target: "demo-op-step5-conc-hcl" },
    { kind: "waitFor", target: "demo-feedback-fail-5", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-5", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step5-buffer", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step5-buffer" },
    { kind: "click", target: "demo-op-step5-carbonate" },
    { kind: "click", target: "demo-op-step5-chromate" },
    { kind: "caption", text: "第 6 步 · ds 区鉴定、结论汇总与废液分类。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-ammine" },
    { kind: "click", target: "demo-op-step6-conclusion" },
    { kind: "click", target: "demo-op-step6-waste" },
    { kind: "caption", text: "6 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
