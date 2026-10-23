import type { ReactNode } from "react";
import { isTeacher } from "@/lib/session";
import { TeacherTabs } from "@/components/teacher/tabs";
import { TeacherBack } from "@/components/teacher/back-link";
import { TeacherUnlock } from "@/components/teacher/unlock";
import styles from "./layout.module.css";

/** 教师端外壳：暗场顶栏（与首页 hero 同族色）+ 亮区内容面 */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const unlocked = await isTeacher();

  return (
    <>
      <header className="tch-top">
        <div className={`page-shell tch-top__inner ${styles.bar}`}>
          {/*
            返回：教师端子页 → 回教师端首页（不再直接跳学生端，用户 2026-10-23 报的 bug）；
            已经在教师端首页 → 这一项才变成「学生端」。
            位置固定在顶栏最左、品牌之前：右侧 Tab 与用户区靠 margin-left:auto 定位，
            加这一项不会重排既有导航。
          */}
          <TeacherBack
            className={styles.backLink}
            arrowClass={styles.backLink__arrow}
            labelClass={styles.backLink__label}
          />

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
