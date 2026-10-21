/**
 * 10 个实验的 BOPPPS 教学数据汇总。
 * 各实验数据逐字取自 docs/实验库/expNN.md，见同目录 expNN.ts。
 */

import type { Curriculum } from "./types";
import { exp01Curriculum } from "./exp01";
import { exp02Curriculum } from "./exp02";
import { exp03Curriculum } from "./exp03";
import { exp04Curriculum } from "./exp04";
import { exp05Curriculum } from "./exp05";
import { exp06Curriculum } from "./exp06";
import { exp07Curriculum } from "./exp07";
import { exp08Curriculum } from "./exp08";
import { exp09Curriculum } from "./exp09";
import { exp10Curriculum } from "./exp10";

export const CURRICULA: Record<string, Curriculum> = {
  exp01: exp01Curriculum,
  exp02: exp02Curriculum,
  exp03: exp03Curriculum,
  exp04: exp04Curriculum,
  exp05: exp05Curriculum,
  exp06: exp06Curriculum,
  exp07: exp07Curriculum,
  exp08: exp08Curriculum,
  exp09: exp09Curriculum,
  exp10: exp10Curriculum,
};

/** 按实验 id（如 "exp01"）取课程数据；未知 id 返回 undefined。 */
export function getCurriculum(id: string): Curriculum | undefined {
  return CURRICULA[id];
}
