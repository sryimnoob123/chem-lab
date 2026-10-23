"use client";

/**
 * 教师端顶栏的返回入口（用户 2026-10-23 报的 bug：
 * 「教师端点了返回之后直接进学生端了，应该还在教师后台」）。
 *
 * 规则：
 *   - 在教师端子页（名单管理 / 学生详情）→ 返回**教师端首页** `/teacher`，不出教师后台；
 *   - 已经在教师端首页 → 这一项改成「学生端」，需要离开时才离开（显式写出来，学生端不是默认出口）。
 *
 * 样式从 layout.module.css 传进来：保持服务端 layout 不变成 client component。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeacherBack({
  className,
  arrowClass,
  labelClass,
}: {
  className?: string;
  arrowClass?: string;
  labelClass?: string;
}) {
  const pathname = usePathname() ?? "/teacher";
  const inSubPage = pathname !== "/teacher";
  const href = inSubPage ? "/teacher" : "/experiments";
  const label = inSubPage ? "返回" : "学生端";

  return (
    <Link className={className} href={href} aria-label={inSubPage ? "返回教师端首页" : "切到学生端"}>
      <span className={arrowClass} aria-hidden="true">
        ←
      </span>
      <span className={labelClass}>{label}</span>
    </Link>
  );
}
