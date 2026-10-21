"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * 演示式分屏：把门户的每一屏做成 slide。
 * - 桌面：滚轮分屏吸附（proximity，不强制）+ ↑↓/PageUp/PageDown 切换 + 右侧刻度指示
 * - 移动端：普通滚动，只保留指示器
 * 不改 DOM 结构语义，只做滚动与状态。
 */
export function Deck({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const slides = Array.from(document.querySelectorAll<HTMLElement>("[data-slide]"));
    // 微任务里再写 state，避免 effect 内同步 setState 的级联渲染告警
    queueMicrotask(() => setTotal(slides.length));
    if (slides.length < 2) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const i = slides.indexOf(visible.target as HTMLElement);
        if (i >= 0) setIndex(i);
      },
      { threshold: [0.4, 0.6] },
    );
    slides.forEach((s) => io.observe(s));

    const go = (i: number) => {
      const target = slides[Math.max(0, Math.min(slides.length - 1, i))];
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") {
        go(0);
      } else if (e.key === "End") {
        go(slides.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      io.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, [index]);

  return (
    <>
      {children}
      {total > 1 ? (
        <nav className="deck-rail" aria-label="分屏导航">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              className="deck-rail__dot"
              data-active={i === index}
              aria-label={`第 ${i + 1} 屏`}
              onClick={() => {
                document
                  .querySelectorAll<HTMLElement>("[data-slide]")[i]
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </>
  );
}
