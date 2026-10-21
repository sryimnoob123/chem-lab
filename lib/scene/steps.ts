/**
 * 7 步双分支演示数据（asset-pipeline 独占 `lib/scene/**`）
 *
 * 唯一真相：`experiments/exp09/definition.ts` 的 choices。
 * - role: "correct" → 成功分支（文案取自该 choice 的 label / observation / feedback）
 * - role: "trap"    → 失败分支（hazard.feedback.title/why + hazard.fx + terminate）
 * 这里只做结构映射，不改写任何化学解释。
 */

import { exp09Definition } from "@/experiments/exp09/definition";
import type { FxKey } from "./fx";

/** definition 里 fx 用 kebab-case，场景特效用 camelCase。 */
const FX_MAP: Readonly<Record<string, FxKey>> = {
  explosion: "explosion",
  "toxic-gas": "toxicGas",
  fire: "fire",
  "boil-over": "boilOver",
  burn: "burn",
  "glass-break": "glassBreak",
  "heavy-metal": "heavyMetal",
  "device-accident": "deviceAccident",
};

export type DemoChoice = {
  id: string;
  label: string;
  ok: boolean;
  /** 成功：这道操作本身；失败：definition 的 hazard.feedback.title（错在哪）。 */
  title: string;
  /** 成功：definition 的 observation.text；失败：hazard.feedback.why（为什么）。 */
  detail: string;
  fx: FxKey | null;
  level: string | null;
  terminate: boolean;
  /** definition 里 observation.value（没有就是 null），只用于读数条展示。 */
  value: string | null;
};

export type DemoStep = {
  /** 1-based，对应 data-demo-id 的 stepIndex。 */
  index: number;
  title: string;
  prompt: string;
  demoId: string;
  shape: "beaker" | "burette" | "flask";
  /** 成功时液面高度（0~1），仅用于图示。 */
  fill: number;
  liquid: string;
  powder: boolean;
  choices: readonly DemoChoice[];
};

/** 每步的示意器皿（纯视觉配置，不含化学判断）。 */
const VISUAL: Readonly<Record<number, Pick<DemoStep, "shape" | "fill" | "liquid" | "powder">>> = {
  1: { shape: "beaker", fill: 0.38, liquid: "#DCE9F2", powder: true },
  2: { shape: "beaker", fill: 0.72, liquid: "#EAF2F8", powder: false },
  3: { shape: "burette", fill: 0.5, liquid: "#DCE9F2", powder: false },
  4: { shape: "burette", fill: 0.82, liquid: "#DCE9F2", powder: false },
  5: { shape: "flask", fill: 0.42, liquid: "#EAF2F8", powder: false },
  6: { shape: "flask", fill: 0.46, liquid: "#F8BBD0", powder: false },
  7: { shape: "flask", fill: 0.46, liquid: "#F8BBD0", powder: false },
};

export const DEMO_STEPS: readonly DemoStep[] = exp09Definition.steps.map((step, i) => {
  const index = i + 1;
  const visual = VISUAL[index] ?? { shape: "beaker" as const, fill: 0.4, liquid: "#DCE9F2", powder: false };
  const choices: DemoChoice[] = step.choices
    .map((c) => {
      if (c.role === "correct") {
        return {
          id: c.choiceId,
          label: c.label,
          ok: true,
          title: c.label,
          detail: c.observation?.text ?? c.feedback?.title ?? "",
          fx: null,
          level: null,
          terminate: false,
          value: c.observation?.value !== undefined ? String(c.observation.value) : null,
        };
      }
      const h = c.hazard;
      return {
        id: c.choiceId,
        label: c.label,
        ok: false,
        title: h?.feedback.title ?? c.label,
        detail: h?.feedback.why ?? "",
        fx: h?.fx ? FX_MAP[h.fx as string] ?? null : null,
        level: h?.level ?? null,
        terminate: h?.terminate ?? false,
        value: null,
      };
    })
    .sort((a, b) => Number(b.ok) - Number(a.ok));

  return {
    index,
    title: step.title,
    prompt: `${step.title}：从下面选出你的操作`,
    demoId: step.demoId,
    ...visual,
    choices,
  };
});

export function getDemoStep(index: number): DemoStep | undefined {
  return DEMO_STEPS.find((s) => s.index === index);
}
