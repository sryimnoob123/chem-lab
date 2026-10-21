"use client";

/**
 * 进实验前的 4 步新手教学。
 *
 * 为什么需要：用户反馈"学生一进来就不知道要干什么"。看板给的是"这一步做什么"，
 * 但第一次进来的人连"能拖、会重做、提示在哪"都不知道，所以先给一次总览。
 *
 * 行为约定：
 * - 不传 `open` = 自动模式：没看过就自动弹，看过就不再打扰（localStorage 记）。
 * - 传 `open` = 受控模式：由外部决定显隐（教师/重看入口用）。
 * - Esc 关闭、Enter/→ 下一步、← 上一步、Tab 在卡内循环。
 * - 所有按钮 min-height 44px；reduce-motion 下只淡入。
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./onboarding.module.css";
import {
  ONBOARDING_KEY,
  hasSeenOnboarding,
  markOnboardingSeen,
  type OnboardingStorage,
} from "./storage";

type OnboardingStep = {
  /** 一句话标题（≤10 字） */
  title: string;
  /** 一句解释（≤40 字） */
  desc: string;
  icon: ReactNode;
};

const ICONS = {
  drag: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M7 3v7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 10l3-3M7 10L4 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="8" width="6" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
    </svg>
  ),
  retry: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M5 12a7 7 0 1 0 2.5-5.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 5v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 9h16" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 13h6M8 16h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
} as const;

const STEPS: readonly OnboardingStep[] = [
  {
    title: "把试剂拖到锥形瓶上",
    desc: "左边试剂架上的瓶子可以直接拖。松手之后先看动画，再听结果。",
    icon: ICONS.drag,
  },
  {
    title: "看结果条，不用猜",
    desc: "绿条 = 这步对了，会自己往下走；红条 = 这步不对，会告诉你为什么。",
    icon: ICONS.play,
  },
  {
    title: "错了就重做，不扣已得的分",
    desc: "按提示重做这一步即可。事故会记一笔，但后面的步骤照常继续。",
    icon: ICONS.retry,
  },
  {
    title: "不知道干什么，看左上角",
    desc: "左上角看板写着「现在该做什么」；还是不懂就按 H 取一条提示。",
    icon: ICONS.board,
  },
];

export type ExperimentOnboardingProps = {
  /** 受控显隐；不传则按 localStorage 自动决定 */
  open?: boolean;
  /** 关闭（完成或跳过）后回调 */
  onDone?: () => void;
  /** 自定义存储键（多实验分别记忆时用） */
  storageKey?: string;
};

function readStorage(): OnboardingStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function ExperimentOnboarding({
  open,
  onDone,
  storageKey = ONBOARDING_KEY,
}: ExperimentOnboardingProps) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const controlled = open !== undefined;

  // 自动模式：挂载后再读 localStorage，避免 SSR/hydration 不一致。
  // 用 setTimeout(0) 而不是同步 setState：Next 16 的 react-hooks 规则会把
  // effect 里同步 setState 判成级联渲染（eslint error）。
  useEffect(() => {
    if (controlled) {
      const t = window.setTimeout(() => setVisible(Boolean(open)), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      if (!hasSeenOnboarding(readStorage(), storageKey)) setVisible(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [controlled, open, storageKey]);

  // 打开时把焦点移进卡片，屏幕阅读器才知道拦到哪了
  useEffect(() => {
    if (visible) cardRef.current?.focus();
  }, [visible]);

  const close = useCallback(() => {
    markOnboardingSeen(readStorage(), storageKey);
    setVisible(false);
    setIndex(0);
    onDone?.();
  }, [onDone, storageKey]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= STEPS.length - 1) {
        markOnboardingSeen(readStorage(), storageKey);
        setVisible(false);
        onDone?.();
        return 0;
      }
      return i + 1;
    });
  }, [onDone, storageKey]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      } else if (event.key === "Tab") {
        // 简单焦点循环：不让 Tab 跑到遮罩后面的实验台上
        const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    },
    [back, close, next],
  );

  if (!visible) return null;
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  return (
    <div className={styles.backdrop}>
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-demo-id="demo-onboarding"
      >
        <button type="button" className={styles.close} onClick={close} aria-label="关闭新手教学">
          ✕
        </button>

        <div className={styles.kicker}>
          <span>
            第 {index + 1} / {STEPS.length} 步 · 开始之前
          </span>
          <span className={styles.dots} aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={styles.dot} data-active={i === index} />
            ))}
          </span>
        </div>

        <div className={styles.body}>
          <span className={styles.icon}>{step.icon}</span>
          <div className={styles.text}>
            <h2 id={titleId} className={styles.title}>
              {step.title}
            </h2>
            <p className={styles.desc}>{step.desc}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={close}>
            跳过，直接开始
          </button>
          <button
            type="button"
            className={styles.next}
            onClick={next}
            data-demo-id="demo-onboarding-next"
          >
            {isLast ? "知道了，开始实验" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
