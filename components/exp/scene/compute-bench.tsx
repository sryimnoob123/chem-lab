"use client";

/**
 * ComputeBench —— exp09 第 7 步「平行测定与浓度比计算」的场景。
 *
 * 为什么需要它：这一步的三个正确动作（重复滴定 / 记录读数 / 算浓度比）都是数据处理，
 * 但场景一直停在滴定管 + 锥形瓶上，右侧还挂着「滴定管读数 25.18 mL」，
 * 学生看不到能操作的数据，卡片说「重复步 5~6 共 3 次」却无处可点（红队 2026-10-22 报）。
 *
 * 这里把这一步真正要看的三个东西摆出来：三次平行读数表 → 平均与极差 → 浓度比公式，
 * 随动作完成逐块点亮，和右侧建议卡一一对应。
 */

import styles from "./compute-bench.module.css";

export interface ComputeBenchProps {
  /** 本步已完成的观察文本（来自 engine 的 observations），用来点亮表格/结果。 */
  observations: readonly string[];
}

const TRIALS = [
  { no: 1, volume: "25.18", initial: "0.00", final: "25.18" },
  { no: 2, volume: "25.22", initial: "0.00", final: "25.22" },
  { no: 3, volume: "25.20", initial: "0.00", final: "25.20" },
] as const;

export function ComputeBench({ observations }: ComputeBenchProps) {
  const joined = observations.join(" ");
  const repeated = /三次平行滴定完成|次平行/.test(joined);
  const recorded = /极差/.test(joined);
  const computed = /浓度比/.test(joined);

  return (
    <div className={styles.wrap} data-demo-id="demo-compute-bench">
      <div className={styles.head}>
        <span className={styles.title}>平行测定与浓度比计算</span>
        <span className={styles.sub}>数据台 · 第 07 步</span>
      </div>

      <section className={styles.block} data-done={repeated ? "true" : "false"} aria-label="三次平行读数">
        <div className={styles.blockHead}>
          <span>① 三次平行读数</span>
          <span className={styles.state}>{repeated ? "已记录" : "待测定"}</span>
        </div>
        <div className={styles.table} role="table">
          <div className={styles.row} role="row">
            <span className={styles.th} role="columnheader">次数</span>
            <span className={styles.th} role="columnheader">初读数</span>
            <span className={styles.th} role="columnheader">终读数</span>
            <span className={styles.th} role="columnheader">消耗体积</span>
          </div>
          {TRIALS.map((t) => (
            <div key={t.no} className={styles.row} role="row">
              <span className={styles.td} role="cell">第 {t.no} 次</span>
              <span className={styles.mono} role="cell">{repeated ? t.initial : "—"}</span>
              <span className={styles.mono} role="cell">{repeated ? t.final : "—"}</span>
              <span className={`${styles.mono} ${styles.strong}`} role="cell">
                {repeated ? `${t.volume} mL` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block} data-done={recorded ? "true" : "false"} aria-label="平均与极差">
        <div className={styles.blockHead}>
          <span>② 平均消耗与相对极差</span>
          <span className={styles.state}>{recorded ? "已计算" : "待计算"}</span>
        </div>
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>平均消耗 V̄</span>
            <span className={styles.metricValue}>{recorded ? "25.20" : "—"}<small>mL</small></span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>极差</span>
            <span className={styles.metricValue}>{recorded ? "0.04" : "—"}<small>mL</small></span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>相对极差</span>
            <span className={`${styles.metricValue} ${styles.ok}`}>
              {recorded ? "0.16" : "—"}<small>{recorded ? "% ≤ 0.2%" : ""}</small>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.block} data-done={computed ? "true" : "false"} aria-label="浓度比">
        <div className={styles.blockHead}>
          <span>③ 浓度比</span>
          <span className={styles.state}>{computed ? "已求出" : "待求"}</span>
        </div>
        <div className={styles.formula}>
          <span className={styles.eq}>
            c(NaOH) / c(HCl) = V(HCl) / V(NaOH)
          </span>
          <span className={styles.eq}>
            = 25.00 / 25.20 = <strong>{computed ? "0.992" : "?"}</strong>
          </span>
        </div>
        <p className={styles.note}>
          {computed
            ? "浓度大的那方消耗体积小 —— 与 0.992 一致。"
            : "先写公式再代数；注意 c 与 V 成反比，别把体积比直接当浓度比。"}
        </p>
      </section>
    </div>
  );
}
