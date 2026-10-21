/**
 * 能力点雷达的数据口径（纯函数，可在 node 下直接单测）。
 *
 * 五个维度固定来自 Lead 钉的编码：K1 K2 A1 S1 S2（K=知识 / S=技能 / A=素养）。
 *
 * 口径（与 Lead 2026-10-21 确认一致）：
 * - 输入是「能力码 → 0~100 掌握度」的字典（教师端查询侧的既有口径）；
 * - 缺维**补 0**，但必须用 `hasData: false` 标出「暂无数据」——
 *   0 分不代表学生差，只代表还没有该能力码的记录，画图与图例都要区分；
 * - 多条记录求均分时，**每维分母只算有该能力码记录的样本**（没记录的样本不进分母）。
 */

export const RADAR_DIMENSIONS = [
  { code: "K1", category: "知识" },
  { code: "K2", category: "知识" },
  { code: "A1", category: "素养" },
  { code: "S1", category: "技能" },
  { code: "S2", category: "技能" },
] as const;

export type RadarDimCode = (typeof RADAR_DIMENSIONS)[number]["code"];

export type RadarDim = {
  code: string;
  category: string;
  /** 0~100 */
  value: number;
  /** 该维是否有记录；false 时 value 一定是 0，UI 要标「暂无数据」 */
  hasData: boolean;
};

export type RadarSeries = {
  dims: RadarDim[];
  /** 参与统计的样本数（班级=有数据的实验记录数，学生=该生 run 数） */
  sampleCount: number;
  /** 五维里至少一维有数据 */
  hasData: boolean;
};

/** 0~100 夹紧；非数值一律按 0（外部数据脏时不 NaN）。 */
export function clampPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function hasFiniteValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 单个样本（一个学生 / 一次 run）→ 五维序列。缺维补 0 并标记 hasData=false。 */
export function radarSeriesFromCompetency(
  competency: Readonly<Record<string, number>> | null | undefined,
  sampleCount = 1,
): RadarSeries {
  const source = competency ?? {};
  let anyData = false;

  const dims: RadarDim[] = RADAR_DIMENSIONS.map(({ code, category }) => {
    const raw = source[code];
    const hasData = hasFiniteValue(raw);
    if (hasData) anyData = true;
    return { code, category, value: hasData ? clampPercent(raw) : 0, hasData };
  });

  return { dims, sampleCount: anyData ? sampleCount : 0, hasData: anyData };
}

/**
 * 用「真实有记录的能力码集合」修正序列的 hasData。
 *
 * 为什么需要：data-api 的 `StudentDetail.competency` 在没有记录时会把实验定义里的
 * 能力码补成 0 占位，那种 0 不是「掌握度 0」，而是「还没有记录」；
 * 这里用 timeline / incidents 里真实出现过的码把占位 0 标成「暂无数据」。
 * 不在集合里的维度会被清零（占位值本来就是 0，清零只是保证口径一致）。
 */
export function restrictRadarToRecordedCodes(
  series: RadarSeries,
  recordedCodes: ReadonlySet<string>,
): RadarSeries {
  const dims = series.dims.map((dim) =>
    recordedCodes.has(dim.code)
      ? { ...dim, hasData: true }
      : { ...dim, value: 0, hasData: false },
  );
  return {
    dims,
    sampleCount: series.sampleCount,
    hasData: dims.some((dim) => dim.hasData),
  };
}

/**
 * 多条样本求均分。
 * 每维只除以「有该维记录」的样本数；某维样本为 0 时 value=0、hasData=false。
 */
export function averageRadarSeries(
  samples: ReadonlyArray<Readonly<Record<string, number>>>,
): RadarSeries {
  const dims: RadarDim[] = RADAR_DIMENSIONS.map(({ code, category }) => {
    let sum = 0;
    let counted = 0;
    for (const sample of samples) {
      const raw = sample[code];
      if (!hasFiniteValue(raw)) continue;
      sum += clampPercent(raw);
      counted += 1;
    }
    return {
      code,
      category,
      value: counted === 0 ? 0 : Math.round(sum / counted),
      hasData: counted > 0,
    };
  });

  return {
    dims,
    sampleCount: samples.length,
    hasData: dims.some((dim) => dim.hasData),
  };
}
