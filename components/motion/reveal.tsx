"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** 入场延迟序号，0 起；CSS 用它算 transition-delay */
  index?: number;
  as?: ElementType;
  className?: string;
  /** 其余属性（data-*、id、aria-* 等）原样透传 */
  [key: `data-${string}`]: string | undefined;
};

/**
 * 滚动入场：元素进入视口一次后保持可见。
 * 只改 opacity / transform，符合契约 §6；prefers-reduced-motion 时直接显示。
 */
export function Reveal({ children, index = 0, as, className, ...rest }: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // 放到微任务里，避免在 effect 内同步 setState 触发级联渲染（eslint react 规则）
      queueMicrotask(() => setShown(true));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref}
      className={className}
      data-reveal={shown ? "in" : "out"}
      style={{ "--reveal-i": index } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** 数字滚动：从 0 数到目标值，演示时可当读数动画用 */
export function CountUp({
  to,
  digits = 2,
  ms = 900,
  suffix = "",
}: {
  to: number;
  digits?: number;
  ms?: number;
  suffix?: string;
}) {
  // 初始就渲染终值：SSR/截图/无 JS 场景下数字都是对的，挂载后再从 0 起跳
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 减动效时保持初始终值即可，无需 setState
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setValue(0);
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / ms);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(to * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, ms]);

  return (
    <span ref={ref}>
      {value.toFixed(digits)}
      {suffix}
    </span>
  );
}
