import { db } from "@/lib/db";
import { experiments as experimentsTable } from "@/db/schema";

export type CatalogItem = {
  id: string;
  no: string;
  title: string;
  desc: string;
  hours: number;
  kind: "验证" | "综合" | "设计";
  playable: boolean;
};

export type CatalogGroup = {
  id: string;
  title: string;
  note: string;
  items: CatalogItem[];
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

export async function loadCatalog(): Promise<{ groups: CatalogGroup[]; totalHours: number; playable: number }> {
  const byId = new Map<string, boolean>();
  try {
    const found = await db
      .select({ id: experimentsTable.id, playable: experimentsTable.playable })
      .from(experimentsTable);
    for (const r of found) byId.set(r.id, r.playable);
  } catch {
    // 库没起来就退回大纲底表，页面不能因此挂掉
  }

  const items = CATALOG.map((c) => ({
    ...c,
    // 静态清单里明确开放的实验，不能被旧库里的 playable=false 反向关掉；
    // 旧库只作为“额外开放”的来源。否则 seed 早于定义上线时会表现为“页面 200 但 0 个选项”。
    playable: c.playable || (byId.get(c.id) ?? false),
  }));
  const groups = GROUP_SPEC.map((g) => {
    const groupItems = g.ids
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is CatalogItem => Boolean(i))
      .sort((a, b) => a.no.localeCompare(b.no));
    return { id: g.id, title: g.title, note: g.note, items: groupItems };
  });

  return {
    groups,
    totalHours: items.reduce((sum, i) => sum + i.hours, 0),
    playable: items.filter((i) => i.playable).length,
  };
}
