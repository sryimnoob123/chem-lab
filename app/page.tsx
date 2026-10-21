import Link from "next/link";
import { LabScene } from "@/components/portal/lab-scene";
import { DemoLaunch } from "@/components/demo/demo-overlay";

const STATS = [
  { no: "10", label: "个实验" },
  { no: "36", label: "学时" },
  { no: "4", label: "级事故后果" },
];

const CARDS = [
  {
    no: "01",
    title: "十个实验，同一套操作规范",
    desc: "洗涤 · 称量 · 定容 · 滴定",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    no: "02",
    title: "做错会出真实后果",
    desc: "爆炸 · 毒气 · 暴沸 · 灼伤",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5" strokeLinecap="round" />
        <path d="M4 17a8 8 0 0 0 16 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    no: "03",
    title: "过程性评价 100%",
    desc: "预习 10% · 操作 40% · 报告 50%",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 19V5m0 14h16M8 19v-6m4 6V9m4 10v-4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Cover() {
  return (
    <div className="cover">
      <LabScene className="cover__scene" />
      <span className="cover__scrim" aria-hidden="true" />
      <span className="cover__tick" data-pos="tl" aria-hidden="true" />
      <span className="cover__tick" data-pos="tr" aria-hidden="true" />
      <span className="cover__tick" data-pos="bl" aria-hidden="true" />
      <span className="cover__tick" data-pos="br" aria-hidden="true" />

      <header className="cover-bar">
        <div className="cover-bar__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cover-bar__emblem" src="/brand/henan-university-emblem.png" alt="河南大学校徽" width={48} height={48} />
          <span className="cover-bar__names">
            <span className="cover-bar__cn">河南大学</span>
            <span className="cover-bar__sub">无机及分析化学实验</span>
          </span>
        </div>
        <div className="cover-bar__right">
          <span className="cover-bar__status">
            <span className="cover-bar__dot" aria-hidden="true" />
            READY
          </span>
          <DemoLaunch />
          <Link className="btn btn--primary" href="/login" data-demo-id="demo-cover-enter">
            进入平台
          </Link>
        </div>
      </header>

      <main className="cover-hero">
        <div>
          <span className="cover-hero__rule cover-fade" aria-hidden="true" style={{ animationDelay: "0ms" }} />
          <p className="cover-hero__kicker cover-fade" style={{ animationDelay: "80ms" }}>
            HENAN UNIVERSITY · ANALYTICAL CHEMISTRY LAB
          </p>
          <h1 className="cover-hero__title cover-fade" style={{ animationDelay: "160ms" }}>
            把每一次读数，
            <br />
            <mark>写进同一本台账。</mark>
          </h1>
          <p className="cover-hero__sub cover-fade" style={{ animationDelay: "240ms" }}>
            从洗涤、称量到滴定，十个实验都在同一张实验台上完成。
            <br />
            操作留痕，事故可复盘，讲清为什么错、正确怎么做。
          </p>

          <ul className="cover-hero__stats cover-fade" style={{ animationDelay: "300ms" }}>
            {STATS.map((s) => (
              <li key={s.label}>
                <span className="cover-hero__stat-no">{s.no}</span>
                <span className="cover-hero__stat-label">{s.label}</span>
              </li>
            ))}
          </ul>

          <div className="cover-hero__actions cover-fade" style={{ animationDelay: "360ms" }}>
            <Link className="btn btn--primary cover-hero__cta" href="/login" data-demo-id="demo-cover-cta">
              登录开始实验
            </Link>
            <Link className="cover-hero__link" href="/demo">
              看自动演示 →
            </Link>
          </div>
          <div className="cover-cards">
          {CARDS.map((c, i) => (
            <div key={c.no} className="cover-card cover-fade" style={{ animationDelay: `${420 + i * 80}ms` }}>
              <span className="cover-card__icon" aria-hidden="true">
                {c.icon}
              </span>
              <div>
                <p className="cover-card__title">{c.title}</p>
                <p className="cover-card__desc">{c.desc}</p>
              </div>
              <span className="cover-card__no">{c.no}</span>
            </div>
          ))}
          </div>
        </div>
      </main>

      <div className="cover-foot">
        <span className="cover-foot__motto">明德新民　止于至善</span>
        <div className="cover-telemetry" aria-hidden="true">
          <span>V 0.04 mL</span>
          <span>0.1 mL 分度</span>
          <span>7 步操作</span>
          <span>14 个陷阱</span>
          <span>2026 秋</span>
        </div>
        <span className="cover-foot__org">能源科学与技术学院</span>
      </div>
    </div>
  );
}
