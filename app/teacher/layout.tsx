import Link from "next/link";
import type { ReactNode } from "react";
import { isTeacher } from "@/lib/session";
import { TeacherTabs } from "@/components/teacher/tabs";
import { TeacherUnlock } from "@/components/teacher/unlock";

/** 教师端外壳：暗场顶栏（与首页 hero 同族色）+ 亮区内容面 */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const unlocked = await isTeacher();

  return (
    <>
      <nav className="step-rail tch-rail" aria-label="教师端导航">
        <ol className="step-rail__list">
          <li className="step-rail__item">
            <Link className="step-rail__link" href="/teacher" title="学情总览">
              01
            </Link>
          </li>
          <li className="step-rail__item">
            <Link className="step-rail__link" href="/teacher/roster" title="名单管理">
              02
            </Link>
          </li>
          <li className="step-rail__item">
            <Link className="step-rail__link" href="/" title="返回首页">
              03
            </Link>
          </li>
        </ol>
      </nav>

      <header className="tch-top">
        <div className="page-shell tch-top__inner">
          <div className="tch-brand">
            <span className="tch-brand__mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/henan-university-emblem.png" alt="河南大学校徽" width={28} height={28} />
            </span>
            <span className="tch-brand__name">河南大学 · 无机及分析化学实验</span>
            <span className="tch-brand__tag">教师端</span>
          </div>

          <TeacherTabs />

          <div className="tch-user">
            {unlocked ? null : <TeacherUnlock />}
            <span className="tch-user__name">刘建彩</span>
            <span className="tch-avatar" aria-hidden="true">
              刘
            </span>
          </div>
        </div>
      </header>

      <main className="page-shell tch-main">{children}</main>
    </>
  );
}
