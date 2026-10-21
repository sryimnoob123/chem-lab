"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/teacher", label: "学情总览" },
  { href: "/teacher/roster", label: "名单管理" },
] as const;

/** 顶栏 Tab：只有"当前项"需要看路径，故用最小 client 组件，其余全站仍是 Server Component */
export function TeacherTabs() {
  const pathname = usePathname();

  return (
    <nav className="tch-tabs" aria-label="教师端主导航">
      {TABS.map((tab) => {
        const active = tab.href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} className="tch-tab" href={tab.href} aria-current={active ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
