/**
 * 台面工具（水龙头 / 毛刷 / 洗瓶 / 玻璃棒 / 滴管）。
 *
 * 存在理由：原来所有动作都靠「点右上角那张卡」完成，等于答题而不是做实验。
 * 演示要有操作感，学生得先拿到工具、再对准器皿使用 —— 这里定义工具本身，
 * 具体「某工具对某器皿做了什么」由 app/exp/[id]/workbench.tsx 的映射决定。
 *
 * 坐标系与 SCENE_VESSELS 一致（同一个 SVG viewBox）。
 */

export type SceneToolId =
  | "faucet"
  | "brush"
  | "wash-bottle"
  | "rod"
  | "dropper"
  /** 以下 5 件是从 definition 的动作/陷阱文案倒推出来的（2026-10-22）：
   *  「用纸巾/抹布擦拭容量瓶内壁」要抹布、「洗洁精刷洗」要洗洁精、
   *  「量 2.7 mL 浓硫酸」要量筒、「25.00 mL 移液管」要移液管、「洗耳球吸液」要洗耳球。
   *  器具不齐 = 那一步没法做。 */
  | "cloth"
  | "detergent"
  | "cylinder"
  | "pipette"
  | "bulb";

export interface SceneTool {
  id: SceneToolId;
  label: string;
  /** 托盘里的中心点 */
  x: number;
  y: number;
  /** 需要对准器皿才有意义（滴管、毛刷、洗瓶）；水龙头是「把器皿拿到龙头下」 */
  needsVessel: boolean;
}

/** 工具挂在台面后沿，y 在器皿顶（100）以上，不挡读数。 */
export const SCENE_TOOLS: readonly SceneTool[] = [
  // 名字必须跟 definition 的动作文案一致：第 2 步写的是「用软毛刷/绸布取放称量瓶」
  { id: "brush", label: "软毛刷", x: 986, y: 400, needsVessel: true },
  { id: "wash-bottle", label: "洗瓶", x: 1086, y: 400, needsVessel: true },
  { id: "rod", label: "玻璃棒", x: 1036, y: 492, needsVessel: true },
  { id: "dropper", label: "滴管", x: 936, y: 492, needsVessel: true },
  { id: "cloth", label: "抹布", x: 986, y: 400, needsVessel: true },
  { id: "detergent", label: "洗洁精", x: 1036, y: 400, needsVessel: true },
  { id: "cylinder", label: "量筒", x: 1086, y: 400, needsVessel: true },
  { id: "pipette", label: "移液管", x: 1036, y: 492, needsVessel: true },
  { id: "bulb", label: "洗耳球", x: 1086, y: 492, needsVessel: true },
];

export function getSceneTool(id: string): SceneTool | undefined {
  return SCENE_TOOLS.find((tool) => tool.id === id);
}

/** 实验里实际会出现哪些工具（按实验裁剪，避免用不上的工具占版面）。 */
export const TOOLS_BY_EXPERIMENT: Readonly<Record<string, readonly SceneToolId[]>> = {
  // 水龙头不单独做工具：洗涤槽自带龙头，洗器皿 = 把器皿拖进槽里
  // 只摆这个实验真的会用到的：洗洁精合并进「拖进洗槽」那一步，不单独做工具。
  exp01: ["brush", "cloth", "wash-bottle", "rod", "cylinder", "pipette", "bulb"],
  exp03: ["wash-bottle", "rod", "dropper", "faucet"],
  exp09: ["dropper", "wash-bottle", "rod"],
};
