import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, type NavExperiment } from "@/components/app/shell";
import { Reveal } from "@/components/motion/reveal";
import { loadCatalog } from "@/lib/catalog";
import { hasFinishedRun } from "@/lib/queries/plan-access";
import { getStudent } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "我的实验" };

/**
 * 三个"精做"实验：交互、动效、反馈都打磨过，可以现场完整演示。
 * 其余 7 个收进"更多实验"，默认禁用 —— 与其让观众点开一个半成品，
 * 不如明确标"即将开放"（用户 2026-10-21 拍板）。
 */
const FEATURED_IDS = ["exp01", "exp03", "exp09"] as const;

/**
 * 「更多实验」里允许点进去的实验：exp08 称量练习已验收过，回退展示但仍可玩。
 * 其余保持"即将开放"（半成品点开比明确禁用更掉分）。
 */
const PLAYABLE_IN_MORE = new Set(["exp08"]);

function StateBadge({ playable, label }: { playable: boolean; label?: string }) {
  return playable ? (
    <span className="cat-state" data-kind="open">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.5 6.2 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      可进入
    </span>
  ) : (
    <span className="cat-state" data-kind="locked">
      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3.5" y="7" width="9" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {label ?? "即将开放"}
    </span>
  );
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ unlock?: string }> }) {
  // 未登录不许看实验列表：直接跳登录页，避免"空身份"进课堂
  const student = await getStudent();
  if (!student) redirect("/login");
  const { unlock } = await searchParams;
  /** ?unlock=all 给调试/演示用：跳过精做筛选，10 个全部可点 */
  const debugAll = unlock === "all";
  const { groups, totalHours } = await loadCatalog(student.studentNo, { unlockAll: debugAll });

  /**
   * 「进阶学习 · 拼接实验」入口：交卷完成过至少一个实验才可点。
   * 查库失败由 hasFinishedRun 兜底成 false —— 入口显示锁定文案，页面照样渲染。
   */
  const planUnlocked = debugAll || (await hasFinishedRun(student.studentNo));
  const planLockedHint = "做完 1 个实验后解锁";

  const allItems = groups.flatMap((g) =>
    g.items.map((item) => ({ ...item, groupId: g.id, groupTitle: g.title, unlocked: g.unlocked })),
  );

  const navExperiments: NavExperiment[] = allItems.map((i) => ({
    id: i.id,
    no: i.no,
    title: i.title,
    playable: i.playable,
    group: i.groupTitle,
  }));

  const featured = FEATURED_IDS.map((id) => allItems.find((item) => item.id === id)).filter(
    (item): item is (typeof allItems)[number] => Boolean(item),
  );
  const rest = allItems.filter((item) => !FEATURED_IDS.includes(item.id as (typeof FEATURED_IDS)[number]));

  /** 进阶学习入口的行内容：解锁与锁定共用，只有外层容器和状态标签不同 */
  const advancedBody = (
    <>
      <span className="cat-row__no mono" aria-hidden="true">
        ◆
      </span>
      <span className="cat-row__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <rect x="3" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 7.5h3a2 2 0 0 1 2 2V13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="cat-row__main">
        <span className="cat-row__title">拼接实验（拼接式方案）</span>
        <span className="cat-row__desc">自选器材、试剂与步骤，规则引擎逐条校验并评分</span>
      </span>
      <span className="cat-row__meta mono">设计 · 21 条规则</span>
      <StateBadge playable={planUnlocked} label={planLockedHint} />
    </>
  );

  return (
    <AppShell
      crumb={`课程 · 2026 秋季学期 · 共 ${navExperiments.length} 个实验 / ${totalHours} 学时`}
      experiments={navExperiments}
    >
      <div className="ix-page-enter">
        <Reveal as="div" className="cat-head" index={0}>
          <span className="cat-head__rule" aria-hidden="true" />
          <h1>我的实验</h1>
          {/* 只说状态，不复述「重点三个、做完整流程」——卡片本身就说明了 */}
          <p className="mono">已开放 {debugAll ? navExperiments.length : featured.length}</p>
        </Reveal>

        <Reveal as="section" className="cat-featured" index={1} aria-labelledby="cat-featured-head">
          <div className="cat-featured__head">
            <h2 id="cat-featured-head">重点实验</h2>
          </div>
          <ul className="cat-featured__list">
            {featured.map((item) => (
              <li key={item.id}>
                <Link
                  className="cat-card ix-lift"
                  href={`/exp/${item.id}`}
                  data-demo-id={`demo-catalog-${item.id}`}
                >
                  <span className="cat-card__thumb" aria-hidden="true">
                    <span className="cat-card__thumbNo mono">{item.no}</span>
                  </span>
                  <span className="cat-card__top">
                    <span className="cat-card__no mono">{item.no}</span>
                    <span className="cat-card__hours mono">{item.hours} 学时</span>
                  </span>
                  <span className="cat-card__title">{item.title}</span>
                  <span className="cat-card__desc">{item.desc}</span>
                  <span className="cat-card__foot">
                    <span className="mono">{item.kind}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal as="section" className="cat-featured" index={2} aria-labelledby="cat-advanced-head">
          <div className="cat-featured__head">
            <h2 id="cat-advanced-head">进阶学习</h2>
          </div>
          <ol className="cat-list">
            <li className="cat-row" data-state={planUnlocked ? "open" : "locked"}>
              {planUnlocked ? (
                <Link className="cat-row__link ix-lift" href="/plan" data-demo-id="demo-advanced-plan">
                  {advancedBody}
                </Link>
              ) : (
                <div
                  className="cat-row__link"
                  aria-disabled="true"
                  data-demo-id="demo-advanced-plan"
                  data-locked-why={planLockedHint}
                >
                  {advancedBody}
                </div>
              )}
            </li>
          </ol>
        </Reveal>

        <Reveal as="details" className="cat-more" index={3}>
          <summary className="cat-more__summary">
            <span className="cat-more__title">更多实验</span>
            <span className="cat-more__count mono">{rest.length} 个 · 即将开放</span>
            <span className="cat-more__chev" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16">
                <path d="M4 6.5 8 10.5 12 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <ol className="cat-list cat-list--more" data-locked="true">
            {rest.map((item) => {
              const open = item.playable && (debugAll || PLAYABLE_IN_MORE.has(item.id));
              const body = (
                <>
                  <span className="cat-row__no mono">{item.no}</span>
                  <span className="cat-row__icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path d="M4 18h16M6 18V9m4 9V6m4 12v-7m4 7v-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="cat-row__main">
                    <span className="cat-row__title">{item.title}</span>
                    <span className="cat-row__desc">{item.desc}</span>
                  </span>
                  <span className="cat-row__meta mono">
                    {item.hours} 学时 · {item.kind}
                  </span>
                  <StateBadge playable={open} />
                </>
              );
              return (
                <li key={item.id} className="cat-row" data-state={open ? "open" : "locked"}>
                  {open ? (
                    <Link className="cat-row__link ix-lift" href={`/exp/${item.id}`} data-demo-id={`demo-catalog-${item.id}`}>
                      {body}
                    </Link>
                  ) : (
                    <div
                      className="cat-row__link"
                      aria-disabled="true"
                      data-demo-id={`demo-catalog-${item.id}`}
                      data-locked-why="即将开放"
                    >
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </AppShell>
  );
}
