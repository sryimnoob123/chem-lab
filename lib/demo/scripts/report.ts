import type { DemoScript } from "../types";

/** 交卷后的报告：让观众看到"做对了/做错了"最后变成分数 */
export const reportScript: DemoScript = {
  id: "report",
  title: "实验报告 · 过程性评价怎么算",
  page: "/exp/exp09/report",
  steps: [
    { kind: "caption", text: "交卷后自动生成报告：总分由三段组成，不是老师印象分。", ms: 2600 },
    { kind: "highlight", target: "demo-report-total", text: "总分 = 预习 10% + 操作 40% + 报告 50%。", ms: 2400 },
    { kind: "highlight", target: "demo-report-parts", text: "三段各自加权：预习 75、操作 92、报告 85。", ms: 2200 },
    { kind: "highlight", target: "demo-report-competency", text: "能力点 K1~A3 的掌握度，用操作证据算出来的。", ms: 2200 },
    { kind: "highlight", target: "demo-report-incidents", text: "事故清单带等级、所在步骤与扣分。", ms: 2200 },
    { kind: "caption", text: "每一分的背后都能追到具体那一步——这就是可解释的评分。", ms: 2600 },
  ],
};
