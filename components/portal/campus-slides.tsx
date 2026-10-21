"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Slide = {
  src: string;
  /** 桌面：object-position，把建筑主体推离左侧文字压条 */
  position: string;
  /** 移动端：水平居中，避免竖屏裁掉匾额/建筑主体 */
  mobilePosition: string;
};

/**
 * 门户校园实景，全部来自 henu.edu.cn。
 * 排序：校门（campus-06 明伦校区南大门，「河南大學」匾额）第一 → 建筑实景 → 校庆/口号海报末位。
 * campus-08 为党建宣传图，与课程无关，已移除。
 */
const SLIDES: readonly Slide[] = [
  { src: "/brand/campus/campus-06.jpg", position: "0% 50%", mobilePosition: "50% 46%" },
  { src: "/brand/campus/campus-02.jpg", position: "50% 50%", mobilePosition: "50% 50%" },
  { src: "/brand/campus/campus-03.jpg", position: "50% 50%", mobilePosition: "50% 50%" },
  { src: "/brand/campus/campus-05.jpg", position: "0% 50%", mobilePosition: "50% 50%" },
  { src: "/brand/campus/campus-01.jpg", position: "50% 50%", mobilePosition: "50% 50%" },
  { src: "/brand/campus/campus-07.jpg", position: "50% 50%", mobilePosition: "50% 50%" },
  { src: "/brand/campus/campus-04.jpg", position: "50% 50%", mobilePosition: "50% 50%" },
];

const CROSS_FADE_MS = 700;
const INTERVAL_MS = 5000;
/** 缓慢推近：一张图停留期间只做 1→1.04 的 Ken Burns，只动 transform */
const KEN_BURNS_MS = 26000;

type Tone = "paper" | "dark";

/**
 * 校园图轮播：7 张叠放，data-active 切图，CSS class + 变量控制 700ms 过渡。
 * - 新旧两张同时可见，opacity 各走 1→0 / 0→1；切换中加 2px blur 掩盖叠图割裂。
 * - object-fit: cover + 本地位置变量；当前图做 26s Ken Burns（scale 1→1.04）。
 * - 首两张 preload + eager；prefers-reduced-motion 停在第一张且无缩放。
 */
export function CampusSlides({
  className,
  interval = INTERVAL_MS,
  dim = 0.55,
  tone = "dark",
  still = false,
}: {
  className?: string;
  interval?: number;
  dim?: number;
  tone?: Tone;
  still?: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (still || reduced) return;
    const timer = window.setTimeout(() => {
      setSwitching(true);
      setCurrent((value) => (value + 1) % SLIDES.length);
    }, Math.min(9000, Math.max(3000, interval)));
    return () => window.clearTimeout(timer);
  }, [current, interval, reduced, still]);

  useEffect(() => {
    if (!switching) return;
    const timer = window.setTimeout(
      () => setSwitching(false),
      CROSS_FADE_MS + 60,
    );
    return () => window.clearTimeout(timer);
  }, [switching]);

  const darkBackground = `radial-gradient(120% 95% at 50% 38%, rgba(3,8,13,${(
    dim * 0.58
  ).toFixed(2)}) 0%, rgba(3,8,13,${(dim * 0.8).toFixed(2)}) 58%, rgba(3,8,13,${Math.min(
    0.94,
    dim + 0.22,
  ).toFixed(2)}) 100%), linear-gradient(180deg, rgba(3,8,13,${(dim * 0.44).toFixed(
    2,
  )}) 0%, rgba(3,8,13,${(dim * 0.24).toFixed(2)}) 46%, rgba(3,8,13,${(
    dim * 0.68
  ).toFixed(2)}) 100%)`;

  return (
    <>
      <link rel="preload" as="image" href={SLIDES[0].src} />
      {!still && <link rel="preload" as="image" href={SLIDES[1].src} />}
      <div
        className={`campus-slides campus-slides--${tone} ${
          still ? "campus-slides--still" : ""
        } ${switching ? "campus-slides--switching" : ""} ${className ?? ""}`}
        aria-hidden="true"
        data-slide-count={SLIDES.length}
        data-crossfade-ms={CROSS_FADE_MS}
        data-interval-ms={INTERVAL_MS}
        style={
          {
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            background: tone === "paper" ? "#f6f7f5" : "#081018",
            filter: "none",
            opacity: tone === "dark" ? 1 : undefined,
            animation: "none",
            isolation: "isolate",
            pointerEvents: "none",
            "--slide-fade": `${CROSS_FADE_MS}ms`,
          } as CSSProperties
        }
      >
        {SLIDES.map((slide, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slide.src}
            className="campus-slides__img"
            src={slide.src}
            alt=""
            loading={i < 2 ? "eager" : "lazy"}
            decoding="async"
            data-active={i === current ? "true" : "false"}
            style={
              {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                zIndex: i === current ? 2 : 1,
                willChange: "opacity, transform",
                "--pos-d": slide.position,
                "--pos-m": slide.mobilePosition,
              } as CSSProperties
            }
          />
        ))}

        <div
          className={`campus-slides__shade ${
            tone === "paper" ? "campus-slides__shade--paper" : ""
          }`}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            background: tone === "dark" ? darkBackground : undefined,
          }}
        />
        <style>{`
          .campus-slides__img {
            display: block;
            opacity: 0;
            object-position: var(--pos-d, 50% 50%);
            transform: scale(1);
            transform-origin: 50% 45%;
            filter: contrast(1.08) saturate(1.15);
            transition: opacity var(--slide-fade) cubic-bezier(.23, 1, .32, 1);
          }
          .campus-slides__img[data-active="true"] {
            opacity: 1;
            animation: campus-kenburns ${KEN_BURNS_MS}ms linear both;
          }
          @keyframes campus-kenburns {
            from { transform: scale(1); }
            to { transform: scale(1.04); }
          }
          .campus-slides--switching .campus-slides__img {
            filter: contrast(1.08) saturate(1.15) blur(2px);
          }
          /* 只保留可读所需的最小白雾：左侧文字压条由 .cover-hero::before 承担，
             这里整体减淡，右侧/远景几乎通透，建筑轮廓与天空可见 */
          .campus-slides__shade--paper {
            background:
              linear-gradient(100deg, rgba(246,247,245,.34) 0%, rgba(246,247,245,.3) 26%, rgba(246,247,245,.17) 50%, rgba(246,247,245,.07) 78%, rgba(246,247,245,.03) 100%),
              linear-gradient(to top, #f6f7f5 0%, rgba(246,247,245,.34) 7%, transparent 15%);
          }
          @media (max-width: 900px) {
            .campus-slides__img {
              object-position: var(--pos-m, var(--pos-d, 50% 50%));
            }
            .campus-slides__shade--paper {
              background: linear-gradient(180deg, rgba(246,247,245,.18) 0%, rgba(246,247,245,.3) 24%, rgba(246,247,245,.42) 62%, rgba(246,247,245,.56) 100%);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .campus-slides__img {
              transition: none !important;
              animation: none !important;
              transform: none !important;
            }
            .campus-slides--switching .campus-slides__img {
              filter: contrast(1.08) saturate(1.15);
            }
          }
        `}</style>
      </div>
    </>
  );
}
