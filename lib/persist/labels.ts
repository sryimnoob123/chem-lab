/**
 * lib/persist/labels.ts —— 展示名回落（纯查表，无 IO）
 *
 * 为什么需要：
 * - 真实 run 的 `timeline.choice_id` 是实验定义里的 choiceId，可直接取到中文 label；
 * - 演示 seed（`db/seed-demo.mjs`）写的是 `demo-<actionType>-<n>` 和 `exp09-L<级别>-<编号>`
 *   这类合成 id，registry 里查不到，页面就会露出英文 id。
 * 所以统一走这里回落：定义文件 label → 动作类型通用名 / 事故 registry 标题 → 演示 id 别名 → 级别名。
 *
 * TODO(db/seed-demo 的 owner)：seed 改成 registry 的 `exp09-H<n>` 之后，下面的 LEGACY 映射可删。
 */

import type { ActionType, ExperimentDefinition } from "@/lib/engine";
import { getIncident } from "@/lib/safety/registry";

/** 17 个动作原语的中文名（契约 §1 的顺序）。 */
export const ACTION_LABELS: Readonly<Record<ActionType, string>> = {
  wash: "洗涤",
  weigh: "称量",
  dissolve: "溶解",
  transfer: "转移",
  dilute: "稀释",
  heat: "加热",
  evaporate: "蒸发",
  filter: "过滤",
  centrifuge: "离心",
  washPrecipitate: "洗涤沉淀",
  addDrops: "滴加",
  titrate: "滴定",
  readInstrument: "读数",
  observe: "观察",
  assemble: "组装",
  calibrate: "校准",
  compute: "计算",
};

/** 演示 seed 用的合成事故 id → 中文名（与 db/seed-demo.mjs 的 INCIDENTS 表一致）。 */
const LEGACY_INCIDENT_LABELS: Readonly<Record<string, string>> = {
  "exp09-L1-001": "俯视读数",
  "exp09-L1-002": "滴定管未润洗",
  "exp09-L2-001": "气泡未排尽",
  "exp09-L2-002": "半滴未靠壁",
  "exp09-L3-001": "滴定过量",
  "exp09-L4-001": "水入酸（热液喷溅）",
};

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  L1: "偏差",
  L2: "数据作废",
  L3: "事故",
  L4: "危险事故",
};

/** 事故中文名：registry 优先，其次演示别名，最后级别名（不把裸 id 直接给用户）。 */
export function incidentLabel(incidentId: string, level?: string): string {
  const registered = getIncident(incidentId);
  if (registered) return registered.title;
  const legacy = LEGACY_INCIDENT_LABELS[incidentId];
  if (legacy) return legacy;
  const levelLabel = level ? LEVEL_LABELS[level] : undefined;
  return levelLabel ?? incidentId;
}

/** 时间线中文动作名：定义文件 choice.label 优先，其次动作类型通用名。 */
export function actionLabel(input: {
  definition: ExperimentDefinition | undefined;
  stepIndex: number;
  choiceId: string;
  actionType: string;
}): string {
  const choice = input.definition?.steps[input.stepIndex]?.choices.find(
    (item) => item.choiceId === input.choiceId,
  );
  if (choice) return choice.label;
  return ACTION_LABELS[input.actionType as ActionType] ?? input.actionType;
}
