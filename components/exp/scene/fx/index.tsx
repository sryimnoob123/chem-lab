"use client";

import type { ComponentType } from "react";
import type { FxKey } from "@/lib/scene/fx";
import { FxBoilOver } from "./fx-boil-over";
import { FxBurn } from "./fx-burn";
import { FxDeviceAccident } from "./fx-device-accident";
import { FxExplosion } from "./fx-explosion";
import { FxFire } from "./fx-fire";
import { FxGlassBreak } from "./fx-glass-break";
import { FxHeavyMetal } from "./fx-heavy-metal";
import { FxToxicGas } from "./fx-toxic-gas";
import type { FxProps } from "./types";

export type { FxProps };

export const FX_COMPONENTS = {
  explosion: FxExplosion,
  toxicGas: FxToxicGas,
  fire: FxFire,
  boilOver: FxBoilOver,
  burn: FxBurn,
  glassBreak: FxGlassBreak,
  heavyMetal: FxHeavyMetal,
  deviceAccident: FxDeviceAccident,
} satisfies Record<FxKey, ComponentType<FxProps>>;

/** 按 key 渲染对应事故特效。 */
export function FxByKey({ fx, ...props }: { fx: FxKey } & FxProps) {
  const Component = FX_COMPONENTS[fx];
  return <Component {...props} />;
}
