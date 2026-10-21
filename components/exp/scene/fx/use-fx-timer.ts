"use client";

import { useEffect } from "react";

/** 一次性特效计时器：active 时到点回调；循环特效传 ms=0 不注册。 */
export function useFxTimer(active: boolean, ms: number, onDone?: () => void) {
  useEffect(() => {
    if (!active || ms <= 0 || !onDone) return;
    const timer = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(timer);
  }, [active, ms, onDone]);
}
