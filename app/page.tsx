import Link from "next/link";
import { CampusSlides } from "@/components/portal/campus-slides";
import { VesselGlyph } from "@/components/portal/vessel-strip";
import { DemoLaunch } from "@/components/demo/demo-overlay";

const STATS = [
  { no: "10", label: "个实验" },
  { no: "36", label: "学时" },
  { no: "4", label: "级事故后果" },
];

const FEATURED = [
  { id: "exp01", no: "01", title: "仪器的认领、天平使用及溶液配制", steps: 7, vessel: 1 },
  { id: "exp02", no: "02", title: "试剂级氯化钠制备", steps: 6, vessel: 3 },
  { id: "exp09", no: "09", title: "酸碱标准溶液的配制与浓度比较", steps: 7, vessel: 4 },
];

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
            <span className="cover-bar__sub">无机及分析化学实验</span>
          </span>
        </div>
        <div className="cover-bar__right">
          <DemoLaunch />
        </div>
      </header>

      <main className="cover-hero">
        <div className="cover-hero__inner">
          <span className="cover-hero__rule" aria-hidden="true" />
          <h1 className="cover-hero__title">
            把每一次读数，
            <br />
            写进同一本台账。
          </h1>
          <p className="cover-hero__sub cover-fade" style={{ animationDelay: "60ms" }}>
            从洗涤到滴定，十个实验都在同一张实验台上。
          </p>

          <ul className="cover-hero__stats">
            {STATS.map((s) => (
              <li key={s.label}>
                <span className="cover-hero__stat-no">{s.no}</span>
                <span className="cover-hero__stat-label">{s.label}</span>
              </li>
            ))}
          </ul>

          <div className="cover-hero__actions cover-fade" style={{ animationDelay: "120ms" }}>
            <Link className="btn btn--primary cover-hero__cta" href="/login" data-demo-id="demo-cover-cta">
              登录开始实验
            </Link>
          </div>

          <section className="cover-exp" aria-label="实验目录">
            <ol className="cat-list">
              {FEATURED.map((item) => (
                <li className="cat-row" data-state="open" key={item.id}>
                  <Link
                    className="cat-row__link ix-lift"
                    href={`/exp/${item.id}`}
                    data-demo-id={`demo-home-${item.id}`}
                  >
                    <span className="cat-row__no mono">{item.no}</span>
                    <span className="cat-row__icon" aria-hidden="true">
                      <VesselGlyph index={item.vessel} />
                    </span>
                    <span className="cat-row__main">
                      <span className="cat-row__title">{item.title}</span>
                    </span>
                    <span className="cat-row__meta mono">{item.steps} 步</span>
                  </Link>
                </li>
              ))}
            </ol>
            <Link className="cover-exp__all" href="/experiments">
              查看全部 10 个 →
            </Link>
          </section>
        </div>
      </main>

      <div className="cover-foot">
        <span className="cover-foot__motto">明德新民　止于至善</span>
        <span className="cover-foot__org">能源科学与技术学院</span>
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
          background:
            linear-gradient(90deg, transparent 46%, rgba(246,247,245,.18) 68%, rgba(246,247,245,.32) 100%),
            linear-gradient(to top, rgba(246,247,245,.82) 0%, rgba(246,247,245,.2) 12%, transparent 28%);
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
        .cover .demo-launch:hover {
          color: var(--river-700);
          border-color: var(--river-500);
          background: rgba(35, 48, 127, .05);
        }

        .cover-hero {
          z-index: 2;
          max-width: 840px;
          margin: 0;
          padding-left: clamp(32px, 7vw, 116px);
          padding-block: clamp(34px, 6vh, 64px) 22px;
        }
        .cover-hero__inner { width: 100%; }
        .cover-hero__rule { background: var(--river-700); }
        .cover-hero__kicker { display: none; }
        .cover-hero__title {
          max-width: 12em;
          margin: 15px 0 0;
          color: var(--ink);
          font-size: clamp(42px, 4.1vw, 58px);
          line-height: 1.22;
          letter-spacing: -.025em;
          animation: cover-title-in 480ms var(--ease-out) both;
        }
        .cover-hero__sub {
          margin: 15px 0 0;
          max-width: 34em;
          color: var(--ink-2);
          font-size: var(--text-15, 15px);
          line-height: 1.65;
        }
        .cover-hero__stats { margin-top: 22px; gap: 28px; }
        .cover-hero__stats li { border-left-color: var(--line); }
        .cover-hero__stat-no { color: var(--river-900); font-size: 22px; }
        .cover-hero__stat-label { color: var(--ink-2); }

        .cover-hero__actions { margin-top: 24px; }
        .cover .btn--primary {
          background: var(--river-700);
          color: #fff;
          box-shadow: 0 12px 28px rgba(35, 48, 127, .2);
        }
        .cover .btn--primary:hover { background: var(--river-800, #1b266a); transform: scale(1.02); }
        .cover .btn--primary:active { transform: scale(.97); }
        .cover-hero__cta { height: 50px; padding: 0 28px; }

        .cover-exp { margin-top: 24px; }
        .cover-exp .cat-list { gap: 7px; }
        .cover-exp .cat-row__link {
          grid-template-columns: 48px 30px minmax(0, 1fr) auto;
          min-height: 66px;
          padding: 8px 16px 8px 13px;
          gap: 13px;
          box-shadow: 0 1px 2px rgba(22, 32, 44, .05);
        }
        .cover-exp .cat-row__icon { display: inline-flex; }
        .cover-exp .cat-row__meta { display: inline; }
        .cover-exp .cat-row__no { font-size: 19px; }
        .cover-exp .cat-row__title { font-size: 14px; }
        .cover-exp .cat-row__meta { font-size: 11px; color: var(--ink-2); }
        .cover-exp .cat-row__link:hover { transform: translateX(2px); }
        .cover-exp__all {
          display: inline-block;
          margin-top: 13px;
          font-size: 12px;
          color: var(--ink-2);
          border-bottom: 1px solid var(--line);
          padding-bottom: 2px;
          transition: color 160ms ease, border-color 160ms ease;
        }
        .cover-exp__all:hover { color: var(--river-700); border-color: var(--river-700); }

        .cover-foot {
          z-index: 4;
          border-top-color: var(--line);
          color: var(--ink-2);
        }
        .cover-foot__motto { color: var(--ink); }
        .cover-foot__org { color: var(--ink-2); }

        .cover-fade {
          animation-duration: 300ms !important;
          animation-timing-function: var(--ease-out);
          animation-fill-mode: both;
        }
        @keyframes cover-title-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: none; }
        }

        @media (max-width: 900px) {
          .cover-hero { max-width: none; padding-left: clamp(20px, 5vw, 40px); padding-right: clamp(20px, 5vw, 40px); }
          .cover__wash {
            background:
              linear-gradient(180deg, rgba(246,247,245,.18) 0%, rgba(246,247,245,.12) 46%, rgba(246,247,245,.42) 100%),
              linear-gradient(90deg, rgba(246,247,245,.18), transparent 70%);
          }
        }
        @media (max-width: 620px) {
          .cover-bar { padding: 0 16px; gap: 10px; }
          .cover-bar__emblem { width: 38px; height: 38px; }
          .cover-hero { padding-block: 30px 18px; }
          .cover-hero__title { font-size: 33px; max-width: 10.5em; }
          .cover-hero__sub { font-size: 13px; line-height: 1.6; }
          .cover-hero__stats { display: none; }
          .cover-hero__actions { margin-top: 20px; }
          .cover-hero__cta { height: 48px; padding: 0 24px; font-size: var(--text-14); }
          .cover-exp { margin-top: 22px; }
          .cover-exp .cat-row__link { grid-template-columns: 38px 26px minmax(0, 1fr) auto; gap: 9px; min-height: 62px; padding: 7px 10px 7px 10px; }
          .cover-exp .cat-row__no { font-size: 16px; }
          .cover-exp .cat-row__title { font-size: 13px; }
          .cover-exp__all { margin-top: 11px; }
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
