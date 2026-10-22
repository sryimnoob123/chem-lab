"use client";

/**
 * 失败动画演示（独立页，用户 2026-10-22）：
 * 放在实验台里会挡住操作，所以单独开一页 —— 演示时切过来逐条点，
 * 每条都写清「触发条件」，学生知道这不是随机爆炸，是做了某个动作才炸的。
 */
import { useState } from "react";
import Link from "next/link";
import { FxByKey } from "@/components/exp/scene/fx";
import type { FxKey as EngineFxKey } from "@/lib/engine.types";
import type { FxKey as SceneFxKey } from "@/lib/scene/fx";
import styles from "./fx-demo.module.css";

const TO_SCENE: Record<EngineFxKey, SceneFxKey> = {
  "boil-over": "boilOver",
  explosion: "explosion",
  "toxic-gas": "toxicGas",
  burn: "burn",
  "glass-break": "glassBreak",
  fire: "fire",
  "heavy-metal": "heavyMetal",
  "device-accident": "deviceAccident",
};

type Level = "L2" | "L3" | "L4";

const ITEMS: readonly {
  fx: EngineFxKey;
  name: string;
  level: Level;
  trigger: string;
  result: string;
}[] = [
  {
    fx: "explosion",
    name: "爆炸",
    level: "L4",
    trigger: "把水倒进浓硫酸里（而不是酸入水）",
    result: "局部剧烈放热、液体沸腾冲溅，终止实验",
  },
  {
    fx: "toxic-gas",
    name: "有毒气体",
    level: "L3",
    trigger: "在开放台面上做产气反应，不进通风橱",
    result: "刺激性气体扩散，必须撤离并开通风",
  },
  {
    fx: "fire",
    name: "着火",
    level: "L4",
    trigger: "有机溶剂（乙醇/乙醚）靠近明火或电炉",
    result: "容器口起火，用湿布或沙土覆盖，禁止用水",
  },
  {
    fx: "boil-over",
    name: "暴沸",
    level: "L3",
    trigger: "加热未加沸石，或局部过热后搅动",
    result: "液体瞬间冲出容器，烫伤并损失样品",
  },
  {
    fx: "glass-break",
    name: "器皿破裂",
    level: "L3",
    trigger: "热容量瓶骤冷；或用玻璃棒戳洗薄壁器皿",
    result: "瓶壁裂纹扩散、刻度失效，本步作废",
  },
  {
    fx: "burn",
    name: "灼伤",
    level: "L2",
    trigger: "徒手取刚加热过的坩埚/烧杯",
    result: "皮肤烫伤，须冷水冲淋 15 分钟",
  },
  {
    fx: "device-accident",
    name: "仪器事故",
    level: "L3",
    trigger: "天平超载；或液体溅入仪器内部",
    result: "传感器失准、示数漂移，须报修并重新校准",
  },
  {
    fx: "heavy-metal",
    name: "重金属污染",
    level: "L2",
    trigger: "含铅/汞废液直接倒入下水道",
    result: "环境污染，须倒入重金属废液桶",
  },
];

export default function FxDemoPage() {
  const [active, setActive] = useState<EngineFxKey | null>(null);
  const current = ITEMS.find((i) => i.fx === active) ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>失败动画演示</h1>
          <p className={styles.sub}>
            每一条都对应实验里的一个真实错误操作。选左边，看右边。
          </p>
        </div>
        <Link className={styles.back} href="/experiments">
          返回实验列表
        </Link>
      </header>

      <div className={styles.body}>
        <ul className={styles.list}>
          {ITEMS.map((item) => (
            <li key={item.fx}>
              <button
                type="button"
                className={styles.item}
                data-active={active === item.fx || undefined}
                data-demo-id={`demo-fx-${item.fx}`}
                onClick={() => setActive(item.fx)}
              >
                <span className={styles.itemHead}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.level} data-level={item.level}>
                    {item.level}
                  </span>
                </span>
                <span className={styles.trigger}>{item.trigger}</span>
              </button>
            </li>
          ))}
        </ul>

        <section className={styles.stage} aria-live="polite">
          {current ? (
            <>
              <div className={styles.stageHead}>
                <strong className={styles.stageName}>{current.name}</strong>
                <span className={styles.stageLevel} data-level={current.level}>
                  {current.level}
                </span>
              </div>
              <div className={styles.fxBox}>
                <FxByKey key={current.fx} fx={TO_SCENE[current.fx]} level={current.level} active scale="inline" />
              </div>
              <dl className={styles.meta}>
                <div>
                  <dt>触发条件</dt>
                  <dd>{current.trigger}</dd>
                </div>
                <div>
                  <dt>后果</dt>
                  <dd>{current.result}</dd>
                </div>
              </dl>
              <button type="button" className={styles.replay} onClick={() => setActive(null)}>
                停止
              </button>
            </>
          ) : (
            <p className={styles.empty}>左边选一项，这里播放对应的失败动画。</p>
          )}
        </section>
      </div>
    </main>
  );
}
