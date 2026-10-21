"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./workbench.module.css";

export interface DockExperiment {
  id: string;
  no: string;
  short: string;
  open: boolean;
}

/** 10 个实验的固定顺序；只有已开放项可跳转。 */
export const DOCK_EXPERIMENTS: readonly DockExperiment[] = [
  { id: "exp01", no: "01", short: "仪器认领", open: false },
  { id: "exp02", no: "02", short: "氯化钠制备", open: false },
  { id: "exp08", no: "08", short: "称量练习", open: false },
  { id: "exp03", no: "03", short: "醋酸电离", open: false },
  { id: "exp04", no: "04", short: "沉淀平衡", open: false },
  { id: "exp05", no: "05", short: "氧化还原", open: false },
  { id: "exp06", no: "06", short: "配合物", open: false },
  { id: "exp07", no: "07", short: "阳离子鉴定", open: false },
  { id: "exp09", no: "09", short: "酸碱标液", open: true },
  { id: "exp10", no: "10", short: "盐酸标定", open: false },
];

type ExperimentDockProps = {
  currentId: string;
  onNotice: (text: string) => void;
};

export function ExperimentDock({ currentId, onNotice }: ExperimentDockProps) {
  const router = useRouter();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [currentId]);

  return (
    <nav className={styles.dock} aria-label="实验切换">
      <span className={styles.dockLabel}>实验</span>
      <ol className={styles.dockList}>
        {DOCK_EXPERIMENTS.map((experiment) => {
          const active = experiment.id === currentId;
          return (
            <li key={experiment.id}>
              <button
                ref={active ? activeRef : undefined}
                type="button"
                className={`${styles.dockItem} ix`}
                data-active={active ? "true" : "false"}
                data-open={experiment.open ? "true" : "false"}
                data-demo-id={`demo-switch-${experiment.id}`}
                aria-current={active ? "page" : undefined}
                aria-label={`${experiment.no} ${experiment.short}${experiment.open ? "" : "，待开放"}`}
                onClick={() => {
                  if (active) return;
                  if (!experiment.open) {
                    onNotice(`实验 ${experiment.no} 待开放，先完成当前实验。`);
                    return;
                  }
                  router.push(`/exp/${experiment.id}`);
                }}
              >
                <span className={styles.dockNo}>{experiment.no}</span>
                <span className={styles.dockName}>{experiment.short}</span>
                <span className={styles.dockDot} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
