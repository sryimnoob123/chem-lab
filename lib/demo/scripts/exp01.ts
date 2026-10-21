import type { DemoScript } from "../types";

/**
 * exp01 演示：正确路径 → 第 3 步一次负反馈（L3 → 重做）→ 走完 → 交卷看报告。
 * 只点既有 data-demo-id 钩子，动作/文案全部来自 experiments/exp01/definition.ts。
 */
export const exp01Script: DemoScript = {
  id: "exp01",
  title: "实验 01 · 仪器的认领、天平使用及溶液配制",
  page: "/exp/exp01",
  steps: [
    { kind: "caption", text: "实验 01：仪器的认领、天平使用及溶液配制。下面用脚本把每一步走一遍，光标是模拟的。", ms: 2400 },
    { kind: "caption", text: "第 1 步 · 仪器认领、洗涤与干燥。", ms: 1500 },
    { kind: "click", target: "demo-op-step1-check" },
    { kind: "click", target: "demo-op-step1-wash" },
    { kind: "click", target: "demo-op-step1-dry" },
    { kind: "caption", text: "第 2 步 · 分析天平调水平与内校。", ms: 1500 },
    { kind: "click", target: "demo-op-step2-level" },
    { kind: "click", target: "demo-op-step2-brush" },
    { kind: "click", target: "demo-op-step2-calibrate" },
    { kind: "caption", text: "第 3 步 · 差减法称 Na₂CO₃。", ms: 1500 },
    // 负反馈分支：事故/拒收 → 结果条三行 → 重做本步
    { kind: "caption", text: "这一步先演示一次错误操作：把刚烘过的热称量瓶直接放上秤盘。", ms: 2000 },
    { kind: "click", target: "demo-op-step3-hot" },
    { kind: "waitFor", target: "demo-feedback-fail-3", timeout: 4000, ms: 900 },
    { kind: "caption", text: "失败分支：结果条先给「错在哪 / 为什么 / 怎么改」，事故带 L1~L4 等级与扣分，特效不遮挡操作台。", ms: 2600 },
    { kind: "click", target: "demo-retry-3", text: "点「重做本步」回到这一步开头：错误只记进过程，可以重新选。", ms: 900 },
    { kind: "waitFor", target: "demo-op-step3-gross", timeout: 3000, ms: 400 },
    { kind: "click", target: "demo-op-step3-gross" },
    { kind: "click", target: "demo-op-step3-transfer" },
    { kind: "click", target: "demo-op-step3-compute" },
    { kind: "caption", text: "第 4 步 · 溶解、冷却与定量转移。", ms: 1500 },
    // 真拖拽：把蒸馏水从试剂架拖进烧杯/容量瓶，松手后先播吸附 + 倒入动画，再推进本步
    {
      kind: "drag",
      target: "demo-scene-reagent-water",
      to: "demo-scene-drop-flask",
      text: "真拖拽：抓住蒸馏水瓶沿贝塞尔轨迹送进器皿，松手先播倒入动画（700ms），动画播完才记这一步。",
      ms: 1400,
    },
    { kind: "click", target: "demo-op-step4-cool" },
    { kind: "click", target: "demo-op-step4-rinse" },
    { kind: "caption", text: "第 5 步 · 容量瓶定容与摇匀。", ms: 1500 },
    { kind: "click", target: "demo-op-step5-water" },
    { kind: "click", target: "demo-op-step5-read" },
    { kind: "click", target: "demo-op-step5-shake" },
    { kind: "caption", text: "第 6 步 · 移液管润洗、移取与放出。", ms: 1500 },
    { kind: "click", target: "demo-op-step6-rinse" },
    { kind: "click", target: "demo-op-step6-suck" },
    { kind: "click", target: "demo-op-step6-drain" },
    { kind: "caption", text: "第 7 步 · 浓硫酸稀释。", ms: 1500 },
    { kind: "click", target: "demo-op-step7-water" },
    { kind: "click", target: "demo-op-step7-acid" },
    { kind: "click", target: "demo-op-step7-label" },
    { kind: "caption", text: "7 步全部完成，每一步都进了操作时间线。", ms: 1800 },
    { kind: "click", target: "demo-finish", ms: 900 },
    { kind: "wait", text: "交卷后自动生成报告：总分 = 预习 10% + 操作 40% + 报告 50%，每一分都能追到具体某一步。", ms: 3600 },
  ],
};
