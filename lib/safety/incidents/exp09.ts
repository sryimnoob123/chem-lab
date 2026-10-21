/**
 * 实验 9《酸碱标准溶液的配制与浓度比较》的事故表
 *
 * 来源：`docs/实验库/exp09.md` §7（事故点，含真实化学机理）——本文件是它的**逐条翻译**，
 * 规格改动先改 md 再改这里。规格只有教学口径，**文案先内联**；将来抽到 `strings.ts` 是 Lead 的活。
 *
 * trigger 约定（纯函数，禁止读全局/随机/时间）：
 * - 先判 `state.stepIndex`（0-based），规格步号 1-based，用 onStep(state, n)；
 * - 再判「学生到底怎么做的」，优先读 `action.params` 的语义开关，其次容忍 choiceId 里的语义 token；
 *   定义文件（experiments/exp09/definition.ts）按下面的参数名填 params，就能与本表对上：
 *   H1 order:"water-into-acid" | H2 bareHand:true / container:"weighing-paper"
 *   H3 buretteType:"acid" + solution:"NaOH"（或 forceTwist:true）
 *   H4 handheldBurette:true | clamp:"loose"    H5 rinses:0 | tapWaterOnly:true
 *   H6 bubblesInTip:true | bubbles>0           H7 rinseCount:0 | blowOut:true
 *   H8 overTitrated:true | endpoint:"deep-red" H9 hotSolution:true | cooled:false | temp>=40
 *   H10 bottle:"glass" — H11 drops>=5 — H12 flow:"stream" — H13 parallelRuns:1 — H14 ratio:"inverted"
 *
 * 扣分严格照契约 §5：L1 2~3 / L2 5 / L3 8~10 / L4 15~20 且 terminate=true（单测强制）。
 */

import type { HazardIncident } from "./types";
import { choiceHas, numParam, onStep, paramEquals, paramTrue } from "./types";

/** id/level/fx/deduct/competency 与 `experiments/exp09/definition.ts` 的 ruleId（exp09-H1…H14）逐条对齐 */
export const EXP09_INCIDENTS: readonly HazardIncident[] = [
  // ── L4：危险事故，终止本次实验 ────────────────────────────────────
  {
    id: "exp09-H1", stepNo: 2, level: "L4", fx: "boil-over",
    title: "水入浓盐酸：局部过热、酸雾与热液喷溅",
    why:
      "浓盐酸 ρ = 1.19 g/mL > 水，把水倒进酸里水会浮在上层；HCl 溶解热约 −75 kJ/mol 集中在水层，局部瞬时过热并促使 HCl 急剧逸出。俯身观察使高浓度酸雾直冲面部。",
    consequence:
      "酸雾与热酸液喷溅，眼结膜与呼吸道化学灼伤，可致角膜损伤、声门水肿；本次实验立即终止，须做安全复盘并重新配液。",
    correct:
      "① 通风橱内、戴护目镜+丁腈手套；② 先向烧杯加约 300 mL 蒸馏水；③ 用 10 mL 量筒量 4.2 mL 浓盐酸，沿内壁缓缓注入水中，边加边搅拌；④ 液温 ≤40 ℃，冷却至室温再转入聚乙烯瓶定容、贴标签。",
    refs: ["S003", "S010"], // 规格 §7 写的是「S003、S006」；S006 在本库是滴定管读数，与酸雾无关，按 §5 口径改指通风橱条目（S010）
    deduct: 20,
    terminate: true,
    competency: "A1",
    trigger: (s, a) =>
      onStep(s, 2) &&
      (paramEquals(a, "order", "water-into-acid", "water-in-acid") ||
        choiceHas(a, "water-into-acid", "water-in-acid", "water-into-hcl")),
  },

  // ── L3：事故，定格 + 事故卡 + 重做该步 ────────────────────────────
  {
    id: "exp09-H2", stepNo: 1, level: "L3", fx: "burn",
    title: "徒手取 NaOH 固体：潮解皂化造成皮肤灼伤",
    why:
      "NaOH 强吸湿，遇皮肤表面水分立即溶解并皂化脂肪（RCOO⁻Na⁺ 生成），同时放出溶解热，碱液向深层渗透造成持续损伤——碱灼伤比酸灼伤更深、更久。",
    consequence:
      "手指先滑腻、随后灼痛起泡，重者形成溃疡，愈合慢；手上残碱再接触眼睛可致角膜碱烧伤。",
    correct:
      "① 戴丁腈手套；② 用药匙取固体、不用手抓；③ 在 100 mL 烧杯中快速称量、不称在称量纸上；④ 称后立即盖严试剂瓶，用纸擦净台面残留。",
    refs: ["S003"],
    deduct: 10,
    terminate: false,
    competency: "A1",
    trigger: (s, a) =>
      onStep(s, 1) &&
      (paramTrue(a, "bareHand", "handheldSolid") ||
        paramEquals(a, "container", "weighing-paper", "paper") ||
        choiceHas(a, "bare-hand", "weighing-paper")),
  },
  {
    id: "exp09-H3", stepNo: 4, level: "L3", fx: "glass-break",
    title: "碱装酸式滴定管：磨口被腐蚀黏结、强拧致活塞碎裂",
    why:
      "2NaOH + SiO₂ → Na₂SiO₃ + H₂O，碱腐蚀玻璃磨口生成硅酸钠，密封面黏结发涩；强行扭转使活塞柄折断，管身应力集中而崩裂。",
    consequence:
      "活塞碎裂、管身断裂，50 mL 碱液与玻璃碎片飞溅，割伤并化学灼伤；滴定管报废，本组滴定数据须全部重做。",
    correct:
      "① 碱液一律用碱式滴定管（橡胶管+玻璃珠），酸液用酸式（玻璃活塞）滴定管；② 洗后不用碱液长时间浸润磨口；③ 活塞发涩先取下洗净、薄涂凡士林再试，绝不硬拧；④ 破损件按 S002 弃用登记。",
    refs: ["S004"],
    deduct: 9,
    terminate: false,
    competency: "S1",
    trigger: (s, a) =>
      onStep(s, 4) &&
      (choiceHas(a, "naoh-in-acid", "alkali-in-acid", "acid-burette-alkali") ||
        (paramEquals(a, "buretteType", "acid") &&
          (paramEquals(a, "solution", "NaOH", "naoh") || paramTrue(a, "forceTwist")))),
  },
  {
    id: "exp09-H4", stepNo: 4, level: "L3", fx: "device-accident",
    title: "手持滴定管排气泡 / 管夹未夹紧：滴定管跌落",
    why:
      "50 mL 滴定管装满试液后重心高、管壁薄（约 1 mm），倾斜手持时一旦脱手即自由落体，玻璃与 50 mL 液体的冲击动能全部释放到台面。",
    consequence:
      "滴定管报废，管内试液全部洒落、台面污染、数据须重做；玻璃碎片割伤手部，若为酸碱还会造成溅灼。",
    correct:
      "① 滴定管垂直夹在铁架台上并拧紧管夹；② 排气泡靠「装液至零刻度上方、管尖朝下快速放液」完成，不手持；③ 管尖伸入锥形瓶口内 2~3 cm；④ 全程不手持装液后的滴定管移动。",
    refs: ["S004", "S009"],
    deduct: 8,
    terminate: false,
    competency: "S1",
    trigger: (s, a) =>
      onStep(s, 4) &&
      (paramTrue(a, "handheldBurette", "tiltBurette") ||
        paramEquals(a, "clamp", "loose") ||
        choiceHas(a, "handheld-burette", "hold-burette", "loose-clamp", "tilt-burette")),
  },

  // ── L2：数据作废，该步重做（无动画，文字+音效）────────────────────
  {
    id: "exp09-H5", stepNo: 3, level: "L2", fx: "device-accident", fxSilent: true,
    title: "未用待装液润洗：内壁水膜稀释溶液",
    why:
      "内壁残留的水膜（约 0.1~0.3 mL）稀释装入的溶液，实际浓度低于标称值，放出的体积必须偏大才能达到同一物质的量。",
    consequence:
      "消耗体积偏大 0.3%~0.8%，浓度比出现系统性偏差，三次平行数据同时作废。",
    correct:
      "① 洗洁精刷洗 → ② 自来水冲净 → ③ 蒸馏水淋洗 3 次 → ④ 待装液润洗 3 次（每次约 5 mL，转动全润湿后由尖嘴放出）。",
    refs: ["S004"],
    deduct: 5,
    terminate: false,
    competency: "S1",
    trigger: (s, a) =>
      onStep(s, 3) &&
      (numParam(a, "rinses") === 0 ||
        paramTrue(a, "tapWaterOnly", "noRinse") ||
        choiceHas(a, "no-rinse", "tap-water-only", "rinse-once")),
  },
  {
    id: "exp09-H6", stepNo: 4, level: "L2", fx: "device-accident", fxSilent: true,
    title: "尖嘴气泡未排尽即调零：液面突降、读数跳变",
    why:
      "气泡占据尖嘴与刻度段的体积（0.05~0.3 mL），滴定中气泡逸出使液面突降，终读数与真实放液量不符。",
    consequence: "单次读数跳变 0.05~0.3 mL，该次数据不可用，须重新装液排气后重滴。",
    correct:
      "① 装液至零刻度上方；② 管尖朝下快速放液冲出尖嘴气泡；③ 确认尖嘴无气泡后再调至 0.00 mL 并记初读数。",
    refs: ["S004"],
    deduct: 5,
    terminate: false,
    competency: "S1",
    trigger: (s, a) =>
      onStep(s, 4) &&
      (paramTrue(a, "bubblesInTip", "bubbleNotRemoved") ||
        (numParam(a, "bubbles") ?? 0) > 0 ||
        choiceHas(a, "bubble", "skip-degas", "no-degas")),
  },
  {
    id: "exp09-H7", stepNo: 5, level: "L2", fx: "device-accident", fxSilent: true,
    title: "移液管未润洗或吹出残液：移取体积偏差",
    why:
      "未润洗时管内残留水稀释试液使 c 偏低；吹出残液则多放 0.02~0.05 mL——A 级移液管是按「自然流尽」标定的，吹出量不在标定范围内，移取体积出现 0.1%~0.2% 的正偏差。",
    consequence: "移取体积偏差 0.1%~0.2%，c(HCl) 偏低、体积比偏高，三次平行须重做。",
    correct:
      "① 蒸馏水洗净；② 待移取液润洗 3 次；③ 洗耳球吸至刻度上方，调至凹液面与 25.00 mL 相切；④ 管尖靠内壁自然流下、停留 15 s 后取出，绝不吹。",
    refs: ["S007"],
    deduct: 5,
    terminate: false,
    competency: "S2",
    trigger: (s, a) =>
      onStep(s, 5) &&
      (numParam(a, "rinseCount") === 0 ||
        paramTrue(a, "blowOut", "blowRemnant") ||
        choiceHas(a, "blow-out", "blow-remnant", "no-rinse", "skip-rinse")),
  },
  {
    id: "exp09-H8", stepNo: 6, level: "L2", fx: "device-accident", fxSilent: true,
    title: "深红色仍继续滴加：滴定过量",
    why:
      "超过化学计量点后过量 NaOH 使酚酞深度显色（pH 越高红色越深），继续滴加只是把 V(NaOH) 读数系统性推大；由 c(NaOH)/c(HCl) = V(HCl)/V(NaOH)，浓度比随之偏小。",
    consequence: "V(NaOH) 偏大 ≥0.1 mL，超出判分容差，本次数据作废，须重取重滴。",
    correct:
      "① 近终点逐滴、半滴（四分之一滴）加入；② 每加必摇匀；③ 浅粉红 30 s 不褪立即停；④ 深红即已过量，如实记录并重做。",
    refs: ["S005"],
    deduct: 5,
    terminate: false,
    competency: "S2",
    trigger: (s, a) =>
      onStep(s, 6) &&
      (paramTrue(a, "overTitrated", "continueAfterDeepRed") ||
        paramEquals(a, "endpoint", "deep-red", "over") ||
        choiceHas(a, "over-titrate", "deep-red")),
  },
  {
    id: "exp09-H9", stepNo: 1, level: "L2", fx: "device-accident", fxSilent: true,
    title: "热液未冷却即定容：冷却后体积收缩",
    why:
      "水的体膨胀系数约 2×10⁻⁴ K⁻¹，20→60 ℃ 体积增大约 1.6%；热态定容到刻度，冷却后液面低于刻度，c 偏低约 1%。",
    consequence: "c(NaOH) 偏低约 1%，浓度比同向偏差，超出判分容差，本步定容须重做。",
    correct:
      "① 溶解后先冷却至室温；② 可水浴冷却烧杯外壁，不骤冷；③ 冷却后再转入聚乙烯瓶定容至 500 mL。",
    refs: ["S004"],
    deduct: 5,
    terminate: false,
    competency: "A1",
    trigger: (s, a) =>
      onStep(s, 1) &&
      (paramTrue(a, "hotSolution", "noCooling") ||
        paramEquals(a, "cooled", false) ||
        (numParam(a, "temp") ?? 0) >= 40 ||
        choiceHas(a, "hot-water", "no-cooling", "hot-dissolve")),
  },
  {
    id: "exp09-H10", stepNo: 1, level: "L2", fx: "glass-break", fxSilent: true,
    title: "碱液装玻璃细口瓶配磨口塞：瓶塞黏结、试剂报废",
    why:
      "NaOH 与玻璃中 SiO₂ 缓慢反应生成硅酸钠，磨口处黏结；长期存放还溶入硅酸盐，污染溶液。",
    consequence: "瓶塞粘死打不开、试剂整瓶报废；溶液含硅酸盐会影响后续标定的准确度。",
    correct:
      "① 一律存聚乙烯瓶；② 配橡胶塞或塑料螺纹盖；③ 贴标签写明名称/浓度/日期/姓名；④ 玻璃瓶只用于酸液或短期中性溶液。",
    refs: ["S004", "S008"],
    deduct: 5,
    terminate: false,
    competency: "A1",
    trigger: (s, a) =>
      onStep(s, 1) &&
      (paramEquals(a, "bottle", "glass", "glass-stoppered") ||
        choiceHas(a, "glass-bottle", "glass-stoppered", "glass-stopper")),
  },

  // ── L1：偏差，提示后可继续 ────────────────────────────────────────
  {
    id: "exp09-H11", stepNo: 5, level: "L1", fx: "device-accident", fxSilent: true,
    title: "酚酞加 5~6 滴：指示剂耗碱、终点不敏锐",
    why:
      "酚酞本身是弱酸，会消耗少量碱；且颜色过深使变色转折变钝，人眼判断的终点提前，消耗的 NaOH 体积偏小 0.02~0.05 mL。",
    consequence: "终点提前 0.02~0.05 mL，V(NaOH) 略偏小，本组平行数据带同向偏差。",
    correct:
      "① 加 2 滴（约 0.05~0.1 mL）即可；② 轻摇混匀；③ 颜色已过深须重新移取，不得「将就做」。",
    refs: ["S005"],
    deduct: 3,
    terminate: false,
    competency: "S2",
    trigger: (s, a) =>
      onStep(s, 5) &&
      ((numParam(a, "drops") ?? 0) >= 5 ||
        choiceHas(a, "indicator-excess", "excess-indicator", "extra-drops", "many-drops")),
  },
  {
    id: "exp09-H12", stepNo: 6, level: "L1", fx: "device-accident", fxSilent: true,
    title: "开大流量成线流滴定：局部过量、终点反复",
    why:
      "线流使加入点局部 NaOH 浓度骤升，pH 瞬间超过变色区，指示剂先变红；旋摇后扩散又褪去——终点因此反复不定。",
    consequence: "终点判断困难，读数偏高 0.05~0.2 mL，重做耗时且易连带两次数据不可用。",
    correct:
      "① 先快后慢；② 近终点逐滴、半滴加入；③ 边加边旋摇锥形瓶；④ 流速以「能跟得上摇匀」为限。",
    refs: ["S005"],
    deduct: 3,
    terminate: false,
    competency: "S2",
    trigger: (s, a) =>
      onStep(s, 6) &&
      (paramTrue(a, "lineStream", "stream") ||
        paramEquals(a, "flow", "stream", "line") ||
        choiceHas(a, "line-stream", "line-flow", "fast-flow", "stream")),
  },
  {
    id: "exp09-H13", stepNo: 7, level: "L1", fx: "device-accident", fxSilent: true,
    title: "只做 1 次平行测定：无法估计随机误差",
    why:
      "单次测定只有一个消耗体积读数，没有极差，偶然误差不可发现；平行测定的意义正是用分散度估计不确定度。",
    consequence: "无相对极差可算，数据完整性扣分；报告结论不可靠，无法判断是否合格。",
    correct:
      "① 平行测定 3 次并如实记录每次初/终读数；② 算平均体积与相对极差；③ 相对极差 ≤0.2% 方可取平均。",
    refs: ["S005"],
    deduct: 3,
    terminate: false,
    competency: "K2", // 与 definition.ts 的 exp09-H13 对齐（数据完整性问题归 K2 读数与有效数字）
    trigger: (s, a) =>
      onStep(s, 7) &&
      ((numParam(a, "parallelRuns") ?? 3) <= 1 ||
        paramTrue(a, "singleRun", "onlyOnce") ||
        choiceHas(a, "single-run", "single-trial", "one-run", "once")),
  },
  {
    id: "exp09-H14", stepNo: 7, level: "L1", fx: "device-accident", fxSilent: true,
    title: "把体积比直接当浓度比：取倒数错误",
    why:
      "由 c(碱)·V(碱) = c(酸)·V(酸) 得 c(碱)/c(酸) = V(酸)/V(碱)，浓度比是体积比的**倒数**，不是体积比本身。",
    consequence: "比值取倒数，与参考值差约 1.6%，计算结果分全部丢失。",
    correct:
      "① 先写公式再代数；② 明确代入的是 c(NaOH)/c(HCl) = V(HCl)/V(NaOH)；③ 检查「浓度大的一方消耗体积小」是否成立；④ 结果取 3 位有效数字。",
    refs: ["S005"],
    deduct: 3,
    terminate: false,
    competency: "K1",
    trigger: (s, a) =>
      onStep(s, 7) &&
      (paramEquals(a, "ratio", "inverted", "volume-over-volume") ||
        paramTrue(a, "invertedRatio") ||
        choiceHas(a, "inverted-ratio", "volume-ratio-as-concentration")),
  },
];

/** 按 id 取本实验的一条事故 */
export function exp09Incident(id: string): HazardIncident | undefined {
  return EXP09_INCIDENTS.find((i) => i.id === id);
}
