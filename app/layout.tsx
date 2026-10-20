import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "无机及分析化学实验 · 虚拟实验平台",
  description: "化学实验虚拟仿真教学平台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
