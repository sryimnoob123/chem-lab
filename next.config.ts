import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 扣子部署时静态资源前缀随环境变化，统一由 COZE_WORKSPACE_PATH 提供
  output: "standalone",
  // PGlite 依赖 WASM 与本地文件系统，不能被打进 server bundle；
  // postgres.js 自带原生 TCP 连接池，同样按外部包处理
  // coze-coding-dev-sdk 体积大且只在扣子运行时用：外部化，避免进 server bundle，
  // 本地/CI 也是靠 lib/ai/sdk-llm.ts 的动态 import + try/catch 才加载
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "coze-coding-dev-sdk"],
  /**
   * standalone 里别带仓库里的「非运行时」目录（2026-10-24 二轮实测）：
   * 构建后 standalone 293 MB，其中 evidence 59 / .pgdata 39 / deliverables 24 / docs 8 /
   * e2e-review 2 —— 全是开发产物，部署时白占 130+ MB 上传与解压时间。
   * 真正要带的是 server.js + .next（15 MB）+ node_modules（58 MB）+ public（87 MB）。
   * 只排除运行时不读的目录；public 由 start-chem-lab / 扣子自己拷，不走 tracing。
   */
  outputFileTracingExcludes: {
    "*": [
      ".pgdata*/**",
      "evidence/**",
      "deliverables/**",
      "docs/**",
      "e2e/**",
      "e2e-review/**",
      "logs/**",
      "preview/**",
      "*.log",
    ],
  },
  // 本机只有 15.8G 物理内存：page data 阶段默认按 CPU 核数开 worker（实测 19 个）
  // 会直接 OOM 崩 build（FATAL ERROR: AlignedAlloc Allocation failed）。
  // 压到 4 个 worker，峰值内存降一个量级；构建慢一点但不会炸。
  experimental: {
    cpus: 4,
  },
  /**
   * dev 模式下 Next 16 默认拦截「跨站」访问 `/_next/*` 开发资源。
   * 一旦被拦，页面 HTML 还能出来，但**客户端脚本全不执行**：靠 useEffect 出内容的组件
   * 会原地变空白（前测页空卡片、空选项就是它），点击也没反应。
   * 本地是 127.0.0.1，扣子预览是 *.coze.site / *.bytefaas.com 这类代理域名，
   * 一律显式放行；真遇到别的域名用 DEV_ALLOWED_ORIGINS 追加（逗号分隔）。
   */
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.coze.site",
    "*.coze.cn",
    "*.bytefaas.com",
    ...(process.env.DEV_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ],
};

export default nextConfig;
