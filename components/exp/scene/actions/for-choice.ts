/**
 * 动作映射（实验定义 → 场景动作）
 *
 * 可复用底层的一部分：实验定义只写"这一步是 wash / dissolve / transfer…"，
 * 由这里决定该播哪条场景动画、作用在哪台器皿上。
 * 新增实验只要写定义，不需要再写动画。
 */

import type { SceneToolId } from "@/lib/scene/tools";
import type { SceneAction } from "./action-layer";

export type ChoiceLike = {
  type: string;
  params?: Readonly<Record<string, unknown>>;
};

export type ActionContext = {
  /** 这一步要动的那台器皿（优先用用户刚点/刚拖的那台） */
  vesselId?: string | null;
  /** 手上拿的工具（玻璃棒 / 洗瓶 / 毛刷…） */
  tool?: SceneToolId | null;
  /** 转移类动作的源器皿 */
  from?: string | null;
};

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * 一个 choice → 一条场景动作。
 * 返回 null 表示"这一步没有可见动作"（如纯计算），调用方直接推进，不硬编动画。
 */
export function actionForChoice(choice: ChoiceLike, ctx: ActionContext): SceneAction | null {
  const vessel = ctx.vesselId ?? null;
  switch (choice.type) {
    case "wash":
      return vessel ? { kind: "rinse", vesselId: vessel, tool: ctx.tool ?? null } : null;
    case "dissolve":
      return vessel ? { kind: "stir", vesselId: vessel } : null;
    case "transfer":
      return vessel && ctx.from && ctx.from !== vessel
        ? { kind: "transfer", from: ctx.from, to: vessel }
        : null;
    case "dilute":
      return vessel ? { kind: "dilute", vesselId: vessel } : null;
    case "weigh":
      return { kind: "weigh", mass: num(choice.params?.mass) };
    case "readInstrument":
      return { kind: "read", value: num(choice.params?.initialReading) ?? num(choice.params?.mass) ?? 0 };
    case "observe":
      return vessel ? { kind: "observe", vesselId: vessel } : null;
    case "heat":
    case "evaporate":
      return vessel ? { kind: "heat", vesselId: vessel } : null;
    case "addDrops":
    case "titrate":
      return vessel ? { kind: "drops", vesselId: vessel } : null;
    default:
      return null;
  }
}
