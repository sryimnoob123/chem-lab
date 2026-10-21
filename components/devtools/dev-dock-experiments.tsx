"use client";

/**
 * Dev Dock 的实验直达 + 进度锁两组。
 * 纯展示 + 回调；前测状态由父组件从 localStorage 读好传进来。
 */

import Link from "next/link";
import type { DockExperiment, DockRun } from "./dev-dock-types";
import styles from "./dev-dock.module.css";

interface Props {
  experiments: DockExperiment[];
  prePassed: Record<string, boolean>;
  run: DockRun | null;
  busy: boolean;
  onTogglePre: (expId: string, next: boolean) => void;
  onClearAllPre: () => void;
  /** 跳转实验页前收起抽屉，避免挡住操作台 */
  onNavigate?: () => void;
}

export function DevDockExperiments({
  experiments,
  prePassed,
  run,
  busy,
  onTogglePre,
  onClearAllPre,
  onNavigate,
}: Props) {
  return (
    <>
      <section className={styles.section} data-dev="dock-experiments">
        <div className={styles.sectionHead}>
          <h3>实验</h3>
          <button
            type="button"
            className={styles.miniButton}
            onClick={onClearAllPre}
            disabled={busy}
            data-dev="dock-clear-all-pre"
          >
            清全部前测
          </button>
        </div>
        <div className={styles.expGrid}>
          {experiments.map((exp) => (
            <div key={exp.id} className={styles.expRow} data-dock-exp={exp.id}>
              <span className={styles.expId}>{exp.id}</span>
              <span className={styles.expTitle} title={exp.title}>
                {exp.title}
              </span>
              <Link
                className={styles.miniLink}
                href={`/exp/${exp.id}?force=1`}
                data-dev="dock-open-exp"
                data-exp={exp.id}
                onClick={onNavigate}
              >
                进实验
              </Link>
              <Link
                className={styles.miniLink}
                href={`/exp/${exp.id}/report`}
                data-dev="dock-open-report"
                onClick={onNavigate}
              >
                报告
              </Link>
            </div>
          ))}
          {experiments.length === 0 ? <p className={styles.hint}>实验列表加载中…</p> : null}
        </div>
      </section>

      <section className={styles.section} data-dev="dock-progress">
        <div className={styles.sectionHead}>
          <h3>进度锁</h3>
          <span className={styles.hint}>
            {run ? `run ${run.runId.slice(0, 8)} · ${run.experimentId} · ${run.status}` : "无进行中 run"}
          </span>
        </div>
        <div className={styles.lockList}>
          {experiments.map((exp) => {
            const passed = prePassed[exp.id] === true;
            const active = run?.experimentId === exp.id && run.status === "in_progress";
            return (
              <div key={exp.id} className={styles.lockRow} data-dock-lock={exp.id}>
                <span className={styles.expId}>{exp.id}</span>
                <span className={passed ? styles.badgeOn : styles.badgeOff} data-dev="dock-pre-state">
                  {passed ? "前测已解锁" : "前测未解锁"}
                </span>
                <span className={active ? styles.badgeRun : styles.badgeMuted} data-dev="dock-run-state">
                  {active ? "run 进行中" : "—"}
                </span>
                <button
                  type="button"
                  className={styles.miniButton}
                  disabled={busy}
                  onClick={() => onTogglePre(exp.id, true)}
                  data-dev="dock-unlock-pre"
                  data-exp={exp.id}
                >
                  解锁
                </button>
                <button
                  type="button"
                  className={styles.miniButton}
                  disabled={busy}
                  onClick={() => onTogglePre(exp.id, false)}
                  data-dev="dock-reset-pre"
                  data-exp={exp.id}
                >
                  重置
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
