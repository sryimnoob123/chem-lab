/**
 * Pass 4：手工补齐 pass3 之后剩余的损坏行。
 *
 * 这些行是今天新增的（参照源里没有），丢失的字符无法从任何基线取回，
 * 因此按上下文逐行确定内容，用行号精确替换。
 * 行号是 1-based，改完后立即用 tsc 验证。
 */
import { readFileSync, writeFileSync } from "node:fs";

const TARGET = "app/exp/[id]/workbench.tsx";

/** 行号(1-based) -> 该行应有的完整内容 */
const FIXES = new Map([
  // PARAM_NAMES 之外的统计卡：观察记录 / 违规事故，单位是"次"
  [581, '          unit: "次",'],
  [587, '          unit: "次",'],
  // 顶栏返回箭头
  [957, '          <span aria-hidden="true">←</span> 返回'],
  // 事故条兜底文案（why / correct 为空时的兜底）
  [1105, '                incidentEvent.why ?? "这一步有后果，先停下来按处置做",'],
  [1106, '                incidentEvent.correct ?? "按「重做本步」回到这一步开头",'],
  // 第 7 步右栏：浓度比
  [1130, '                <span className={styles.paramLabel}>浓度比</span>'],
  [1133, "                  <em>c₁/c₂</em>"],
  // 滴定管读数标签
  [1148, '                <span className={styles.paramLabel}>滴定管读数</span>'],
  // 违规详情 summary：看原因 · 扣 N 分 / 未扣分
  [1209, '                看原因 · {ui.event.deduction > 0 ? `扣 ${ui.event.deduction} 分` : "未扣分"}'],
  // 正确做法标签
  [1215, "                  <span>正确做法</span>"],
  // L4 终止提示
  [1220, '                <p className={guide.whyWarn}>L4 危险事故：本次实验已终止，操作分记 0 分。</p>'],
  // 「其他做法」计数
  [1229, "                <span className={guide.otherCount}>{otherChoices.length} 项</span>"],
  // 未满足前置的按钮提示
  [1253, '                      {needs ? <span className={guide.otherMeta}>需先完成前置动作</span> : null}'],
  // 提示灯泡按钮：title / aria-label / 按钮文字
  [1330, '              ? "本步提示已用完（每步最多 3 次）"'],
  [1332, "                ? `${HINT_TIER_LABEL[hintNextTier]} · 本次扣 ${hintDeductPoints} 分`"],
  [1333, '                : "要一个提示"'],
  [1337, '              ? "本步提示已用完"'],
  [1342, '          {hintExhausted ? "已用完" : "提示"}'],
]);

const lines = readFileSync(TARGET, "utf8").split("\n");
const report = [];

for (const [no, text] of FIXES) {
  const idx = no - 1;
  const before = lines[idx];
  if (before === undefined) {
    report.push(`L${no}: 行不存在，跳过`);
    continue;
  }
  // 安全检查：只改仍然损坏的行，避免误伤已被还原的内容
  if (!before.includes("\uFFFD")) {
    report.push(`L${no}: 已无替换字符，跳过（当前: ${before.trim().slice(0, 60)}）`);
    continue;
  }
  lines[idx] = text;
  report.push(`L${no}: 已修复`);
}

writeFileSync(TARGET, lines.join("\n"), "utf8");

for (const r of report) console.log("  " + r);
console.log(`\n共处理 ${FIXES.size} 行`);
const remain = lines.filter((l) => l.includes("\uFFFD")).length;
console.log(`文件内仍含替换字符的行: ${remain}（应全部在注释里）`);
