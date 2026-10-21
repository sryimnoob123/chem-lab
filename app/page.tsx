import Link from "next/link";
import { CampusSlides } from "@/components/portal/campus-slides";
import { ExperimentList } from "@/components/portal/experiment-list";
import { DemoLaunch } from "@/components/demo/demo-overlay";

export default function Cover() {
  return (
    <div className="cover">
      <CampusSlides className="cover__scene" tone="paper" />
      <span className="cover__wash" aria-hidden="true" />
      <span className="cover__tick" data-pos="tl" aria-hidden="true" />
      <span className="cover__tick" data-pos="tr" aria-hidden="true" />
      <span className="cover__tick" data-pos="bl" aria-hidden="true" />
      <span className="cover__tick" data-pos="br" aria-hidden="true" />

      <header className="cover-bar">
        <div className="cover-bar__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cover-bar__emblem"
            src="/brand/henan-university-emblem.png"
            alt="河南大学校徽"
            width={48}
            height={48}
          />
          <span className="cover-bar__names">
            <span className="cover-bar__cn">河南大学</span>
            <span className="cover-bar__sub">化学化工学院</span>
          </span>
        </div>
        <div className="cover-bar__right">
          <DemoLaunch />
        </div>
      </header>

      <main className="cover-hero">
        <div className="cover-hero__inner">
          <span className="cover-hero__rule" aria-hidden="true" />
          <h1 className="cover-hero__title">无机及分析化学实验</h1>
          <p className="cover-hero__sub">
            河南大学 · 化学化工学院 · 03600004 · 36 学时 · 10 个实验
          </p>
          <p className="cover-hero__slogan">把每一次读数，写进同一本台账。</p>

          <div className="cover-hero__actions">
            <Link className="btn btn--primary cover-hero__cta" href="/login" data-demo-id="demo-cover-cta">
              登录开始实验
            </Link>
          </div>

          <section className="cover-exp" aria-label="实验目录">
            <ExperimentList />
          </section>
        </div>
      </main>

      <div className="cover-foot">
        <span className="cover-foot__motto">明德新民　止于至善</span>
        <span className="cover-foot__org">化学化工学院</span>
      </div>

      <style>{`
        .cover {
          min-height: 100svh;
          background: #f6f7f5;
          color: var(--ink);
        }
        .cover__wash {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(to top, #f6f7f5 0%, rgba(246,247,245,.28) 8%, transparent 26%);
        }
        .cover__tick { border-color: rgba(35, 48, 127, .28); z-index: 3; }

        .cover-bar {
          z-index: 4;
          background: rgba(255, 255, 255, .76);
          border-bottom-color: var(--line);
          color: var(--ink);
        }
        .cover-bar__brand,
        .cover-bar__cn { color: var(--ink); }
        .cover-bar__sub { color: var(--ink-2); border-left-color: var(--line); }
        .cover-bar__emblem { width: 44px; height: 44px; }
        .cover .demo-launch {
          color: var(--ink);
          border-color: var(--line);
        }

        .cover-hero {
          z-index: 2;
          max-width: 840px;
          margin: 0;
          padding-left: clamp(32px, 7vw, 116px);
          padding-block: clamp(34px, 6vh, 64px) 22px;
        }
        .cover-hero::before {
          content: "";
          position: absolute;
          inset: -10px -28px -14px 0;
          z-index: -1;
          pointer-events: none;
          background: linear-gradient(90deg, rgba(246,247,245,.9) 0%, rgba(246,247,245,.86) 62%, rgba(246,247,245,.6) 88%, rgba(246,247,245,.16) 100%);
        }
        .cover-hero__inner { width: 100%; }
        .cover-hero__rule { background: var(--river-700); }
        .cover-hero__title {
          margin: 15px 0 0;
          color: var(--ink);
          font-size: clamp(40px, 3.9vw, 56px);
          line-height: 1.18;
          letter-spacing: -.025em;
          animation: cover-title-in 300ms var(--ease-out) both;
        }
        .cover-hero__sub {
          margin: 13px 0 0;
          color: var(--ink-2);
          font-size: 13px;
          line-height: 1.6;
          font-weight: 500;
        }
        .cover-hero__slogan {
          margin: 8px 0 0;
          color: rgba(74, 87, 104, .78);
          font-size: 12px;
          line-height: 1.6;
        }

        .cover-hero__actions { margin-top: 22px; }
        .cover .btn--primary {
          background: var(--river-700);
          color: #fff;
          box-shadow: 0 12px 28px rgba(35, 48, 127, .2);
        }
        .cover .btn--primary:active { transform: scale(.97); }
        .cover-hero__cta { height: 50px; padding: 0 28px; }

        .cover-exp { margin-top: 26px; }

        .cover-foot {
          z-index: 4;
          border-top-color: var(--line);
          color: var(--ink-2);
        }
        .cover-foot__motto { color: var(--ink); }
        .cover-foot__org { color: var(--ink-2); }

        @keyframes cover-title-in {
          from { opacity: 0; transform: translateY(12px) scale(.98); }
          to { opacity: 1; transform: none; }
        }

        @media (hover: hover) and (pointer: fine) {
          .cover .demo-launch:hover {
            color: var(--river-700);
            border-color: var(--river-500);
            background: rgba(35, 48, 127, .05);
          }
          .cover .btn--primary:hover {
            background: var(--river-800, #1b266a);
            transform: scale(1.02);
          }
        }

        @media (max-width: 900px) {
          .cover-hero { max-width: none; padding-left: clamp(20px, 5vw, 40px); padding-right: clamp(20px, 5vw, 40px); }
        }
        @media (max-width: 620px) {
          .cover-bar { padding: 0 16px; gap: 10px; }
          .cover-bar__emblem { width: 38px; height: 38px; }
          .cover-hero { padding-block: 30px 18px; }
          .cover-hero__title { font-size: 33px; }
          .cover-hero__sub { font-size: 12px; }
          .cover-hero__slogan { font-size: 11px; }
          .cover-hero__actions { margin-top: 18px; }
          .cover-hero__cta { height: 48px; padding: 0 24px; font-size: var(--text-14); }
          .cover-exp { margin-top: 22px; }
          .cover-foot { display: none; }
          .cover__tick { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cover-hero__title { animation: none; }
        }
      `}</style>
    </div>
  );
}
