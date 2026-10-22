/**
 * 接口契约的 TypeScript 投影（唯一权威：docs/接口契约.md）。
 * 这里只放**类型**与纯数据形状；所有运行时逻辑在 lib/engine.ts。
 *
 * 谁在消费这些类型：
 * - lib/engine.ts           状态机
 * - experiments/<id>/      实验定义
 * - lib/rules/**           规则层（产出 violation / incident，再喂给 applyIncident）
 * - lib/safety/**          事故表（Incident）
 * - 组件 / 服务端时间线      Event、TimelineRow
 *
 * 契约变更流程：先改 docs/接口契约.md，再改这里，并在 .team/DECISIONS.md 记一行。
 */
/** 运行时校验用（定义文件测试、UI 选项池）。与 ActionType 同源，改一处即可。 */
export const ACTION_TYPES = [
    "wash",
    "weigh",
    "dissolve",
    "transfer",
    "dilute",
    "heat",
    "evaporate",
    "filter",
    "centrifuge",
    "washPrecipitate",
    "addDrops",
    "titrate",
    "readInstrument",
    "observe",
    "assemble",
    "calibrate",
    "compute",
];
