"use client";

/**
 * 开发者调试面板主体（客户端）：实验总览 + 快捷入口 + 清前测缓存。
 *
 * 仅 /dev 使用；正式页面不引用本目录任何组件。
 */

import Link from "next/link";
import { useState } from "react";
import type { DevEnvInfo, DevExperiment, DevSessionInfo } from "./types";
import { DevSession } from "./dev-session";
import { DevRunInspector } from "./dev-run-inspector";
import { DevHazardList } from "./dev-hazard-list";
import styles from "./devtools.module.css";

const PRE_KEY = (expId: string) => `bopbps:v1:${expId}:pre`;

export function DevPanel({
  env,
  session,
  experiments,
}: {
  env: DevEnvInfo;
  session: DevSessionInfo;
  experiments: DevExperiment[];
}) {
  const [message, setMessage] = useState("");

  function clearOne(expId: string) {
    try {
      window.localStorage.removeItem(PRE_KEY(expId));
      setMessage(`已清 ${expId} 前测缓存`);
    } catch {
      setMessage("localStorage 不可用");
    }
  }

  function clearAll() {
    try {
      for (const exp of experiments) window.localStorage.removeItem(PRE_KEY(exp.id));
      setMessage(`已清 ${experiments.length} 个实验的前测缓存`);
    } catch {
      setMessage("localStorage 不可用");
    }
  }

  return (
    <main className={styles.page} data-dev="panel">
      <header className={styles.header}>
        <div className={styles.kicker}>DEV TOOLS · 仅本地调试</div>
        <h1 className={styles.title}>开发者调试面板</h1>
        <p className={styles.hint} data-dev="env">
          NODE_ENV={env.nodeEnv} · DEVTOOLS={env.flag ?? "(未设置)"} · 生产默认整页 404，全站无入口
        </p>
        <div className={styles.row}>
          <button type="button" className="btn btn--secondary" onClick={clearAll} data-dev="clear-all-pre">
            清全部前测缓存
          </button>
          <Link className={styles.link} href="/experiments">
            实验列表
          </Link>
          <Link className={styles.link} href="/teacher">
            教师端
          </Link>
          {message ? (
            <span className={styles.message} role="status" data-dev="panel-message">
              {message}
            </span>
          ) : null}
        </div>
      </header>

      <DevSession session={session} />
      <DevRunInspector />

      <section className={styles.card} data-dev="experiments">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>实验总览（{experiments.length}）</h2>
          <span className={styles.hint}>点「跳过前测进操作台」= /exp/&lt;id&gt;?force=1</span>
        </div>

        <div className={styles.list}>
          {experiments.map((exp) => (
            <article key={exp.id} className={styles.exp} data-dev-exp={exp.id}>
              <div className={styles.expHead}>
                <span className={styles.expId}>{exp.id}</span>
                <span className={styles.expTitle}>{exp.title}</span>
                <span className={styles.badge}>{exp.steps} 步</span>
                <span className={exp.playable ? styles.badgeOk : styles.badgeOff}>
                  {exp.playable ? "可玩" : "无定义"}
                </span>
                <span className={styles.badge}>
                  {exp.currentRun ? `run ${exp.currentRun.runId.slice(0, 8)}` : "无进行中 run"}
                </span>
              </div>

              <div className={styles.row}>
                <Link className={styles.link} href={`/exp/${exp.id}?force=1`} data-dev="skip-pre">
                  跳过前测进操作台
                </Link>
                <Link className={styles.link} href={`/exp/${exp.id}/report`} data-dev="report">
                  报告页
                </Link>
                <Link className={styles.link} href={`/exp/${exp.id}?demo=1`} data-dev="demo">
                  自动演示
                </Link>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => clearOne(exp.id)}
                  data-dev="clear-pre"
                >
                  清前测缓存
                </button>
              </div>

              <DevHazardList experimentId={exp.id} hazards={exp.hazards} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
