"use client";

/**
 * 是否已在浏览器端水合完成。
 *
 * 用途：RejectHint / ErrorToast 需要 portal 到 document.body，但 SSR 阶段没有
 * document。用 useSyncExternalStore 的 server snapshot 返回 false，避免在 effect
 * 里同步 setState（react-hooks/set-state-in-effect 禁止，也会多一次级联渲染）。
 */

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
