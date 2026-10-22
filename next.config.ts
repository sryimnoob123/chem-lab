import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 扣子部署时静态资源前缀随环境变化，统一由 COZE_WORKSPACE_PATH 提供
  output: "standalone",
  // PGlite 依赖 WASM 与本地文件系统，不能被打进 server bundle；
  // postgres.js 自带原生 TCP 连接池，同样按外部包处理
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // 本机只有 15.8G 物理内存：page data 阶段默认按 CPU 核数开 worker（实测 19 个）
  // 会直接 OOM 崩 build（FATAL ERROR: AlignedAlloc Allocation failed）。
  // 压到 4 个 worker，峰值内存降一个量级；构建慢一点但不会炸。
  experimental: {
    cpus: 4,
  },
  /**
   * dev 模式下 Next 16 默认拦截「跨站」访问 `/_next/*` 开发资源。
   * 用 127.0.0.1 打开 :3000 时，页面能渲染但客户端脚本全部不执行
   * （表现成整页点了没反应、数据已渲染但所有交互失效）。
   * 本地验收脚本、截屏管线都用 127.0.0.1，所以显式放行。
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
