import type { Metadata } from "next";
import "./globals.css";
import "./styles/portal.css";
import "./styles/cover.css";
import "./styles/cover-light.css";
import "./styles/app.css";
import "./styles/motion.css";
import "./styles/svg-motion.css";
import "./styles/demo.css";
import { DevDockLoader } from "@/components/devtools/dev-dock-loader";
import { devtoolsEnabled } from "@/components/devtools/devtools-enabled";

export const metadata: Metadata = {
  title: {
    default: "无机及分析化学实验 · 河南大学",
    template: "%s · 无机及分析化学实验",
  },
  description:
    "河南大学《无机及分析化学实验》（03600004）虚拟仿真平台：10 个实验全流程操作、真实事故后果、过程性评价与教师端学情。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 霞鹜文楷：97 个 subset 分片，只能用 link 引入，不进 Tailwind 处理 */}
        <link rel="stylesheet" href="/fonts/lxgw-wenkai/lxgwwenkai-regular.css" />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        {devtoolsEnabled() ? <DevDockLoader /> : null}
      </body>
    </html>
  );
}
