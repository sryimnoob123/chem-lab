/**
 * 8 个事故特效的纯数据映射（asset-pipeline 独占）
 *
 * 只放 key / 组件名 / 中文名 / demo-id / 时长 / 语义色 / 处置提示，
 * 不放 JSX——这样 `lib/scene/fx-keys.test.ts` 能在 node 环境直接断言，
 * 预览页与演示脚本也只消费这张表。
 */

export type FxKey =
  | "explosion"
  | "toxicGas"
  | "fire"
  | "boilOver"
  | "burn"
  | "glassBreak"
  | "heavyMetal"
  | "deviceAccident";

export type FxSemantic = "danger" | "warn" | "oxid" | "toxic";

export type FxMeta = {
  key: FxKey;
  /** React 组件名（components/exp/scene/fx/<component>.tsx）。 */
  component: string;
  /** 中文事故名（角标 + aria-label）。 */
  label: string;
  /** 一句话语义：这是哪种事故、教科书里对应什么。 */
  hint: string;
  /** 演示/截图定位：data-demo-id 就是它。 */
  demoId: string;
  /** 一次性特效时长；0 表示循环（如酒精灯火焰）。 */
  durationMs: number;
  loop: boolean;
  semantic: FxSemantic;
};

export const FX_LIST: readonly FxMeta[] = [
  {
    key: "explosion",
    component: "FxExplosion",
    label: "装置爆炸",
    hint: "银氨溶液加热蒸干、密闭体系超压、强氧化剂与有机物混放——玻璃碎片向四周飞散，必须立即离开台面。",
    demoId: "demo-fx-explosion",
    durationMs: 1400,
    loop: false,
    semantic: "danger",
  },
  {
    key: "toxicGas",
    component: "FxToxicGas",
    label: "有毒气体",
    hint: "Cl₂ / SO₂ / H₂S 逸出：黄绿色雾团从器口涌出，必须立即开通风橱、屏息撤离、报告教师。",
    demoId: "demo-fx-toxic-gas",
    durationMs: 2000,
    loop: false,
    semantic: "toxic",
  },
  {
    key: "fire",
    component: "FxFire",
    label: "起火",
    hint: "酒精灯翻倒、有机溶剂靠近明火：橙黄焰舌抖动并向上蔓延，用湿布或沙土盖灭，禁止用水冲有机溶剂。",
    demoId: "demo-fx-fire",
    durationMs: 0,
    loop: true,
    semantic: "danger",
  },
  {
    key: "boilOver",
    component: "FxBoilOver",
    label: "暴沸溢出",
    hint: "水入浓酸、局部过热、未加沸石：液体沿器壁冲出并带出酸雾，是 exp09 的 L4 事故。",
    demoId: "demo-fx-boil-over",
    durationMs: 1800,
    loop: false,
    semantic: "warn",
  },
  {
    key: "burn",
    component: "FxBurn",
    label: "化学灼伤",
    hint: "浓酸/浓碱/NaOH 固体接触皮肤：局部蛋白变性并持续向深层渗透，大量流水冲洗 15 min 以上。",
    demoId: "demo-fx-burn",
    durationMs: 1200,
    loop: false,
    semantic: "danger",
  },
  {
    key: "glassBreak",
    component: "FxGlassBreak",
    label: "器皿破裂",
    hint: "受热不均、强行拧磨口、夹持不稳：裂纹从撞击点放射，碎片与试液飞溅，先清碎片再处理试液。",
    demoId: "demo-fx-glass-break",
    durationMs: 1200,
    loop: false,
    semantic: "warn",
  },
  {
    key: "heavyMetal",
    component: "FxHeavyMetal",
    label: "重金属污染",
    hint: "含 Pb²⁺/Hg²⁺/Cu²⁺/Cr(Ⅵ) 废液倒入水槽：水体被持续污染，必须倒入重金属废液桶集中回收。",
    demoId: "demo-fx-heavy-metal",
    durationMs: 2000,
    loop: false,
    semantic: "toxic",
  },
  {
    key: "deviceAccident",
    component: "FxDeviceAccident",
    label: "仪器损坏",
    hint: "天平超载、滴定管跌落、仪器进液：屏幕爆错并冒火花，须断电、登记、报修，不得自行拆修。",
    demoId: "demo-fx-device-accident",
    durationMs: 1500,
    loop: false,
    semantic: "danger",
  },
];

const BY_KEY = new Map<FxKey, FxMeta>(FX_LIST.map((fx) => [fx.key, fx]));

export function getFx(key: FxKey): FxMeta {
  const found = BY_KEY.get(key);
  if (!found) throw new Error(`未知事故特效：${key}`);
  return found;
}

/** 语义色 → CSS 变量名（契约 §2）。 */
export const FX_SEMANTIC_VAR: Readonly<Record<FxSemantic, string>> = {
  danger: "var(--danger)",
  warn: "var(--warn)",
  oxid: "var(--oxid)",
  toxic: "var(--toxic)",
};
