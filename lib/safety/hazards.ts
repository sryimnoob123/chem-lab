/**
 * 规范条目库（hazard library）
 *
 * 唯一权威编号源。事故的 `refs` 只能引用这里的 id，单测强制校验。
 * 口径：以 `docs/实验库/exp09.md` §5 的 S001~S009 为**已定稿编号**（实验 9 规格），
 * S010 起是跨实验通用条目，供 exp01~exp10 复用；每条都标 `【待老师核】`，老师改口径只改这一处。
 *
 * 已知冲突（其它实验规格文档早期自拟编号与本库不一致，例如 exp03 把「通风橱」写成 S005、
 * exp08 把「天平」写成 S003）：以本库为准，由 Lead 统一回填各 definition 的 refs。
 */

/** 条目域，仅用于检索/分组，不参与判分 */
export type HazardDomain =
  | "discipline" // 守则与预习
  | "glassware" // 玻璃器皿
  | "corrosive" // 腐蚀性试剂
  | "titration" // 滴定操作
  | "heating" // 加热与暴沸
  | "instrument" // 仪器设备
  | "hazardous" // 剧毒/爆炸性试剂
  | "waste" // 废液与废弃物
  | "electrical" // 用电
  | "report"; // 事故报告

export interface HazardItem {
  /** S001…，全库唯一，永不复用 */
  id: string;
  title: string;
  /** 「要求」：可直接印在规范卡上的一条硬要求 */
  requirement: string;
  /** 适用场景（实验 id 或操作场景关键词），供 UI 过滤与教师端统计 */
  scenes: string[];
  /** 来源口径提示：教材章节 / 学院守则 / GHS / 国标 */
  source: string;
  domain: HazardDomain;
  /** 老师可改；保留字段是为了让「待核」可被检索出来 */
  review: "【待老师核】";
}

const TODO = "【待老师核】" as const;

export const HAZARDS: readonly HazardItem[] = [
  {
    id: "S001",
    title: "实验室安全守则与预习",
    requirement:
      "进实验室必须穿实验服、戴护目镜、长发束起，禁穿露趾鞋、禁食禁饮；操作前完成风险评估与预习；离场关水、关电、关气。严禁篡改或事后描改原始数据。",
    scenes: ["全部实验", "进实验室", "原始记录"],
    source: "学院《实验室安全守则》；《无机及分析化学实验》绪论·实验室规则" + TODO,
    domain: "discipline", review: TODO,
  },
  {
    id: "S002",
    title: "玻璃器皿外观检查与破损处置",
    requirement:
      "用前逐件对光检查管壁、瓶底、磨口、尖嘴有无裂纹与缺口；破损件立即弃用并登记，碎片投入专用玻璃废物桶，不得混入生活垃圾或水槽。",
    scenes: ["玻璃器皿", "实验 9 步3 滴定管检漏", "离心管", "容量瓶"],
    source: "《无机及分析化学实验》滴定分析基本操作·仪器准备" + TODO,
    domain: "glassware", review: TODO,
  },
  {
    id: "S003",
    title: "腐蚀性试剂的取用与配制",
    requirement:
      "戴丁腈手套、护目镜，在通风橱内取用；固体用专用药匙、不用纸称碱；稀释一律「酸入水、沿壁、缓缓、边加边搅拌、必要时冷却」；皮肤溅到立即大量流水冲洗 ≥15 min 并报告，不得用碱/酸互相中和。",
    scenes: ["浓盐酸", "浓硫酸", "NaOH", "冰醋酸", "稀释配液", "实验 9 步1 步2"],
    source: "GHS05 腐蚀性标识要求；《无机及分析化学实验》试剂取用与溶液配制" + TODO,
    domain: "corrosive", review: TODO,
  },
  {
    id: "S004",
    title: "滴定管的洗涤、润洗、装液与调零",
    requirement:
      "洗洁精刷洗→自来水冲净→蒸馏水淋洗 3 次→待装液润洗 3 次（每次约 5 mL，转动全润湿后由尖嘴放出）；不用自来水直接装液、不烘烤滴定管；碱液只用碱式（橡胶管+玻璃珠）滴定管，酸液用酸式（玻璃活塞）滴定管；装液后排尽尖嘴气泡再调零；垂直夹持不手持。",
    scenes: ["滴定管", "实验 9 步3 步4", "酸碱滴定"],
    source: "《无机及分析化学实验》滴定分析基本操作·滴定管的使用" + TODO,
    domain: "titration", review: TODO,
  },
  {
    id: "S005",
    title: "滴定操作与终点判定",
    requirement:
      "左手控活塞或捏玻璃珠、右手旋摇锥形瓶；先快后慢，近终点逐滴、半滴加入（管尖靠内壁、用洗瓶吹下、摇匀）；指示剂按规定用量（酚酞 2 滴）；终点以「浅粉红 30 s 不褪」为准并衬白瓷板比色；平行测定不少于 3 次。",
    scenes: ["滴定", "终点判定", "实验 9 步5 步6 步7"],
    source: "《无机及分析化学实验》滴定操作与终点误差" + TODO,
    domain: "titration", review: TODO,
  },
  {
    id: "S006",
    title: "滴定管读数与记录",
    requirement:
      "三位一线：视线与凹液面最低点水平；估读到最小分度 1/10（0.01 mL）并记两位小数；初读数如实记录、参与计算；每次滴定从 0.00 附近起读，读数当场记入记录本。",
    scenes: ["滴定管读数", "有效数字", "实验 9 步4 步7"],
    source: "《无机及分析化学实验》滴定分析基本操作·读数；分析化学有效数字规则" + TODO,
    domain: "titration", review: TODO,
  },
  {
    id: "S007",
    title: "移液管的使用",
    requirement:
      "一律用洗耳球吸液，严禁口吸；用待移取液润洗 3 次；吸至刻度上方后调至凹液面与标线相切；管尖靠器壁自然流尽后停留约 15 s 再取出，不得吹出残液。",
    scenes: ["移液管", "实验 9 步5", "量取腐蚀性液体"],
    source: "《无机及分析化学实验》滴定分析基本操作·移液管" + TODO,
    domain: "titration", review: TODO,
  },
  {
    id: "S008",
    title: "试剂储存与酸碱废液处置",
    requirement:
      "碱液存聚乙烯瓶、配橡胶塞或塑料螺纹盖并贴标签（名称/浓度/日期/姓名），不得用玻璃磨口塞；稀酸碱中和至 pH 6~9 后排放，含重金属/卤素/有机废液分桶收集，交有资质单位处置。",
    scenes: ["试剂储存", "废液", "实验 9 步1 收尾"],
    source: "《危险化学品安全管理条例》；学院《实验室废液分类收集规定》" + TODO,
    domain: "waste", review: TODO,
  },
  {
    id: "S009",
    title: "仪器损坏与事故报告流程",
    requirement:
      "发生破损、泄漏、灼伤、起火等立即停止操作、切断水电气源、保护现场并第一时间报告指导教师；如实填写事故记录，不得隐瞒或自行处理；L4 级事故须完成安全复盘后方可重做。",
    scenes: ["事故", "仪器损坏", "实验 9 步4", "全部实验"],
    source: "学院《实验室安全事故应急预案》；《实验室安全管理办法》" + TODO,
    domain: "report", review: TODO,
  },
  {
    id: "S010",
    title: "通风橱内操作挥发性与刺激性试剂",
    requirement:
      "浓盐酸、浓氨水、冰醋酸、有机溶剂等一切有蒸气压的试剂，开瓶、量取、转移、稀释全过程在通风橱内完成，橱门高度不超过安全线；嗅辨只能用手背在远处轻扇，严禁俯身对瓶口直接闻。",
    scenes: ["通风橱", "浓盐酸", "浓氨水", "冰醋酸", "实验 9 步2"],
    source: "GHS07 刺激性标识要求；学院《通风橱使用规定》" + TODO,
    domain: "hazardous", review: TODO,
  },
  {
    id: "S011",
    title: "重金属与有毒废液的分类回收",
    requirement:
      "含银、汞、铬(Ⅵ)、钡、铜、钴等重金属的溶液与沉淀一律入专用重金属废液桶，标签写明离子种类与日期，严禁倾入水槽；含银废液另需当日破坏处理，不得留存过夜。",
    scenes: ["重金属", "含银废液", "含铬废液", "实验 4 实验 6 实验 7"],
    source: "《国家危险废物名录》；学院《实验室废液分类收集规定》" + TODO,
    domain: "waste", review: TODO,
  },
  {
    id: "S012",
    title: "浓酸浓碱的稀释与量取",
    requirement:
      "稀释浓硫酸/浓盐酸/浓碱必须「酸（碱）入水、沿壁、缓慢、边加边搅拌」，先加水后加酸，容器置于冷水浴或石棉网上，温度过高时暂停加酸；量取浓酸用专用量筒，不得在量筒内稀释。",
    scenes: ["稀释", "浓硫酸", "浓盐酸", "浓碱", "实验 1 实验 9 实验 10"],
    source: "《无机及分析化学实验》溶液配制；GHS05" + TODO,
    domain: "corrosive", review: TODO,
  },
  {
    id: "S013",
    title: "加热、蒸发与暴沸防护",
    requirement:
      "加热用试管夹/坩埚钳，管口不对人；蒸发皿下垫石棉网、微沸不暴沸，出现晶膜立即停火、余热蒸干，严禁蒸干后继续强热；加热中的容器不得加盖密闭。",
    scenes: ["加热", "蒸发", "煮沸", "实验 2 实验 10"],
    source: "《无机及分析化学实验》加热与蒸发操作" + TODO,
    domain: "heating", review: TODO,
  },
  {
    id: "S014",
    title: "热玻璃器皿的取放与冷却",
    requirement:
      "热容器一律用坩埚钳或隔热手套取放，置于石棉网/木垫上自然冷却至室温，严禁用冷水冲淋骤冷，严禁徒手抓取瓶壁。",
    scenes: ["热器皿", "冷却", "实验 1 实验 2 实验 10"],
    source: "《无机及分析化学实验》玻璃仪器使用与热应力防护" + TODO,
    domain: "glassware", review: TODO,
  },
  {
    id: "S015",
    title: "滴加、移液与逐滴至终点",
    requirement:
      "定量加入试剂一律用滴定管/移液管/刻度滴管，逐滴加入、每滴摇匀后再判断；一试剂一滴管并贴标，取液前核对标签名称与浓度；沉淀洗涤用蒸馏水，不得用自来水。",
    scenes: ["滴加", "移液", "沉淀", "实验 2 实验 4 实验 6 实验 7"],
    source: "《无机及分析化学实验》基本操作" + TODO,
    domain: "titration", review: TODO,
  },
  {
    id: "S016",
    title: "严禁用口吸取腐蚀性或有毒液体",
    requirement:
      "任何液体都不得用口吸；腐蚀性、有毒、挥发性液体一律用洗耳球或移液器量取，洗耳球须常备在手边。",
    scenes: ["移液", "口吸", "浓盐酸", "浓硝酸", "BaCl₂", "实验 10"],
    source: "《无机及分析化学实验》基本操作；学院《实验室安全守则》" + TODO,
    domain: "discipline", review: TODO,
  },
  {
    id: "S017",
    title: "离心机的配平与安全运行",
    requirement:
      "对称孔放等体积（液面差 ≤0.1 mL）配平管，转子盖旋紧后启动；运行中不得开盖、不得离开；管壁有裂纹一律弃用；停机后待转子完全静止再取管。",
    scenes: ["离心机", "实验 4 实验 7"],
    source: "离心机随机说明书安全章节；学院《实验室仪器操作规程》" + TODO,
    domain: "instrument", review: TODO,
  },
  {
    id: "S018",
    title: "明火、焰色反应与易燃试剂",
    requirement:
      "酒精灯用火柴点燃、用灯帽盖灭，不得用嘴吹；焰色反应用镍铬丝蘸取，蘸前用浓 HCl 洗至火焰无色，隔蓝色钴玻璃观察钾；易燃试剂远离明火，取用后立即盖严。",
    scenes: ["明火", "焰色反应", "酒精灯", "实验 7"],
    source: "《无机及分析化学实验》焰色反应操作；GHS02 易燃" + TODO,
    domain: "heating", review: TODO,
  },
  {
    id: "S019",
    title: "分析天平的使用与超载保护",
    requirement:
      "上秤前确认铭牌最大载荷（如 200 g），严禁超过；调水平、预热 ≥30 min、内校后回零；热物湿物冷却至室温再称；只接触底座与侧门把手，不得触碰刀口、吊耳与横梁；搬动整机须由教师托底。",
    scenes: ["天平", "称量", "实验 1 实验 8"],
    source: "电光/电子天平说明书；《无机及分析化学实验》称量操作" + TODO,
    domain: "instrument", review: TODO,
  },
  {
    id: "S020",
    title: "电学仪表的档位、量程与带电仪器防水",
    requirement:
      "接线前先确认档位与量程，电动势测量只能用电压档并联、严禁电流档；带电仪器与液体保持距离，擦干手再插拔电源；仪器进水或跳闸立即断电并报告。",
    scenes: ["万用表", "pH 计", "电位差计", "实验 3 实验 5"],
    source: "《无机及分析化学实验》电化学测量；学院用电安全规定" + TODO,
    domain: "electrical", review: TODO,
  },
  {
    id: "S021",
    title: "银氨溶液现配现用与当日破坏",
    requirement:
      "银氨溶液只在水浴或室温下使用，绝不加热、绝不过夜、绝不蒸干；实验结束立即加稀 HCl 酸化破坏（生成 AgCl、消除爆炸性），沉淀与滤液入含银重金属废液桶。",
    scenes: ["银氨溶液", "雷银", "实验 6 实验 7"],
    source: "《无机及分析化学实验》银氨配离子实验安全注；爆炸性银化物警示" + TODO,
    domain: "hazardous", review: TODO,
  },
  {
    id: "S022",
    title: "危险化学品的定点取用与标签核对",
    requirement:
      "危险化学品在指定位置原瓶取用、不转移容器；取液前读标签的名称、浓度与 GHS 标识，取后立即盖严归位；多余试剂不回原瓶，交回收瓶处理。",
    scenes: ["取试剂", "标签", "全部实验"],
    source: "GHS 标签制度；《危险化学品安全管理条例》" + TODO,
    domain: "hazardous", review: TODO,
  },
  {
    id: "S023",
    title: "废液分类与固废处置",
    requirement:
      "酸碱、重金属、卤素、有机废液分桶收集并贴标签；固体废弃物与玻璃碎片按类别投放；严禁把废液倒入水槽或垃圾桶，严禁混合不明废液。",
    scenes: ["废液", "收尾", "全部实验"],
    source: "《国家危险废物名录》；学院《实验室废液分类收集规定》" + TODO,
    domain: "waste", review: TODO,
  },
  {
    id: "S024",
    title: "有毒气体与泄漏的应急撤离",
    requirement:
      "发现 Cl₂、NH₃、H₂S、酸雾等异常逸出，立即停止操作、开大排风、向上风向疏散并报告；不要逆风返回取物，不要盲目用水冲浓硫酸泄漏点。",
    scenes: ["有毒气体", "泄漏", "应急"],
    source: "学院《实验室安全事故应急预案》" + TODO,
    domain: "report", review: TODO,
  },
];

/** 全库 id 索引（O(1) 查 refs） */
export const HAZARD_INDEX: Readonly<Record<string, HazardItem>> = Object.freeze(
  Object.fromEntries(HAZARDS.map((h) => [h.id, h])),
);

export const HAZARD_IDS: readonly string[] = HAZARDS.map((h) => h.id);

/** 取一条规范；不存在返回 undefined（调用方自行决定报错还是降级） */
export function getHazard(id: string): HazardItem | undefined {
  return HAZARD_INDEX[id];
}

/** refs 校验用：是否存在 */
export function hasHazard(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(HAZARD_INDEX, id);
}

/** 按场景关键字过滤（场景里「包含」关键字即命中，大小写不敏感） */
export function hazardsForScene(scene: string): HazardItem[] {
  const q = scene.trim().toLowerCase();
  if (!q) return [];
  return HAZARDS.filter(
    (h) =>
      h.scenes.some((s) => s.toLowerCase().includes(q)) || h.title.toLowerCase().includes(q),
  );
}

/** 一批 refs 里不存在的编号 */
export function missingHazardIds(refs: readonly string[]): string[] {
  return refs.filter((r) => !hasHazard(r));
}
