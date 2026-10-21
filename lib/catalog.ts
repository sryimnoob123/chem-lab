import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { experiments as experimentsTable, runs as runsTable } from "@/db/schema";

export type CatalogItem = {
  id: string;
  no: string;
  title: string;
  desc: string;
  hours: number;
  kind: "验证" | "综合" | "设计";
  playable: boolean;
  /** 该生是否已完成（status=finished 且总分达标） */
  completed?: boolean;
  /** 该生该实验的最高总分（没做过为 null） */
  bestScore?: number | null;
};

export type CatalogGroup = {
  id: string;
  title: string;
  note: string;
  items: CatalogItem[];
  /** 该档是否已解锁（g1 恒 true，后续档需前一档全部完成） */
  unlocked: boolean;
  /** 未解锁时给学生的提示，已解锁为空串 */
  unlockHint: string;
  /** 本档已完成实验数 / 总数 */
  done: number;
  total: number;
};

/** 大纲口径：10 个实验 / 36 学时 / 验证 7 · 综合 2 · 设计 1 */
const CATALOG: CatalogItem[] = [
  { id: "exp01", no: "01", title: "仪器的认领、天平使用及溶液配制", desc: "洗涤、称量、定容、浓硫酸稀释", hours: 5, kind: "验证", playable: true },
  { id: "exp02", no: "02", title: "试剂级氯化钠制备", desc: "除杂、过滤、蒸发结晶、算产率", hours: 5, kind: "验证", playable: true },
  { id: "exp08", no: "08", title: "清点仪器，分析天平称量练习", desc: "固定质量称量、递减法、记录规范", hours: 3, kind: "验证", playable: true },
  { id: "exp03", no: "03", title: "醋酸电离度和电离常数测定", desc: "系列稀释、pH 计、Ka 计算", hours: 3, kind: "验证", playable: true },
  { id: "exp04", no: "04", title: "沉淀的生成与溶解平衡", desc: "沉淀制备、离心、分步沉淀、转化", hours: 4, kind: "综合", playable: true },
  { id: "exp05", no: "05", title: "氧化还原反应和电化学", desc: "原电池、盐桥、电动势测定", hours: 3, kind: "验证", playable: true },
  { id: "exp06", no: "06", title: "配合物的生成和性质", desc: "配位平衡、螯合物、稳定性比较", hours: 3, kind: "综合", playable: true },
  { id: "exp07", no: "07", title: "常见阳离子的分离与鉴定（一）", desc: "特征反应、分组分离、排除干扰", hours: 4, kind: "验证", playable: true },
  { id: "exp09", no: "09", title: "酸碱标准溶液的配制与浓度比较", desc: "滴定管洗涤润洗、半滴操作、终点判定", hours: 3, kind: "验证", playable: true },
  { id: "exp10", no: "10", title: "盐酸标准溶液的标定与工业纯碱总碱度的测定", desc: "基准物质标定、双指示剂法测总碱度", hours: 3, kind: "设计", playable: true },
];

export const GROUP_SPEC: Array<{ id: string; title: string; note: string; ids: string[] }> = [
  { id: "g1", title: "基础操作与制备", note: "先把手上的功夫练对：洗涤、称量、定容、结晶", ids: ["exp01", "exp02", "exp08"] },
  { id: "g2", title: "化学平衡与离子鉴定", note: "用平衡移动解释你看到的现象", ids: ["exp03", "exp04", "exp05", "exp06", "exp07"] },
  { id: "g3", title: "定量分析", note: "滴定分析：读数、半滴、终点与误差", ids: ["exp09", "exp10"] },
];

/** 该档解锁所需的单实验最低总分（低于它算"做过但没做好"，不解锁下一档） */
export const UNLOCK_PASS_SCORE = 60;

/**
 * 纯函数：按每个实验的完成情况算出每档是否解锁。
 * 规则：g1 恒解锁；后面每档要求**前一档全部实验** completed（finished 且总分 ≥ UNLOCK_PASS_SCORE）。
 * 抽出来是为了能单测，不用起数据库。
 */
export function buildGroups(items: CatalogItem[], unlockAll = false): CatalogGroup[] {
  let previousDone = true; // g1 恒解锁
  let prevDone = 0;
  let prevTotal = 0;
  return GROUP_SPEC.map((g, gi) => {
    const groupItems = g.ids
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is CatalogItem => Boolean(i))
      .sort((a, b) => a.no.localeCompare(b.no));

    const total = groupItems.length;
    const done = groupItems.filter((i) => i.completed).length;
    const unlocked = unlockAll || previousDone;
    const prevTitle = gi > 0 ? GROUP_SPEC[gi - 1].title : "";
    // 锁住时提示的是**前一档**的进度（"还差几个"指的是上一档）
    const unlockHint = unlocked
      ? ""
      : `完成「${prevTitle}」${prevTotal} 个实验且总分 ≥ ${UNLOCK_PASS_SCORE} 后解锁（已 ${prevDone}/${prevTotal}）`;

    prevDone = done;
    prevTotal = total;
    // 下一档是否解锁：本档全部完成（且本档本身已解锁）
    previousDone = unlocked && done === total;

    return { id: g.id, title: g.title, note: g.note, items: groupItems, unlocked, unlockHint, done, total };
  });
}

export async function loadCatalog(
  studentNo?: string,
  options: { unlockAll?: boolean } = {},
): Promise<{ groups: CatalogGroup[]; totalHours: number; playable: number }> {
  const byId = new Map<string, boolean>();
  try {
    const found = await db
      .select({ id: experimentsTable.id, playable: experimentsTable.playable })
      .from(experimentsTable);
    for (const r of found) byId.set(r.id, r.playable);
  } catch {
    // 库没起来就退回大纲底表，页面不能因此挂掉
  }

  // 该生的进度：每个实验是否完成（finished 且总分 ≥ UNLOCK_PASS_SCORE）与最高分
  const progress = new Map<string, { finished: boolean; best: number | null }>();
  if (studentNo) {
    try {
      const rows = await db
        .select({ id: runsTable.experimentId, status: runsTable.status, score: runsTable.totalScore })
        .from(runsTable)
        .where(eq(runsTable.studentNo, studentNo));
      for (const r of rows) {
        const prev = progress.get(r.id) ?? { finished: false, best: null };
        const best = r.score != null ? Math.max(r.score, prev.best ?? 0) : prev.best;
        progress.set(r.id, { finished: prev.finished || r.status === "finished", best });
      }
    } catch {
      // 查不到进度就当作没进度，不影响页面渲染
    }
  }

  const items: CatalogItem[] = CATALOG.map((c) => {
    const p = progress.get(c.id);
    const completed = Boolean(p?.finished && (p?.best ?? 0) >= UNLOCK_PASS_SCORE);
    return {
      ...c,
      // 静态清单里明确开放的实验，不能被旧库里的 playable=false 反向关掉；
      // 旧库只作为"额外开放"的来源。否则 seed 早于定义上线时会表现为"页面 200 但 0 个选项"。
      playable: c.playable || (byId.get(c.id) ?? false),
      completed,
      bestScore: p?.best ?? null,
    };
  });

  const groups = buildGroups(items, Boolean(options.unlockAll));

  return {
    groups,
    totalHours: items.reduce((sum, i) => sum + i.hours, 0),
    playable: items.filter((i) => i.playable).length,
  };
}
