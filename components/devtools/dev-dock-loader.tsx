"use client";

/**
 * Dev Dock 动态加载器：
 * - `ssr: false`：不在服务端渲染，避免进入首屏 HTML；
 * - 由 `app/layout.tsx` 在 `devtoolsEnabled()` 为真时才挂载，
 *   生产（NODE_ENV=production 且未设 DEVTOOLS）时 loader 与 dock 的 JS/CSS 都不会加载。
 */

import dynamic from "next/dynamic";

const DevDock = dynamic(() => import("./dev-dock").then((mod) => mod.DevDock), {
  ssr: false,
  loading: () => null,
});

export function DevDockLoader() {
  return <DevDock />;
}
