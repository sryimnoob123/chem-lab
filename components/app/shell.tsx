"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoLaunch } from "@/components/demo/demo-overlay";
import type { ReactNode } from "react";

export type NavExperiment = { id: string; no: string; title: string; playable: boolean; group: string };

const MAIN_NAV = [
  { href: "/", label: "课程首页" },
  { href: "/experiments", label: "我的实验" },
  { href: "/lab/design", label: "方案设计" },
  { href: "/demo", label: "演示模式" },
  { href: "/teacher", label: "教师端" },
];

/** APP 外壳：常驻顶栏 + 左侧导航 + 内容列（+ 可选右信息栏）。 */
export function AppShell({
  children,
  aside,
  crumb,
  experiments = [],
}: {
  children: ReactNode;
  aside?: ReactNode;
  crumb?: string;
  experiments?: NavExperiment[];
}) {
  const pathname = usePathname();

  const groups = Array.from(new Set(experiments.map((e) => e.group)));

  return (
    <div className="app">
      <header className="app-bar">
        <Link className="app-bar__brand" href="/">
          <span className="brand__mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/henan-university-emblem.png" alt="河南大学校徽" width={28} height={28} />
          </span>
          <span className="app-bar__name">无机及分析化学实验</span>
          <span className="app-bar__code mono">03600004</span>
        </Link>
        <nav className="app-bar__nav" aria-label="主导航">
          {MAIN_NAV.map((n) => (
            <Link key={n.href} href={n.href} data-active={pathname === n.href}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="app-bar__me">
          <DemoLaunch />
          <span className="app-bar__chip mono">20250101</span>
          <span className="app-bar__avatar" aria-hidden="true">
            学
          </span>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-side" aria-label="课程导航">
          <p className="app-side__label">实验环节</p>
          <ol className="app-side__list">
            {experiments.map((e) => (
              <li key={e.id}>
                <Link
                  href={e.playable ? `/exp/${e.id}` : "/experiments"}
                  data-active={pathname === `/exp/${e.id}`}
                  data-locked={!e.playable}
                  title={e.title}
                >
                  <span className="app-side__no mono">{e.no}</span>
                  <span className="app-side__text">{e.title}</span>
                  {e.playable ? <span className="app-side__dot" aria-hidden="true" /> : null}
                </Link>
              </li>
            ))}
          </ol>
          <p className="app-side__label app-side__label--gap">其他</p>
          <ul className="app-side__list">
            <li>
              <Link href="/lab/design" data-active={pathname.startsWith("/lab")}>
                <span className="app-side__no mono">◆</span>
                <span className="app-side__text">拼接式方案设计</span>
              </Link>
            </li>
            <li>
              <Link href="/teacher" data-active={pathname.startsWith("/teacher")}>
                <span className="app-side__no mono">◆</span>
                <span className="app-side__text">教师端</span>
              </Link>
            </li>
          </ul>
          <p className="app-side__meta mono">{groups.length} 组 · {experiments.length} 个实验</p>
        </aside>

        <main className="app-main">
          {crumb ? <p className="app-crumb">{crumb}</p> : null}
          {children}
        </main>

        {aside ? <aside className="app-aside">{aside}</aside> : null}
      </div>
    </div>
  );
}
