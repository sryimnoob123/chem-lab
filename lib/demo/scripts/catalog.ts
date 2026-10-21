import type { DemoScript } from "../types";

/** 实验选择：从登录后到进入实验 09 */
export const catalogScript: DemoScript = {
  id: "catalog",
  title: "实验选择 · 十个实验按能力线排开",
  page: "/experiments",
  steps: [
    { kind: "caption", text: "登录后是实验台账：10 个实验按能力线分组，学时、类型、开放状态一目了然。", ms: 2600 },
    { kind: "highlight", target: "demo-catalog-exp01", text: "基础操作与制备：仪器认领、氯化钠制备、称量练习。", ms: 2200 },
    { kind: "highlight", target: "demo-catalog-exp04", text: "化学平衡与离子鉴定：沉淀平衡、氧化还原、配合物。", ms: 2200 },
    { kind: "caption", text: "只有排到今天的那一个能进，其它的锁着——顺序就是教学进度。", ms: 2400 },
    { kind: "click", target: "demo-catalog-exp09", text: "点进实验 09。", ms: 2200 },
  ],
};
