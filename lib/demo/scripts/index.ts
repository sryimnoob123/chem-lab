import { exp01Script } from "./exp01";
import { exp02Script } from "./exp02";
import { exp03Script } from "./exp03";
import { exp04Script } from "./exp04";
import { exp05Script } from "./exp05";
import { exp06Script } from "./exp06";
import { exp07Script } from "./exp07";
import { exp08Script } from "./exp08";
import { exp09Script } from "./exp09";
import { exp10Script } from "./exp10";
import { catalogScript } from "./catalog";
import { fxScript, loginScript, teacherScript } from "./classroom";
import { homeScript } from "./home";
import { reportScript } from "./report";
import type { DemoScript } from "../types";

/**
 * 演示顺序 = 交差时播放的顺序（**唯一来源**：`DEMO_ORDER` 由本数组派生）。
 * 前 7 场是门户到教师端的标准流程；后 10 场是逐实验的完整操作演示（正确路径 → 负反馈 → 重做 → 出结果）。
 */
export const DEMO_SCRIPTS: DemoScript[] = [
  homeScript,
  loginScript,
  catalogScript,
  exp09Script,
  reportScript,
  fxScript,
  teacherScript,
  exp01Script,
  exp02Script,
  exp03Script,
  exp04Script,
  exp05Script,
  exp06Script,
  exp07Script,
  exp08Script,
  exp10Script,
];

/** 浮层/自动播放用的脚本 id 顺序；与 DEMO_SCRIPTS 保持一一对应 */
export const DEMO_ORDER: readonly string[] = DEMO_SCRIPTS.map((script) => script.id);

export function getScript(id: string): DemoScript | undefined {
  return DEMO_SCRIPTS.find((s) => s.id === id);
}

/** 自动播放：播完一场接下一场，循环 */
export function nextScript(id: string): DemoScript {
  const i = DEMO_SCRIPTS.findIndex((s) => s.id === id);
  return DEMO_SCRIPTS[(i + 1) % DEMO_SCRIPTS.length];
}
