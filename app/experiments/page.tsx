import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, type NavExperiment } from "@/components/app/shell";
import { Reveal } from "@/components/motion/reveal";
import { loadCatalog } from "@/lib/catalog";
import { getStudent } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "我的实验" };

function StateBadge({ playable }: { playable: boolean }) {
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
      待开放
    </span>
  );
}

export default async function CatalogPage() {
  // 未登录不许看实验列表：直接跳登录页，避免"空身份"进课堂
  const student = await getStudent();
  if (!student) redirect("/login");
  const { groups, totalHours, playable } = await loadCatalog();

  const navExperiments: NavExperiment[] = groups.flatMap((g) =>
    g.items.map((i) => ({ id: i.id, no: i.no, title: i.title, playable: i.playable, group: g.title })),
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
          <p>
            按教学进度完成 {navExperiments.length} 次实验，点击进入。
            <span className="mono"> 已开放 {playable}</span>
          </p>
        </Reveal>

        {groups.map((group, gi) => (
          <section key={group.id} className="cat-group" aria-labelledby={`g-${group.id}`}>
            <Reveal as="div" className="cat-group__head" index={0}>
              <h2 id={`g-${group.id}`}>{group.title}</h2>
              <p>{group.note}</p>
            </Reveal>
            <ol className="cat-list">
              {group.items.map((item, i) => (
                <Reveal key={item.id} as="li" index={Math.min(i, 5)} className="cat-row" data-state={item.playable ? "open" : "locked"}>
                  <Link
                    className="cat-row__link ix-lift"
                    href={item.playable ? `/exp/${item.id}` : "/experiments"}
                    aria-disabled={!item.playable}
                    data-demo-id={`demo-catalog-${item.id}`}
                  >
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
                    <StateBadge playable={item.playable} />
                  </Link>
                </Reveal>
              ))}
            </ol>
            {gi < groups.length - 1 ? <span className="cat-group__sep" aria-hidden="true" /> : null}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
