import type { DemoScript } from "../types";

/** 首页演示脚本：从课程全貌走到实验台账，再进入实验 09 */
export const homeScript: DemoScript = {
  id: "home",
  title: "课程首页 · 10 个实验一本台账",
  page: "/",
  steps: [
    { kind: "caption", text: "河南大学《无机及分析化学实验》，10 个实验、36 学时、一本台账。", ms: 2400 },
    { kind: "highlight", target: "demo-home-hero-title", text: "课程主张：把每一次读数，写进同一本台账。", ms: 1800 },
    { kind: "highlight", target: "demo-home-readout", text: "所有读数按仪器分度来：滴定管 0.1 mL 分度，估读到 0.01 mL。", ms: 1800 },
    { kind: "scroll", target: "demo-home-ledger", text: "十次实验的学时、类型与开放状态都在台账里。", ms: 900 },
    { kind: "highlight", target: "demo-home-rail", text: "左边这把刻度尺就是实验索引，和台账一一对应。", ms: 1400 },
    { kind: "click", target: "demo-home-ledger-exp09", text: "现在进入实验 09。", ms: 1200 },
  ],
};
