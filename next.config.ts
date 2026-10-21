import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 扣子部署时静态资源前缀随环境变化，统一由 COZE_WORKSPACE_PATH 提供
  output: "standalone",
  // PGlite 依赖 WASM 与本地文件系统，不能被打进 server bundle
  serverExternalPackages: ["@electric-sql/pglite"],
  // 本机只有 15.8G 物理内存：page data 阶段默认按 CPU 核数开 worker（实测 19 个）
  // 会直接 OOM 崩 build（FATAL ERROR: AlignedAlloc Allocation failed）。
  // 压到 4 个 worker，峰值内存降一个量级；构建慢一点但不会炸。
  experimental: {
    cpus: 4,
  },
};

export default nextConfig;
