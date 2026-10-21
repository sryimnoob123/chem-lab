import Link from "next/link";
import { DemoStage } from "@/components/demo/stage";
import { DEMO_SCRIPTS } from "@/lib/demo/scripts";

export const metadata = { title: "演示模式" };

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ autoplay?: string }>;
}) {
  const sp = await searchParams;
  const autoplay = sp.autoplay === "1" || sp.autoplay === "true";
  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand__mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/henan-university-emblem.png" alt="河南大学校徽" width={32} height={32} />
          </span>
          <span className="brand__name">河南大学</span>
          <span className="brand__rule" aria-hidden="true" />
          <span className="brand__course">演示模式</span>
        </div>
        <nav className="header-nav" aria-label="主导航">
          <Link href="/">首页</Link>
          <Link href="/demo" aria-current="page">
            演示
          </Link>
          <Link href="/teacher">教师端</Link>
        </nav>
      </header>

      <main>
        <DemoStage scripts={DEMO_SCRIPTS} autoplay={autoplay} />
      </main>
    </div>
  );
}
