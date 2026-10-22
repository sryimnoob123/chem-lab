import Link from "next/link";
import type { ReactNode } from "react";
import { isTeacher } from "@/lib/session";
import { TeacherTabs } from "@/components/teacher/tabs";
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
            返回学生主界面（/experiments）。
            为什么加：教师端此前没有任何回主界面的入口 —— 顶栏 Tab 只有「学情总览 / 名单管理」，
            页边刻度的 03 只是回课程首页（/），教师演示完想切回学生视角只能手动改地址。
            位置固定在顶栏最左、品牌之前：右侧 Tab 与用户区靠 margin-left:auto 定位，
            加这一项不会重排既有导航。
          */}
          <Link className={styles.backLink} href="/experiments" aria-label="返回主界面">
            <span className={styles.backLink__arrow} aria-hidden="true">
              ←
            </span>
            <span className={styles.backLink__label}>返回主界面</span>
          </Link>

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
