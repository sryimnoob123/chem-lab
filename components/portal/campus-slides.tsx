"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Slide = {
  src: string;
  /** 统一居中；只用 object-fit: cover，不做固定宽高拉伸 */
  position: string;
};

/** 官网校园实景，8 张全部来自 henu.edu.cn。 */
const SLIDES: readonly Slide[] = [
  { src: "/brand/campus/campus-02.jpg", position: "50% 50%" },
  { src: "/brand/campus/campus-03.jpg", position: "50% 50%" },
  { src: "/brand/campus/campus-06.jpg", position: "50% 50%" },
  { src: "/brand/campus/campus-01.jpg", position: "50% 50%" },
  { src: "/brand/campus/campus-05.jpg", position: "50% 50%" },
  { src: "/brand/campus/campus-04.jpg", position: "50% 50%" },
  { src: "/brand/campus/campus-07.jpg", position: "50% 50%" },
  { src: "/brand/campus/campus-08.jpg", position: "50% 50%" },
];

const CROSS_FADE_MS = 700;
const INTERVAL_MS = 5000;

type Tone = "paper" | "dark";

/**
 * 校园图轮播：8 张叠放，data-active 切图，CSS class + 变量控制 700ms 过渡。
 * - 新旧两张同时可见，opacity 各走 1→0 / 0→1；切换中加 2px blur 掩盖叠图割裂。
 * - object-fit: cover + center，不做 scale 推近。
 * - 首两张 preload + eager；prefers-reduced-motion 停在第一张。
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
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: slide.position,
              zIndex: i === current ? 2 : 1,
              willChange: "opacity",
            }}
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
            filter: contrast(1.08) saturate(1.15);
            transition: opacity var(--slide-fade) cubic-bezier(.23, 1, .32, 1);
          }
          .campus-slides__img[data-active="true"] {
            opacity: 1;
          }
          .campus-slides--switching .campus-slides__img {
            filter: contrast(1.08) saturate(1.15) blur(2px);
          }
          .campus-slides__shade--paper {
            background:
              linear-gradient(100deg, rgba(246,247,245,.58) 0%, rgba(246,247,245,.55) 30%, rgba(246,247,245,.42) 52%, rgba(246,247,245,.2) 76%, rgba(246,247,245,.15) 100%),
              linear-gradient(to top, #f6f7f5 0%, rgba(246,247,245,.5) 8%, transparent 22%);
          }
          @media (max-width: 900px) {
            .campus-slides--paper { opacity: .98; }
            .campus-slides__shade--paper {
              background: linear-gradient(180deg, rgba(246,247,245,.6) 0%, rgba(246,247,245,.55) 46%, rgba(246,247,245,.76) 100%);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .campus-slides__img {
              transition: none !important;
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
