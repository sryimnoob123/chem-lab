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
 * 门户实景，全部来自 henu.edu.cn（校园建筑照，仓库里没有实验室照片）。
 * 排序：校门（campus-06 明伦校区南大门，「河南大學」匾额）第一 → 建筑细节 → 校庆/口号海报末位。
 * campus-08 为党建宣传图，与课程无关，已移除。
 * 视觉权重：纸白场（tone="paper"）下统一降饱和 + 提高纸白遮罩，
 * object-position 尽量落在有建筑细节的区（檐口/门窗/匾额/石阶），
 * 让校园图只当底纹，前景由器材线稿承担"实验室"语境。
 * 换真实实验室照片：把图放进 public/brand/campus/ 后改这里的 src 与 position 即可。
 */
const SLIDES: readonly Slide[] = [
  { src: "/brand/campus/campus-06.jpg", position: "56% 56%", mobilePosition: "56% 52%" },
  { src: "/brand/campus/campus-02.jpg", position: "50% 42%", mobilePosition: "50% 40%" },
  { src: "/brand/campus/campus-03.jpg", position: "40% 48%", mobilePosition: "50% 48%" },
  { src: "/brand/campus/campus-05.jpg", position: "52% 50%", mobilePosition: "50% 50%" },
  { src: "/brand/campus/campus-01.jpg", position: "50% 46%", mobilePosition: "50% 46%" },
  { src: "/brand/campus/campus-07.jpg", position: "50% 40%", mobilePosition: "50% 40%" },
  { src: "/brand/campus/campus-04.jpg", position: "62% 58%", mobilePosition: "56% 54%" },
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
        {tone === "paper" ? (
          <>
            {/* 方格纸底：和门禁页前测同一套语言，填住照片淡出后的空纸 */}
            <div className="campus-slides__grid" />
            {/* 器材线稿：校园图只当底纹，把"实验室"语境压在右上/右侧余白上，8% 以内 */}
            <svg className="campus-slides__lab" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            <defs>
              <pattern id="campus-lab-tile" width="300" height="280" patternUnits="userSpaceOnUse">
                <g fill="none" stroke="#4a5768" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M28 40h54v56a12 12 0 0 1-12 12H40a12 12 0 0 1-12-12Z" />
                  <path d="M28 40q6-8 13 0" />
                  <path d="M37 74h36" strokeDasharray="3 6" />
                  <path d="M170 26h11v25l21 46a12 12 0 0 1-11 17h-42a12 12 0 0 1-11-17l21-46Z" />
                  <path d="M154 84h38" strokeDasharray="3 6" />
                  <path d="M246 38v60a9 9 0 0 0 18 0V38" />
                  <path d="M241 38h28" />
                </g>
              </pattern>
            </defs>
            <rect width="1440" height="900" fill="url(#campus-lab-tile)" opacity=".55" />
            {/* 右侧大件：铁架台 + 滴定管，和门禁页同一套语言 */}
            <g
              transform="translate(1120 130)"
              fill="none"
              stroke="#4a5768"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity=".6"
            >
              <path d="M14 452h140" />
              <path d="M48 452V22" />
              <path d="M48 54h32" />
              <path d="M48 116h32" />
              <path d="M110 40v284" />
              <path d="M122 40v284" />
              <path d="M110 40h12" />
              <path d="M104 324h24" />
              <path d="M116 324l-8 26h16Z" />
              <path d="M110 82h8M110 114h8M110 146h8M110 178h8M110 210h8M110 242h8" />
            </g>
            </svg>
          </>
        ) : null}
        <style>{`
          .campus-slides { --img-filter: contrast(1.08) saturate(1.15); }
          /* 纸白场：校园照压成底纹，颜色交给前景的器材线稿与卡片 */
          .campus-slides--paper { --img-filter: grayscale(.38) saturate(.46) contrast(1.02) brightness(1.05); }
          .campus-slides__img {
            display: block;
            opacity: 0;
            object-position: var(--pos-d, 50% 50%);
            transform: scale(1);
            transform-origin: 50% 45%;
            filter: var(--img-filter);
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
          /* 器材线稿压在照片之上、正文之下：只在纸白场出现，8% 上下 */
          .campus-slides__grid {
            position: absolute;
            inset: 0;
            z-index: 4;
            pointer-events: none;
            background:
              repeating-linear-gradient(90deg, rgba(74,87,104,.055) 0 1px, transparent 1px 40px),
              repeating-linear-gradient(0deg, rgba(74,87,104,.05) 0 1px, transparent 1px 40px);
          }
          .campus-slides__lab {
            position: absolute;
            inset: 0;
            z-index: 5;
            width: 100%;
            height: 100%;
            pointer-events: none;
            opacity: .12;
          }
          .campus-slides--switching .campus-slides__img {
            filter: var(--img-filter) blur(2px);
          }
          /* 只保留可读所需的最小白雾：左侧文字压条由 .cover-hero::before 承担，
             这里整体减淡，右侧/远景几乎通透，建筑轮廓与天空可见 */
          .campus-slides__shade--paper {
            background:
              /* 只留右上角一块"窗口"看得见建筑，向下、向右淡进纸白，避免整幅校园全景压场 */
              radial-gradient(105% 78% at 78% 16%, rgba(246,247,245,0) 0%, rgba(246,247,245,.14) 42%, rgba(246,247,245,.6) 78%, rgba(246,247,245,.86) 100%),
              linear-gradient(100deg, rgba(246,247,245,.5) 0%, rgba(246,247,245,.44) 26%, rgba(246,247,245,.3) 50%, rgba(246,247,245,.2) 78%, rgba(246,247,245,.13) 100%),
              linear-gradient(to top, #f6f7f5 0%, rgba(246,247,245,.45) 8%, transparent 18%);
          }
          @media (max-width: 900px) {
            .campus-slides__img {
              object-position: var(--pos-m, var(--pos-d, 50% 50%));
            }
            .campus-slides__shade--paper {
              background: linear-gradient(180deg, rgba(246,247,245,.26) 0%, rgba(246,247,245,.36) 24%, rgba(246,247,245,.5) 62%, rgba(246,247,245,.62) 100%);
            }
            .campus-slides__lab { opacity: .075; }
          }
          @media (prefers-reduced-motion: reduce) {
            .campus-slides__img {
              transition: none !important;
              animation: none !important;
              transform: none !important;
            }
            .campus-slides--switching .campus-slides__img {
              filter: var(--img-filter);
            }
          }
        `}</style>
      </div>
    </>
  );
}
