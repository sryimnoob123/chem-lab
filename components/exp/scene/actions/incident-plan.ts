/**
 * 事故演出的「参数推导」（唯一入口的纯函数层）
 *
 * 一条事故怎么演，只由三件事决定：
 *   1. 事故类型 `fx`（器身裂 / 爆炸 / 暴沸 / 起火 / 灼伤 / 毒气）—— 决定炸开那一段；
 *   2. 起手动作 `op`（倒液 / 加热 / 搅拌 / 捅洗）—— 决定出事前那一小段；
 *   3. 落点器皿 `vesselId` —— 事故长在哪台器皿上（和倒液动画同一份几何）。
 *
 * 真操作触发与错误演示触发**都调这一个函数**，所以两边画面天然一致；
 * 差别只在调用方要不要 `commit`（演示不动实验状态）。
 *
 * 不碰 DOM、不读时间、不随机 —— 可直接单测。
 */

import type { ActionType, ChoiceHazard } from "@/lib/engine.types";
import type { IncidentOp } from "./incident";
import type { IncidentFx } from "./incident-art";

/**
 * 能在**器皿上**演的事故。剩下两个键不在器皿上发生：
 * heavy-metal 是废液进了水槽、device-accident 是仪器（天平）坏，
 * 它们仍走原来的覆盖层特效，不硬塞进器皿里演（否则等于骗人）。
 */
const IN_BENCH_FX: Readonly<Record<string, IncidentFx>> = {
  "glass-break": "glassBreak",
  explosion: "explosion",
  "boil-over": "boilOver",
  fire: "fire",
  burn: "burn",
  "toxic-gas": "toxicGas",
};

/** 事故开始前那一小段「错操作」：由动作原语兜底，定义里可用 `hazard.op` 覆盖。 */
const OP_BY_TYPE: Readonly<Partial<Record<ActionType, IncidentOp>>> = {
  heat: "heat",
  evaporate: "heat",
  dissolve: "stir",
  washPrecipitate: "stir",
  wash: "poke",
  transfer: "pour",
  dilute: "pour",
  addDrops: "pour",
  titrate: "pour",
};

/** 起手动作 → 播放期间底部那行字（只说在做什么，不说后果；后果等炸完再出） */
const CAPTION_BY_OP: Readonly<Record<IncidentOp, string>> = {
  pour: "正在往器皿里倒液…",
  heat: "器皿正在加热…",
  stir: "玻璃棒伸进器皿搅洗…",
  poke: "玻璃棒在器皿里捅洗…",
};

export type IncidentPlan = {
  fx: IncidentFx;
  op: IncidentOp;
  vesselId: string;
  /** 从哪台器皿倒过去的（没有就画洗瓶） */
  from: string | null;
  caption: string;
};

export type IncidentChoice = {
  choiceId: string;
  type: ActionType;
  label: string;
  hazard?: ChoiceHazard;
};

export type VesselLike = { id: string; label: string };

/** 器皿名只留汉字（"容量瓶 100 mL" → "容量瓶"），和 vessel-targets 同一口径。 */
function hanOnly(text: string): string {
  return text.replace(/[^\u4e00-\u9fa5]/g, "");
}

/**
 * 从一句文案里认出器皿（最长匹配优先：「容量瓶」不会被「量瓶」抢先）。
 * 认不出来返回 null —— 宁可不演，也不把事故硬塞到一台不相干的器皿上。
 */
export function vesselFromText(text: string, vessels: readonly VesselLike[]): string | null {
  const body = hanOnly(text);
  if (body.length < 2) return null;
  const hit = [...vessels]
    .filter((vessel) => {
      const word = hanOnly(vessel.label);
      return word.length >= 2 && body.includes(word);
    })
    .sort((a, b) => hanOnly(b.label).length - hanOnly(a.label).length)[0];
  return hit?.id ?? null;
}

/**
 * 事故参数推导。返回 null = 这条事故不在器皿上发生（或定义里没配特效），
 * 调用方回退到原有的覆盖层特效。
 */
export function planIncident(input: {
  choice?: IncidentChoice | null;
  vessels: readonly VesselLike[];
  /** 真正被操作的那台器皿（真操作传点击对象；错误演示不传） */
  vesselId?: string | null;
  /** 本步该动的器皿（场景里亮着的那台），文案没点名时用它 */
  cueVesselId?: string | null;
  /** 上一次碰过的器皿：倒液类事故的「从哪来」 */
  fromVesselId?: string | null;
}): IncidentPlan | null {
  const { choice, vessels, vesselId, cueVesselId, fromVesselId } = input;
  const hazard = choice?.hazard;
  if (!choice || !hazard?.fx) return null;

  const fx = IN_BENCH_FX[hazard.fx];
  if (!fx) return null;

  const op = hazard.op ?? OP_BY_TYPE[choice.type] ?? null;
  if (!op) return null;

  /**
   * 落点优先级：真操作点中的器皿 → 陷阱文案点名的器皿 → 本步亮着的器皿。
   * 顺序不能反：错误演示时「倒进盛浓硫酸的烧杯」这句话就是场景本身，
   * 让本步的器皿盖掉它，事故会长在错的瓶子上。
   */
  const target = vesselId ?? vesselFromText(choice.label, vessels) ?? cueVesselId ?? null;
  if (!target) return null;

  const from = fromVesselId && fromVesselId !== target ? fromVesselId : null;

  return { fx, op, vesselId: target, from, caption: CAPTION_BY_OP[op] };
}
