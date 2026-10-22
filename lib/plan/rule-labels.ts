/**
 * 规则短名 —— rules.ts 的 `label` 是给老师看的完整判据（一行 30~40 字），
 * 拿它当「哪里对」的清单会变成一堵字墙；学生只需要认出是哪一条。
 *
 * 所以这里另给 2~7 字的短名，只做展示、不参与判定。
 * 新增规则忘了登记短名时会回落到 label 的首个分句，不会渲染成空。
 */

import { RULES_BY_CODE } from "./rules";

export const RULE_SHORT: Readonly<Record<string, string>> = Object.freeze({
  "std-primary-standard": "基准物质标定",
  "total-alkalinity-dual-indicator": "双指示剂顺序",
  "endpoint-color-criterion": "终点颜色判据",
  "burette-rinse": "滴定管润洗 3 次",
  "burette-degas-zero": "排气泡与调零",
  "primary-standard-dried": "基准物干燥制度",
  "analytical-balance": "分析天平 0.1 mg",
  "parallel-min-and-range": "平行份数与极差",
  "conc-acid-into-water": "酸入水 + 通风橱",
  "naoh-co2-free-water": "CO₂ -free 的水",
  "no-mouth-pipetting": "洗耳球禁口吸",
  "flask-receiving": "锥形瓶承接",
  "half-drop-touch-wall": "半滴靠内壁",
  "near-endpoint-dropwise": "近终点逐滴加",
  "indicator-1-2-drops": "指示剂 1~2 滴",
  "parallel-same-batch": "同批同管同人",
  "reading-two-decimals": "读数估到 0.01 mL",
  "endpoint-hold-30s": "终点保持 30 s",
  "standardization-boil-co2": "煮沸驱 CO₂",
  "blank-test": "空白试验校正",
  "acid-base-burette-match": "酸/碱滴定管匹配",
});

const SEPARATOR = /[，；：,;:]/;

/** 短名；未登记时退回 label 的首个分句（最多 12 字） */
export function shortLabel(code: string): string {
  const short = RULE_SHORT[code];
  if (short) return short;
  const label = RULES_BY_CODE[code]?.label ?? code;
  return (label.split(SEPARATOR)[0] ?? code).slice(0, 12);
}
