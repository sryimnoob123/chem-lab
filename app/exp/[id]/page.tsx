import Link from "next/link";
import { notFound } from "next/navigation";
import { getDefinition } from "@/lib/engine";
import { loadCatalog } from "@/lib/catalog";
import { BopbpsGate } from "@/components/exp/bopbps-gate";
import { Workbench } from "./workbench";

type ExperimentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** 暂未开放 / 不存在的实验：给一页能看懂、能回去的说明，而不是 404 空壳 */
function LockedOrMissing({ id, title, playable }: { id: string; title?: string; playable: boolean }) {
  return (
    <div className="ix-page-enter page" style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(48px,10vh,120px) 24px" }}>
      <div className="mono" style={{ fontSize: 12, letterSpacing: ".12em", opacity: 0.55 }}>
        {id.toUpperCase()}
      </div>
      <h1 style={{ fontSize: 26, margin: "10px 0 6px" }}>{title ?? "找不到这个实验"}</h1>
      <p style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.75, margin: "0 0 8px" }}>
        {playable
          ? "这个实验的操作台还在接通中，先把实验 09 走一遍。"
          : "它不在本次开放的实验范围内。实验按教学进度逐个开放，开放后会在实验列表里标为「可进入」。"}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.8, opacity: 0.55, margin: "0 0 24px" }}>
        已开放的实验可以直接从实验列表进入；遇到问题可联系任课教师。
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Link className="btn btn--primary" href="/experiments">
          返回实验列表
        </Link>
        <Link className="btn btn--secondary" href="/exp/exp09">
          打开实验 09（已开放）
        </Link>
      </div>
    </div>
  );
}

export default async function ExperimentPage({ params, searchParams }: ExperimentPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const definition = getDefinition(id);
  if (!definition) {
    // 定义不存在（如 /exp/exp99）：给说明页；只有完全非实验的路径才 404
    if (!/^exp\d{2}$/.test(id)) notFound();
    return <LockedOrMissing id={id} playable={false} />;
  }

  // 定义存在但不在本轮开放清单：给"暂未开放"页，不白屏。
  // `?force=1` 是本地联调入口：只绕过页面门禁，不改 catalog 的 playable。
  const force = query.force === "1" || query.force === "true";
  const catalog = await loadCatalog();
  const item = catalog.groups.flatMap((g) => g.items).find((i) => i.id === id);
  if (!item?.playable && !force) {
    return <LockedOrMissing id={id} title={definition.title} playable />;
  }

  const demoReagent = typeof query.reagent === "string" ? query.reagent : undefined;
  const demoVessel = typeof query.vessel === "string" ? query.vessel : undefined;
  const demo = query.demo === "1" || query.demo === "true";
  const playDemo = query.play === "demo";

  return (
    <BopbpsGate expId={id} bypass={demo || playDemo || force}>
      {/* data-exp 给整页提供 --exp-accent（器皿内侧亮边 / 液面 / 任务看板强调色）。
          display:contents 不产生盒子，不影响既有布局与热区。 */}
      <div data-exp={id} style={{ display: "contents" }}>
        <Workbench
          expId={id}
          demoReagent={demo ? demoReagent : undefined}
          demoVessel={demo ? demoVessel : undefined}
          demoReadonly={playDemo}
        />
      </div>
    </BopbpsGate>
  );
}
