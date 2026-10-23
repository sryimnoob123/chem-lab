/**
 * 把实验主题拆成「粗粒度任务块」（2026-10-24）
 *
 * 用户口径（任务书交付二第 1 条）：选完主题，AI 把任务拆成若干块 —— **拆粗一点，不要细到每步**。
 * 所以这里只给 4 段流程（称量干燥 / 溶解定容 / 滴定终点 / 读数处理），每段一句话 + 该段该挑哪些块；
 * 不是 28 步操作清单 —— 那种清单学生照着点就行，等于替他做作业。
 *
 * 两条路径：
 *   ① `templatePhases()` 是纯函数兜底：没有模型 key 也必须能用，且永远给出同样结果（可截图、可测试）；
 *   ② 有 key 时 `POST /api/plan/decompose` 让模型**只重写段标题与一句要点**，块归属仍走模板 ——
 *      这样模型再飘也不会把「基准物」分到滴定阶段，学生看到的分组始终成立。
 */

import { PIECES, type PlanPiece } from "./pieces";
import type { PlanTopic } from "./topics";

export type PlanPhase = {
  id: string;
  /** 段标题（≤10 字） */
  title: string;
  /** 一句话：这一段要干什么 */
  note: string;
  /** 这一段该挑哪些块（顺序随意，画布上的顺序才是流程顺序） */
  pieceIds: readonly string[];
};

/** 四段流程的块归属。写死成表而不是按关键词猜：关键词一改文案就悄悄错配。 */
const PHASE_TABLE: readonly { id: string; title: string; note: string; pieceIds: readonly string[] }[] = [
  {
    id: "weigh",
    title: "称量与干燥",
    note: "基准物先干燥、冷却，再用差减法称三份。",
    pieceIds: [
      "piece-analytical-balance",
      "piece-weighing-bottle",
      "piece-desiccator",
      "piece-na2co3-primary",
      "piece-khp",
      "piece-step-weigh",
      "piece-param-drying",
    ],
  },
  {
    id: "prepare",
    title: "溶解与定容",
    note: "溶解后全量转移、洗涤三次，定容到刻度再摇匀。",
    pieceIds: [
      "piece-hcl-conc",
      "piece-cylinder-10",
      "piece-volumetric-250",
      "piece-boiled-water",
      "piece-naoh-sat",
      "piece-step-dissolve",
      "piece-step-dilute",
      "piece-step-degas",
      "piece-step-boil",
      "piece-param-conc",
      "piece-param-sample",
    ],
  },
  {
    id: "titrate",
    title: "滴定与终点",
    note: "润洗、装液、赶气泡，先快后慢，近终点半滴控制。",
    pieceIds: [
      "piece-burette-acid",
      "piece-burette-base",
      "piece-pipette-25",
      "piece-flask-250",
      "piece-phenolphthalein",
      "piece-methyl-orange",
      "piece-mixed-indicator",
      "piece-step-rinse",
      "piece-step-near-endpoint",
      "piece-step-half-drop",
      "piece-param-endpoint",
    ],
  },
  {
    id: "record",
    title: "读数与数据处理",
    note: "读数记到两位小数，平行三份、极差合格才算数。",
    pieceIds: ["piece-step-parallel", "piece-step-blank", "piece-param-parallel"],
  },
];

const TITLE_OF = new Map(PIECES.map((piece) => [piece.id, piece.title]));

/** 某一段在给定主题下实际可挑的块（按主题 featured 过滤；没给主题就全给）。 */
function pick(ids: readonly string[], featured?: readonly string[]): string[] {
  if (!featured || featured.length === 0) return [...ids];
  const set = new Set(featured);
  return ids.filter((id) => set.has(id));
}

/**
 * 模板拆解：四段流程，过滤掉本主题用不到的块。
 * 某段一块都不剩时**不返回这一段**（宁可少一段，也不要让学生看见空段）。
 */
export function templatePhases(topic?: PlanTopic): PlanPhase[] {
  return PHASE_TABLE.map((phase) => ({ ...phase, pieceIds: pick(phase.pieceIds, topic?.featured) })).filter(
    (phase) => phase.pieceIds.length > 0,
  );
}

/** 每段里具体是哪几块（UI 展开时用，标题一行就够，点开才看清单）。 */
export function phaseTitles(phase: PlanPhase): string[] {
  return phase.pieceIds.map((id) => TITLE_OF.get(id) ?? id);
}

/** 模型提示词：只要段标题 + 一句要点，不许改块归属、不许加步骤。 */
export function buildDecomposePrompt(topic: PlanTopic, phases: readonly PlanPhase[]): string {
  return [
    "你在帮大一学生做《无机及分析化学》实验的方案设计，只做一件事：把任务拆成粗粒度的几段。",
    `【主题】${topic.title}`,
    `【情境】${topic.scene}`,
    `【目标】${topic.goal}`,
    `【已有分段】${phases.map((p, i) => `${i + 1}. ${p.title}（${p.pieceIds.length} 块）`).join("；")}`,
    "【要求】",
    `1. 保持 ${phases.length} 段，只重写每段标题（不超过 10 个字）和一句要点（不超过 20 个字）；`,
    "2. 顺序不变、段数不变，不要新增或删除段，不要写具体操作步骤；",
    "3. 用学生能直接念出来的话，不要术语堆砌；",
    '4. 只输出 JSON：{"phases":[{"id":"原 id","title":"…","note":"…"}]}，不要 Markdown 代码块。',
  ].join("\n");
}

/** 解析模型输出；任何一项不合法就整份丢弃（宁可回落模板，也不要半截错标题）。 */
export function parseDecompose(raw: string, fallback: readonly PlanPhase[]): PlanPhase[] | null {
  const text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = (data as { phases?: unknown })?.phases;
  if (!Array.isArray(list) || list.length !== fallback.length) return null;
  const out: PlanPhase[] = [];
  for (const [index, item] of list.entries()) {
    const base = fallback[index];
    const title = typeof (item as { title?: unknown })?.title === "string" ? (item as { title: string }).title.trim() : "";
    const note = typeof (item as { note?: unknown })?.note === "string" ? (item as { note: string }).note.trim() : "";
    if (!title || title.length > 14 || !note || note.length > 40) return null;
    out.push({ ...base, title, note });
  }
  return out;
}

/** 仅测试用：拿一块的标题（避免测试里再 import 一份 PIECES 查找逻辑） */
export function pieceTitle(id: string): string | undefined {
  return TITLE_OF.get(id);
}

export type { PlanPiece };
