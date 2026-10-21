import type { DemoScript } from "../types";

/**
 * exp10 演示：正确路径 → 第 3 步一次负反馈（L3 · boil-over → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp10/definition.ts。
 */
export const exp10Script: DemoScript = {
  id: "exp10",
  title: "实验 10 · 盐酸标准溶液的标定与工业纯碱总碱度的测定",
  page: "/exp/exp10",
  steps: [
    { kind: "caption", text: "实验 10：盐酸标准溶液的标定与工业纯碱总碱度的测定。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 基准物准备、差减法称量与溶解。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-check" },
    { kind: "click", target: "demo-op-step1-weigh" },
    { kind: "click", target: "demo-op-step1-dissolve" },
    { kind: "caption", text: "第 2 步 · 滴定管检漏、装液、排气泡与调零。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-leak" },
    { kind: "click", target: "demo-op-step2-rinse-fill" },
    { kind: "click", target: "demo-op-step2-zero" },
    { kind: "caption", text: "第 3 步 · 标定滴定至近终点与煮沸驱 CO₂。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：大火强沸驱 CO₂，锥形瓶口对着自己或旁边同学。", ms: 2000 },
    { kind: "click", target: "demo-op-step3-boil-over" },
    { kind: "waitFor", target: "demo-feedback-fail-3", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-3", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step3-titrate", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step3-titrate" },
    { kind: "click", target: "demo-op-step3-half-drop" },
    { kind: "click", target: "demo-op-step3-boil-cool" },
    { kind: "caption", text: "第 4 步 · 判终点与滴定管读数。", ms: 1500 },
    { kind: "click", target: "demo-op-step4-endpoint" },
    { kind: "click", target: "demo-op-step4-read" },
    { kind: "click", target: "demo-op-step4-check" },
    { kind: "caption", text: "第 5 步 · 平行测定与双指示剂数据。", ms: 1500 },
    { kind: "click", target: "demo-op-step5-parallel" },
    { kind: "click", target: "demo-op-step5-sample" },
    { kind: "click", target: "demo-op-step5-double" },
    { kind: "caption", text: "第 6 步 · 计算 c(HCl)、总碱度与结果校核。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-c" },
    { kind: "click", target: "demo-op-step6-w" },
    { kind: "click", target: "demo-op-step6-check" },
    { kind: "caption", text: "6 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
