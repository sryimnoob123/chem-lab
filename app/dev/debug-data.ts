/**
 * app/dev/debug-data.ts —— 调试面板的服务端数据构建（不渲染 UI）
 *
 * 从 lib/engine 的实验定义里抽两类东西：
 * - 陷阱动作 → 可注入的 hazard（含 registry 里的等级/标题）；
 * - 自动推进到某一步之前的动作序列（用于"一键复现事故"）。
 *
 * 纯读，不写库；只在 /dev 页（服务端）调用。
 */

import type { Action, ChoiceDefinition, ExperimentDefinition, StepDefinition } from "@/lib/engine";
import { getIncident } from "@/lib/safety/registry";
import type { DevHazard } from "@/components/devtools/types";

function toAction(choice: ChoiceDefinition): Action {
  return {
    type: choice.type,
    choiceId: choice.choiceId,
    competency: choice.competency,
    ...(choice.params ? { params: { ...choice.params } } : {}),
  };
}

/**
 * 把某一步里所有正确动作按「requires 满足才执行」的顺序排出来，直到本步完成。
 * 定义文件是数据，缺 `requires` 时退化为定义顺序；最多迭代 50 次防坏数据死循环。
 */
function correctActionsOfStep(step: StepDefinition): Action[] {
  const actions: Action[] = [];
  const performed = new Set<string>();
  const candidates = step.choices.filter((choice) => choice.role === "correct");

  for (let guard = 0; guard < 50; guard += 1) {
    const next = candidates.find(
      (choice) =>
        !performed.has(choice.choiceId) &&
        (choice.requires ?? []).every((id) => performed.has(id)),
    );
    if (!next) break;
    actions.push(toAction(next));
    performed.add(next.choiceId);
    if (next.completesStep) return actions;
  }
  return actions;
}

/** 从第 0 步推进到 targetStep（不含）所需的全部动作。 */
function preludeFor(definition: ExperimentDefinition, targetStep: number): Action[] {
  const actions: Action[] = [];
  for (let index = 0; index < targetStep; index += 1) {
    const step = definition.steps[index];
    if (!step) break;
    actions.push(...correctActionsOfStep(step));
  }
  return actions;
}

/** 抽出一个实验所有可注入事故（按 incidentId 去重）。 */
export function buildHazards(definition: ExperimentDefinition | undefined): DevHazard[] {
  if (!definition) return [];

  const seen = new Set<string>();
  const hazards: DevHazard[] = [];

  for (const step of definition.steps) {
    for (const choice of step.choices) {
      const incidentId = choice.hazard?.incidentId;
      if (choice.role !== "trap" || !incidentId || seen.has(incidentId)) continue;
      seen.add(incidentId);
      const registered = getIncident(incidentId);
      hazards.push({
        incidentId,
        level: registered?.level ?? choice.hazard?.level ?? "L1",
        title: registered?.title ?? choice.label,
        stepIndex: step.index,
        trigger: toAction(choice),
        prelude: preludeFor(definition, step.index),
      });
    }
  }
  return hazards;
}
