"use client";

/**
 * 跟随系统「减少动态效果」（prefers-reduced-motion）。
 *
 * - SSR / 首帧返回 false（服务端没有 matchMedia），水合后由 useSyncExternalStore 校正；
 * - 模块顶层不访问 window，也不在 effect 里同步 setState；
 * - 组件拿到 true 时跳过动画并直接渲染终值/静态描边，**信息不丢**。
 *
 * 注：components/exp/scene/fx/index.tsx 里有一份同名私有实现（未导出），
 * 本文件是 feedback 目录独立可用的版本，不修改对方。
 */

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function canMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(onStoreChange: () => void): () => void {
  if (!canMatchMedia()) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  if (!canMatchMedia()) return false;
  return window.matchMedia(QUERY).matches;
}

/** 服务端与首帧按「不减少」渲染，保证水合一致 */
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
