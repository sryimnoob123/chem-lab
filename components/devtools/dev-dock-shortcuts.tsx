"use client";

/** Dev Dock 的「快捷跳转」一组：只列常用页面，点完自动收抽屉。 */

import Link from "next/link";
import styles from "./dev-dock.module.css";

const SHORTCUTS = [
  { href: "/", label: "门户" },
  { href: "/experiments", label: "实验列表" },
  { href: "/teacher", label: "教师端" },
  { href: "/plan", label: "方案设计" },
  { href: "/dev", label: "调试台" },
  { href: "/scene-preview", label: "场景预览" },
];

export function DevDockShortcuts({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <section className={styles.section} data-dev="dock-shortcuts">
      <div className={styles.sectionHead}>
        <h3>快捷</h3>
      </div>
      <div className={styles.pills}>
        {SHORTCUTS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={styles.pill}
            data-dev="dock-shortcut"
            onClick={onNavigate}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
