import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 扣子部署时静态资源前缀随环境变化，统一由 COZE_WORKSPACE_PATH 提供
  output: "standalone",
  // PGlite 依赖 WASM 与本地文件系统，不能被打进 server bundle
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
