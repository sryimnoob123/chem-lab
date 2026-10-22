"use client";

/**
 * 主题选择（P0）：进拼接实验先挑一个真实情境，再进画布。
 *
 * 卡片只给三件事：背景一句、目标一句、2~3 条硬约束（AGENTS 9.9：一层文字，
 * 层级靠布局而不是再加一行说明）。选完进画布，素材库按主题把相关块置顶。
 */

import { PLAN_TOPICS, type PlanTopic } from "@/lib/plan/topics";
import s from "./plan.module.css";

export function TopicPicker({ onPick }: { onPick: (topic: PlanTopic) => void }) {
  return (
    <section className={s.topicWrap} aria-label="选择实验主题">
      {/* 一行说清操作；「规则会告诉你哪里不行」放到卡片后的评分卡里说，不在这里重复 */}
      <p className={s.lead}>选一个主题，再从素材库拼出方案。</p>
      <div className={s.topicGrid}>
        {PLAN_TOPICS.map((topic, index) => (
          <button
            key={topic.id}
            type="button"
            className={s.topicCard}
            data-demo-id={`demo-topic-${topic.id}`}
            onClick={() => onPick(topic)}
          >
            <span className={s.topicNo}>{String(index + 1).padStart(2, "0")}</span>
            <span className={s.topicTitle}>{topic.title}</span>
            {/* 情境一行（超长省略，悬停看全）；目标句进画布后由主题页头承担，卡片不重复 */}
            <span className={s.topicScene} title={topic.scene}>
              {topic.scene}
            </span>
            <span className={s.topicRules}>
              {topic.constraints.map((line) => (
                <span key={line} className={s.topicRule} title={line}>
                  {line}
                </span>
              ))}
            </span>
            <span className={s.topicCta}>选这个主题 →</span>
          </button>
        ))}
      </div>
    </section>
  );
}
