"use client";

/**
 * MissionBoard —— 左上角的小任务看板（2026-10-21 用户要求）。
 *
 * 默认只有 4 行，看一眼就知道"这次做什么、走到哪、这一步干什么"：
 *   实验 09 · 酸碱标准溶液的配制与浓度比较
 *   三次平行滴定，极差 ≤0.2%              ← 一句话目标
 *   ▪▪▪▫▫▫▫ 第 2/7 步 · 现在该称量了        ← 只要进度，不列细则
 *   ▸ 差减法称 Na₂CO₃                      ← 当前一步一句指引（≤20 字）
 *
 * 详细流程 / 参数 / 提示 / 老师会说全在折叠区（默认收起）。
 * 整张卡的头就是一个按钮：点卡片 = 展开「详情」，省掉一行常驻控件。
 * 纸白底 + 1px 线 + 圆角 2px：像贴在实验台边上的一张任务卡，不跟暗场抢注意力。
 */

import { useId, useState, type ReactNode } from "react";
import { MissionBoardDetails } from "./mission-board-details";
import type { StepDotState } from "./copy";
import styles from "./mission-board.module.css";

export interface MissionStep {
  index: number;
  title: string;
}

/** 折叠区的一格参数（读数 / 误差 / 观察 / 违规）：只渲染，不含判定。 */
export interface MissionParam {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone?: "normal" | "warn";
}

export interface MissionHint {
  /** 提示阶梯 1~3（0 = 本步还没取） */
  level: number;
  /** 本步是否已取过提示（第四行已被提示占用） */
  active: boolean;
  /** 取提示会扣独立完成分 */
  deduct: boolean;
  /** 本步已用次数（0~max） */
  used: number;
  /** 每步上限（三级阶梯 = 3） */
  max: number;
  /** 本步已用完：灯泡置灰、文案“本步提示已用完” */
  exhausted: boolean;
  /** 下一次提示会扣多少分（1/3/5；用完为 0） */
  nextDeduct: number;
  onAsk?: () => void;
}

export interface MissionBoardProps {
  /** 实验号，如 "09" */
  expNo: string;
  title: string;
  /** 一句话目标（≤20 字） */
  goal: string;
  /** 进度行；格式 `第 2/7 步 · 现在该称量了`（walk-steps 依赖） */
  progress: string;
  /** 当前一步的一句指引（≤20 字） */
  guide: string;
  dots: readonly StepDotState[];
  /** 折叠区的详细流程 */
  steps?: readonly MissionStep[];
  /** 已完成步骤用时（秒） */
  seconds?: Readonly<Record<number, number>>;
  onPeek?: (index: number) => void;
  /** 折叠区参数格 */
  params?: readonly MissionParam[];
  hint?: MissionHint;
  /** 折叠区最后一行：老师会说 */
  note?: { label: string; text: string };
  done?: boolean;
  /** 折叠区尾部额外内容（预留挂载位，如新手教学入口） */
  footer?: ReactNode;
}


export function MissionBoard({
  expNo,
  title,
  goal,
  progress,
  guide,
  dots,
  steps,
  seconds,
  onPeek,
  params,
  hint,
  note,
  done = false,
  footer,
}: MissionBoardProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <section
      className={styles.board}
      data-demo-id="demo-mission-board"
      data-open={open ? "true" : "false"}
      data-done={done ? "true" : "false"}
      aria-label="任务看板"
    >
      <button
        type="button"
        className={`${styles.head} ix`}
        data-board-toggle="true"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.rowHead}>
          <span className={styles.expNo}>实验 {expNo}</span>
          <span className={styles.title}>{title}</span>
          <span className={styles.toggle}>
            <span className={styles.toggleText}>{open ? "收起" : "详情"}</span>
            <span className={styles.caret} data-open={open ? "true" : "false"} aria-hidden="true">
              ▾
            </span>
          </span>
        </span>
        <span className={styles.goal}>{goal}</span>
        <span className={styles.rowProgress}>
          <span className={styles.dots} aria-hidden="true">
            {dots.map((state, index) => (
              <span key={index} className={styles.dot} data-state={state} />
            ))}
          </span>
          <span className={styles.progress} data-demo-id="demo-guide-progress">
            {progress}
          </span>
        </span>
        <span className={styles.guide} aria-live="polite">
          <span className={styles.guideMark} aria-hidden="true" />
          <span className={styles.guideText}>{guide}</span>
        </span>
      </button>

      {open ? (
        <div className={styles.detail} id={detailId}>
          <MissionBoardDetails
            steps={steps}
            dots={dots}
            seconds={seconds}
            onPeek={onPeek}
            params={params}
            hint={hint}
            note={note}
            done={done}
            footer={footer}
          />
        </div>
      ) : null}
    </section>
  );
}
