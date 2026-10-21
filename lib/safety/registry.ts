/**
 * 事故注册表 —— 按 expId 汇总，供引擎（apply/applyIncident）与 UI（事故卡/定格）取用
 *
 * 引擎用法（契约 §4 + `lib/engine.ts` 的 applyIncident）：
 *   const hit = detectFirstIncident(state.expId, state, action);
 *   if (hit) {
 *     const input = { kind: "incident", incidentId: hit.id, level: hit.level, fx: hit.fx,
 *                     deduct: hit.deduct, terminate: hit.terminate, competency: hit.competency };
 *     const r = applyIncident(state, input); // 幂等键 (stepIndex, incidentId)，重复提交返回 invalid
 *   }
 *
 * 本文件不产生副作用、不做 IO、不含随机：纯查表 + 纯判定。
 */

import { EXP09_INCIDENTS } from "./incidents/exp09";
import {
  FX_KEYS,
  INCIDENT_LEVELS,
  LEVEL_RULES,
  isDeductInRange,
  type Action,
  type ExperimentState,
  type HazardIncident,
  type IncidentLevel,
} from "./incidents/types";
import { missingHazardIds } from "./hazards";

export const INCIDENTS_BY_EXP: Readonly<Record<string, readonly HazardIncident[]>> = Object.freeze({
  exp09: EXP09_INCIDENTS,
});

/** 已挂事故的实验 id（按字典序，稳定输出，UI 可直接渲染） */
export const EXP_IDS_WITH_INCIDENTS: readonly string[] = Object.keys(INCIDENTS_BY_EXP).sort();

const LEVEL_RANK: Readonly<Record<IncidentLevel, number>> = { L1: 1, L2: 2, L3: 3, L4: 4 };

/** 运行期校验用（类型层已由 FxKey 保证，这里防外部 JSON 数据带进来非法值） */
const FX_KEY_SET: readonly string[] = FX_KEYS;

/** 某实验的全部事故；未知实验返回空数组（引擎不必写 if） */
export function getIncidents(expId: string): readonly HazardIncident[] {
  return INCIDENTS_BY_EXP[expId] ?? [];
}

/** 按事故 id 全局反查（复盘页/教师端按 incidentId 取文案） */
export function getIncident(incidentId: string): HazardIncident | undefined {
  for (const expId of EXP_IDS_WITH_INCIDENTS) {
    const hit = INCIDENTS_BY_EXP[expId].find((i) => i.id === incidentId);
    if (hit) return hit;
  }
  return undefined;
}

/** 全库事故条数 */
export function incidentCount(): number {
  return EXP_IDS_WITH_INCIDENTS.reduce((n, id) => n + INCIDENTS_BY_EXP[id].length, 0);
}

/**
 * 判定本次动作命中的**全部**事故（同一动作可能同时踩两条，例如「手持滴定管且气泡未排」）。
 * 返回顺序 = 声明顺序，稳定可测。
 */
export function detectIncidents(
  expId: string,
  state: ExperimentState,
  action: Action,
): HazardIncident[] {
  return getIncidents(expId).filter((incident) => {
    try {
      return incident.trigger(state, action) === true;
    } catch {
      // 单条 trigger 抛错不许拖垮引擎：按未命中处理（不吞掉其它事故）
      return false;
    }
  });
}

/**
 * 只取一条：级别高者优先，同级取声明在前者。
 * 引擎一次只播一个动画，所以必须有确定的「谁优先」——不用随机、不用时间。
 */
export function detectFirstIncident(
  expId: string,
  state: ExperimentState,
  action: Action,
): HazardIncident | undefined {
  const hits = detectIncidents(expId, state, action);
  if (hits.length === 0) return undefined;
  return hits.reduce((best, cur) =>
    LEVEL_RANK[cur.level] > LEVEL_RANK[best.level] ? cur : best,
  );
}

/**
 * 自检：返回问题清单（空数组 = 合规）。单测与开发期页面共用。
 * 覆盖：id 唯一/格式、级别与扣分区间、L4 必 terminate、refs 存在、fx 合法、
 * fxSilent 只能用于 L1/L2、文案字段完整、stepNo 合法。
 */
export function validateRegistry(): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const expId of EXP_IDS_WITH_INCIDENTS) {
    for (const incident of INCIDENTS_BY_EXP[expId]) {
      const where = `${expId}/${incident.id}`;

      if (seen.has(incident.id)) issues.push(`${where}: 事故 id 重复`);
      seen.add(incident.id);

      if (!incident.id.startsWith(`${expId}-H`)) issues.push(`${where}: id 应为 <expId>-H<n>`);
      if (!INCIDENT_LEVELS.includes(incident.level)) issues.push(`${where}: 级别非法`);
      if (!FX_KEY_SET.includes(incident.fx)) issues.push(`${where}: fx 不在契约的 8 个键里`);
      if (!isDeductInRange(incident.level, incident.deduct)) {
        const r = LEVEL_RULES[incident.level];
        issues.push(`${where}: 扣分 ${incident.deduct} 越界（${incident.level} 应为 ${r.min}~${r.max}）`);
      }
      if (incident.level === "L4" && !incident.terminate) issues.push(`${where}: L4 必须 terminate=true`);
      if (incident.level !== "L4" && incident.terminate) issues.push(`${where}: 只有 L4 可 terminate`);

      if (incident.refs.length === 0) issues.push(`${where}: refs 为空`);
      const missing = missingHazardIds(incident.refs);
      if (missing.length > 0) issues.push(`${where}: refs 不在 hazards 库 → ${missing.join(",")}`);

      if (!incident.title.trim()) issues.push(`${where}: title 为空`);
      if (!incident.why.trim()) issues.push(`${where}: why 为空`);
      if (!incident.consequence.trim()) issues.push(`${where}: consequence 为空`);
      if (!incident.correct.trim()) issues.push(`${where}: correct 为空`);

      if (incident.fxSilent && (incident.level === "L3" || incident.level === "L4")) {
        issues.push(`${where}: L3/L4 必须有动画，不能 fxSilent`);
      }
      if (incident.stepNo !== undefined && (!Number.isInteger(incident.stepNo) || incident.stepNo < 1)) {
        issues.push(`${where}: stepNo 必须是 1-based 正整数`);
      }
    }
  }
  return issues;
}
