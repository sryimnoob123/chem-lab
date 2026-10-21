/**
 * 有效数字与误差（chem-model 独占文件，纯函数无 IO）
 *
 * 规则：读数按仪器最小分度估读 1/10（滴定管 0.01 mL、天平 0.0001 g、pH 0.01）；
 * 加减看小数位最少者，乘除看有效数字最少者；修约四舍六入五成双。
 * 标称浓度（如 0.1 mol/L）按平台口径至少取 3 位参与乘除，见 SIG_FIG_FAQ。
 * 非法输入（非有限数、除以 0 等）直接抛错，不返回垃圾结果。
 */

export interface ReadingSpec {
  readonly id: ReadingSpecId;
  readonly nameZh: string;
  readonly unit: "mL" | "g" | "pH" | "℃";
  readonly smallestDivision: number;
  readonly estimatedTo: number;
  readonly decimals: number;
  readonly tolerance?: number;
  readonly ref: string;
}

export type ReadingSpecId =
  | "acidBurette"
  | "alkaliBurette"
  | "analyticalBalance"
  | "platformBalance"
  | "phMeter"
  | "pipette25"
  | "volumetricFlask100"
  | "volumetricFlask250"
  | "cylinder10"
  | "cylinder100"
  | "graduatedPipette1"
  | "dropper"
  | "thermometer";

const R = (
  id: ReadingSpecId,
  nameZh: string,
  unit: ReadingSpec["unit"],
  smallestDivision: number,
  estimatedTo: number,
  decimals: number,
  ref: string,
  tolerance?: number,
): ReadingSpec => ({ id, nameZh, unit, smallestDivision, estimatedTo, decimals, ref, ...(tolerance !== undefined ? { tolerance } : {}) });

/** 各仪器的读数/记录规则，值与 docs/实验库 §4、§8 对齐。 */
export const READING_SPECS: readonly ReadingSpec[] = [
  R("acidBurette", "酸式滴定管（50 mL，0.1 mL 分度）", "mL", 0.1, 0.01, 2, "exp09 §4 器材表 / §6 K2", 0.05),
  R("alkaliBurette", "碱式滴定管（50 mL，0.1 mL 分度）", "mL", 0.1, 0.01, 2, "exp09 §4 器材表 / §6 K2", 0.05),
  R("analyticalBalance", "分析天平（感量 0.1 mg）", "g", 0.0001, 0.0001, 4, "exp01 §4 / exp10 §4", 0.0001),
  R("platformBalance", "托盘天平（感量 0.1 g）", "g", 0.1, 0.1, 1, "exp09 §4 器材表", 0.1),
  R("phMeter", "台式 pH 计（0.01 pH）", "pH", 0.01, 0.01, 2, "exp03 §4 器材表", 0.01),
  R("pipette25", "单标线移液管（25.00 mL，A 级）", "mL", 0.01, 0.01, 2, "exp09 §4 / exp01 §4", 0.03),
  R("volumetricFlask100", "容量瓶（100 mL，A 级）", "mL", 0.1, 0.1, 1, "exp01 §4 器材表", 0.1),
  R("volumetricFlask250", "容量瓶（250 mL，A 级）", "mL", 0.1, 0.1, 1, "exp10 §4 器材表", 0.15),
  R("cylinder10", "量筒（10 mL，0.1 mL 分度）", "mL", 0.1, 0.1, 1, "exp01 §4 / exp09 §4", 0.1),
  R("cylinder100", "量筒（100 mL，1 mL 分度）", "mL", 1, 0.1, 1, "exp01 §4 器材表", 1),
  R("graduatedPipette1", "刻度吸量管（1 mL，0.01 mL 分度）", "mL", 0.01, 0.01, 2, "exp04 §4 / exp06 §4"),
  R("dropper", "带刻度滴管（约 20 滴/mL）", "mL", 0.05, 0.01, 2, "exp04 §4 / exp06 §4"),
  R("thermometer", "温度计（0~50 ℃，0.1 ℃）", "℃", 0.1, 0.1, 1, "exp01 §4 / exp03 §4", 0.1),
];

const SPEC_BY_ID = new Map<string, ReadingSpec>(READING_SPECS.map((s) => [s.id, s]));

/** 取某仪器的读数规则；不存在抛错。 */
export function readingSpec(id: ReadingSpecId | string): ReadingSpec {
  const spec = SPEC_BY_ID.get(id);
  if (!spec) throw new Error(`未知仪器读数规则：${id}（见 lib/chem/uncertainty.ts）`);
  return spec;
}

/** 按仪器规则记录读数：修约到规定小数位并给出显示串（如滴定管 24.84 → "24.84"）。 */
export function recordReading(id: ReadingSpecId | string, value: number): { value: number; display: string; decimals: number } {
  const spec = readingSpec(id);
  const rounded = roundHalfEven(value, spec.decimals);
  return { value: rounded, display: rounded.toFixed(spec.decimals), decimals: spec.decimals };
}

function assertFiniteNumber(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} 必须是有限数字，收到：${String(value)}`);
  }
}

function toNumber(value: number | string, label: string): number {
  if (typeof value === "number") {
    assertFiniteNumber(value, label);
    return value;
  }
  const s = value.trim();
  if (s === "" || !/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
    throw new TypeError(`${label} 不是合法数值：${JSON.stringify(value)}`);
  }
  const n = Number(s);
  assertFiniteNumber(n, label);
  return n;
}

/** 有效数字位数。字符串输入保留末尾 0（"25.00" → 4，"0.10" → 2）；数字输入按 JS 最短表示计。 */
export function countSigFigs(value: number | string): number {
  let s = typeof value === "number" ? String(value) : value.trim();
  assertFiniteNumber(Number(s), "countSigFigs 的输入");
  s = s.replace(/^[+-]/, "");
  const eIdx = s.search(/[eE]/);
  if (eIdx >= 0) s = s.slice(0, eIdx);
  const digits = s.replace(".", "").replace(/^0+/, "");
  return digits.length === 0 ? 1 : digits.length;
}

/** 小数位数（"0.10" → 2；"25" → 0；"1.5e-3" → 4）。 */
export function decimalsOf(value: number | string): number {
  const s = typeof value === "number" ? String(value) : value.trim();
  assertFiniteNumber(Number(s), "decimalsOf 的输入");
  const expMatch = /[eE]([+-]?\d+)/.exec(s);
  const exp = expMatch?.[1] !== undefined ? Number(expMatch[1]) : 0;
  const dot = s.indexOf(".");
  const eIdx = s.search(/[eE]/);
  const fraction = dot >= 0 ? (eIdx >= 0 ? eIdx : s.length) - dot - 1 : 0;
  return Math.max(0, fraction - exp);
}

/**
 * 四舍六入五成双（half-to-even）修约到指定小数位。
 * `decimals` 可为负数（按十位/百位修约）。用十进制指数串做位运算，避免 1.005 这类
 * 二进制误差导致的"该舍的进了、该进的舍了"。
 */
export function roundHalfEven(value: number, decimals: number): number {
  assertFiniteNumber(value, "roundHalfEven 的 value");
  if (!Number.isInteger(decimals)) throw new TypeError("decimals 必须是整数");
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const [mantissaRaw, expRaw] = abs.toExponential(20).split("e");
  if (mantissaRaw === undefined || expRaw === undefined) return value;
  const exp = Number(expRaw);
  const digits = mantissaRaw.replace(".", "");
  const keep = exp + decimals + 1;

  if (keep >= digits.length) return value; // 精度足够，无需修约
  const kept = keep > 0 ? digits.slice(0, keep) : "";
  const nextDigit = digits[Math.max(0, keep)] ?? "0";
  const tail = digits.slice(Math.max(0, keep) + 1);

  let roundUp: boolean;
  if (nextDigit > "5") roundUp = true;
  else if (nextDigit < "5") roundUp = false;
  else if (tail.replace(/0/g, "") !== "") roundUp = true; // 五后非零，进一
  else {
    const lastKept = kept.length > 0 ? Number(kept[kept.length - 1]) : 0;
    roundUp = lastKept % 2 === 1; // 五后全零：末位为奇则进，为偶则舍
  }

  let keptInt = kept === "" ? 0 : Number(kept);
  if (roundUp) keptInt += 1;
  const unit = 10 ** -decimals;
  const result = sign * keptInt * unit;
  return Object.is(result, -0) ? 0 : result;
}

/** 修约到指定有效数字位数。 */
export function roundToSigFigs(value: number, sigFigs: number): number {
  assertFiniteNumber(value, "roundToSigFigs 的 value");
  if (!Number.isInteger(sigFigs) || sigFigs < 1) throw new TypeError("sigFigs 必须是 ≥1 的整数");
  if (value === 0) return 0;
  const exp = Math.floor(Math.log10(Math.abs(value)) + 1e-12);
  return roundHalfEven(value, sigFigs - 1 - exp);
}

/** 修约后按固定小数位显示（内部先 half-even 再 toFixed）。 */
export function formatFixed(value: number, decimals: number): string {
  return roundHalfEven(value, decimals).toFixed(decimals);
}

/** 修约到指定有效数字并显示（如 0.1008 取 3 位 → "0.101"）。 */
export function formatSigFigs(value: number, sigFigs: number): string {
  const rounded = roundToSigFigs(value, sigFigs);
  if (rounded === 0) return (0).toFixed(sigFigs - 1);
  const exp = Math.floor(Math.log10(Math.abs(rounded)) + 1e-12);
  if (exp >= 21 || exp <= -7) return rounded.toExponential(sigFigs - 1);
  const decimals = Math.max(0, sigFigs - 1 - exp);
  return rounded.toFixed(decimals);
}

export interface AddSubResult {
  readonly value: number;
  readonly decimals: number;
  readonly display: string;
}

/** 加减法：结果小数位取各量最少者。字符串入参保留末尾 0（推荐用于原始读数）。 */
export function addSub(values: readonly (number | string)[]): AddSubResult {
  if (values.length === 0) throw new TypeError("addSub 至少需要一个数值");
  const nums = values.map((v, i) => toNumber(v, `addSub 第 ${i + 1} 项`));
  const decimals = Math.min(...values.map((v) => decimalsOf(v)));
  const sum = nums.reduce((a, b) => a + b, 0);
  const rounded = roundHalfEven(sum, decimals);
  return { value: rounded, decimals, display: rounded.toFixed(decimals) };
}
export interface MultiplyResult {
  readonly value: number;
  readonly significantFigures: number;
  readonly display: string;
}

export interface MultiplyOptions {
  /** 作为除数参与运算的量（如 c = m / (M·V) 里的 M、V），位数一并参与取最少 */
  readonly divideBy?: readonly (number | string)[];
}

/**
 * 乘除（严格按字面位数）：先求 `values` 之积，再除以 `divideBy` 之积；
 * 结果有效数字取所有参与量中最少者。
 */
export function multiplyDivide(values: readonly (number | string)[], options: MultiplyOptions = {}): MultiplyResult {
  if (values.length === 0) throw new TypeError("multiplyDivide 至少需要一个数值");
  const divisors = options.divideBy ?? [];
  const all = [...values, ...divisors];
  const sigFigs = Math.min(...all.map((v) => countSigFigs(v)));
  const numerator = values.reduce<number>((acc, v) => acc * toNumber(v, "multiplyDivide 因子"), 1);
  const denominator = divisors.reduce<number>((acc, v) => acc * toNumber(v, "multiplyDivide 除数"), 1);
  if (denominator === 0) throw new RangeError("multiplyDivide 的除数不能为 0");
  const rounded = roundToSigFigs(numerator / denominator, sigFigs);
  return { value: rounded, significantFigures: sigFigs, display: formatSigFigs(rounded, sigFigs) };
}

export interface MeasuredValue {
  readonly value: number | string;
  /** nominal-concentration：标称浓度（如 0.1 mol/L），按 ≥3 位参与乘除；默认 measured */
  readonly kind?: "measured" | "nominal-concentration";
  readonly label?: string;
}

/**
 * 乘除（平台口径）：在严格规则上为"标称浓度"保留至少 3 位有效数字。
 * 见文件头规则 5 与 SIG_FIG_FAQ 的算例与依据。
 */
export function multiplyDivideByRule(values: readonly MeasuredValue[]): MultiplyResult & { readonly rule: string } {
  if (values.length === 0) throw new TypeError("multiplyDivideByRule 至少需要一个数值");
  const nums = values.map((v, i) => toNumber(v.value, `multiplyDivideByRule 第 ${i + 1} 项`));
  const sigFigs = Math.min(...values.map((v) => {
    const written = countSigFigs(v.value);
    return v.kind === "nominal-concentration" ? Math.max(written, 3) : written;
  }));
  const product = nums.reduce((a, b) => a * b, 1);
  const rounded = roundToSigFigs(product, sigFigs);
  return {
    value: rounded,
    significantFigures: sigFigs,
    display: formatSigFigs(rounded, sigFigs),
    rule: "乘除按有效数字最少者；标称浓度按平台口径至少取 3 位（0.1 → 0.100）",
  };
}

/** 相对误差（%）：|测得值 − 参考值| / |参考值| × 100。 */
export function relativeError(measured: number, reference: number): number {
  assertFiniteNumber(measured, "relativeError 的 measured");
  assertFiniteNumber(reference, "relativeError 的 reference");
  if (reference === 0) throw new RangeError("relativeError 的参考值不能为 0");
  return (Math.abs(measured - reference) / Math.abs(reference)) * 100;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 相对极差（%）：(Vmax − Vmin) / V平均 × 100，用于滴定三次平行（exp09 §3）。 */
export function relativeRange(values: readonly number[]): number {
  if (values.length < 2) throw new RangeError("相对极差至少需要 2 个平行值");
  values.forEach((v, i) => assertFiniteNumber(v, `relativeRange 第 ${i + 1} 项`));
  const avg = mean(values);
  if (avg === 0) throw new RangeError("相对极差的分母（平均值）不能为 0");
  return ((Math.max(...values) - Math.min(...values)) / Math.abs(avg)) * 100;
}

/** 相对平均偏差（%）：(Σ|di| / n) / x̄ × 100，用于标定/称量平行性（exp08 §3、exp10 §10）。 */
export function relativeMeanDeviation(values: readonly number[]): number {
  if (values.length < 1) throw new RangeError("相对平均偏差至少需要 1 个值");
  values.forEach((v, i) => assertFiniteNumber(v, `relativeMeanDeviation 第 ${i + 1} 项`));
  const avg = mean(values);
  if (avg === 0) throw new RangeError("相对平均偏差的分母（平均值）不能为 0");
  const dev = values.reduce((acc, v) => acc + Math.abs(v - avg), 0) / values.length;
  return (dev / Math.abs(avg)) * 100;
}

/** 最小称样量 m_min = 2d / Er（d 感量 g，Er 允许相对误差用百分数，如 0.1 表示 0.1%）。 */
export function minSampleMass(sense: number, allowedRelativeErrorPercent: number): number {
  assertFiniteNumber(sense, "minSampleMass 的感量");
  assertFiniteNumber(allowedRelativeErrorPercent, "minSampleMass 的允许相对误差");
  if (sense <= 0) throw new RangeError("感量必须 > 0");
  if (allowedRelativeErrorPercent <= 0) throw new RangeError("允许相对误差必须 > 0");
  return (2 * sense) / (allowedRelativeErrorPercent / 100);
}

/** 百分比显示（默认 2 位小数）。 */
export function formatPercent(value: number, decimals = 2): string {
  return `${formatFixed(value, decimals)}%`;
}

export { SIG_FIG_FAQ, getSigFigFaq, type SigFigFaqItem } from "./sig-fig-faq";
