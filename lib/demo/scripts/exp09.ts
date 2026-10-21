import type { DemoScript } from "../types";

/**
 * exp09 演示：正确路径 → 第 4 步一次负反馈（L3 · glass-break → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp09/definition.ts。
 */
export const exp09Script: DemoScript = {
  id: "exp09",
  title: "实验 09 · 酸碱标准溶液的配制与浓度比较",
  page: "/exp/exp09",
  steps: [
    { kind: "caption", text: "实验 09：酸碱标准溶液的配制与浓度比较。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 称 NaOH 配约 0.1 mol/L 溶液 500 mL。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-weigh" },
    { kind: "click", target: "demo-op-step1-dissolve" },
    { kind: "click", target: "demo-op-step1-transfer" },
    { kind: "caption", text: "第 2 步 · 量浓盐酸配约 0.1 mol/L 溶液 500 mL。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-add-water" },
    { kind: "click", target: "demo-op-step2-measure-acid" },
    // 真拖拽：浓盐酸瓶拖进烧杯，drop 后 700ms 倒入动画播完才 dispatch
    {
      kind: "drag",
      target: "demo-scene-reagent-hcl",
      to: "demo-scene-drop-flask",
      text: "真拖拽：浓盐酸瓶拖进烧杯，落点吸附高亮后松手——先播 700ms 倒入动画，再记「酸入水」这一步。",
      ms: 1400,
    },
    { kind: "click", target: "demo-op-step2-transfer" },
    { kind: "caption", text: "第 3 步 · 滴定管检漏、洗涤与润洗。", ms: 1500 },
    { kind: "click", target: "demo-op-step3-inspect" },
    { kind: "click", target: "demo-op-step3-wash" },
    { kind: "click", target: "demo-op-step3-rinse" },
    { kind: "caption", text: "第 4 步 · 装液、排气泡、调零。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：把 NaOH 溶液装入酸式（玻璃活塞）滴定管，活塞发涩后强行扭转。", ms: 2000 },
    { kind: "click", target: "demo-op-step4-naoh-in-acid-burette" },
    { kind: "waitFor", target: "demo-feedback-fail-4", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-4", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step4-clamp", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step4-clamp" },
    { kind: "click", target: "demo-op-step4-fill" },
    { kind: "click", target: "demo-op-step4-zero" },
    { kind: "caption", text: "第 5 步 · 移取 HCl 并加指示剂。", ms: 1500 },
    { kind: "click", target: "demo-op-step5-rinse-pipette" },
    { kind: "click", target: "demo-op-step5-pipette" },
    // 真拖拽：酚酞瓶拖进锥形瓶（params.indicator 命中，drop 即判「加指示剂」）
    {
      kind: "drag",
      target: "demo-scene-reagent-phenolphthalein",
      to: "demo-scene-drop-flask",
      text: "真拖拽：酚酞瓶拖进锥形瓶，drop 当帧命中「加 2 滴酚酞」，倒入动画播完才推进。",
      ms: 1400,
    },
    { kind: "caption", text: "第 6 步 · 滴定至终点。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-titrate-fast" },
    { kind: "click", target: "demo-op-step6-half-drop" },
    { kind: "click", target: "demo-op-step6-read-end" },
    { kind: "caption", text: "第 7 步 · 平行测定与浓度比计算。", ms: 1500 },
    { kind: "click", target: "demo-op-step7-repeat" },
    { kind: "click", target: "demo-op-step7-record" },
    { kind: "click", target: "demo-op-step7-compute" },
    { kind: "caption", text: "7 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
