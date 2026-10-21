import { exp09Script } from "./exp09";
import { catalogScript } from "./catalog";
import { fxScript, loginScript, teacherScript } from "./classroom";
import { homeScript } from "./home";
import { reportScript } from "./report";
import type { DemoScript } from "../types";

/**
 * 演示顺序 = 交差时播放的顺序。
 * 开头是卖点，中间走一遍完整流程，结尾是教育价值。
 */
export const DEMO_SCRIPTS: DemoScript[] = [
  homeScript,
  loginScript,
  catalogScript,
  exp09Script,
  reportScript,
  fxScript,
  teacherScript,
];

export function getScript(id: string): DemoScript | undefined {
  return DEMO_SCRIPTS.find((s) => s.id === id);
}

/** 自动播放：播完一场接下一场，循环 */
export function nextScript(id: string): DemoScript {
  const i = DEMO_SCRIPTS.findIndex((s) => s.id === id);
  return DEMO_SCRIPTS[(i + 1) % DEMO_SCRIPTS.length];
}
