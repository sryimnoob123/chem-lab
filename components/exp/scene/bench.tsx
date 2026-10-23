"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventBar } from "@/components/ui";
import { getSceneVessel, SCENE_VESSELS, VESSEL_SEED } from "@/lib/scene/palette";
import { getSceneReagent } from "@/lib/scene/reagents";
import { resolveDrop } from "@/lib/scene/resolve";
import { tapFeedback } from "@/lib/scene/haptics";
import type { SceneOutcome } from "@/lib/scene/types";
import { BenchScene, type BenchReaction, type SceneFeedback } from "./bench-scene";
import { ReagentRack } from "./reagent-rack";
import styles from "./scene.module.css";

type Contents = Readonly<Record<string, readonly string[]>>;

/** 演示导演台用的纯事件 API：不经过真实拖拽也能把场景摆到指定状态。 */
type DemoSceneApi = { add: (reagentId: string, vesselId: string) => void; reset: () => void };

function initialContents(): Contents {
  const out: Record<string, readonly string[]> = {};
  for (const vessel of SCENE_VESSELS) out[vessel.id] = [...(VESSEL_SEED[vessel.id] ?? [])];
  return out;
}

/**
 * QA / 截图专用：`?contents=beaker=naoh,cuso4,water;flask=nacl` 直接把器皿摆到指定状态。
 *
 * 为什么需要：有些状态**用拖拽走不到**（现象表按组合精确匹配，拖进去的第二瓶多半是 MISS），
 * 但视觉上必须验得到 —— 比如「液体 + 器底沉淀」这一态，现有种子数据里没有任何一条路径能到。
 * 只在 URL 带参数时生效，不动拖拽/判定逻辑；挂载后一次性写入，避免 SSR 水合不一致。
 */
function contentsFromQuery(): Contents | null {
  const raw = new URLSearchParams(window.location.search).get("contents");
  if (!raw) return null;
  const out: Record<string, readonly string[]> = {};
  for (const entry of raw.split(";")) {
    const [id, list] = entry.split("=");
    if (!id || !list) continue;
    const vesselId = id.trim();
    if (!getSceneVessel(vesselId)) continue;
    out[vesselId] = list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * 拖拽反应场景（父组件）：
 * 试剂架 + 实验台 + 事件条。拖拽、点选、键盘三条路径都汇到 addReagent。
 */
export function ReactionScene() {
  const [contents, setContents] = useState<Contents>(initialContents);
  const [reaction, setReaction] = useState<BenchReaction | null>(null);
  const [revealed, setRevealed] = useState<SceneOutcome | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SceneFeedback | null>(null);
  const addRef = useRef<(reagentId: string, vesselId: string) => void>(() => undefined);
  const resetRef = useRef<() => void>(() => undefined);
  const presetDone = useRef(false);

  const selected = selectedId ? getSceneReagent(selectedId) : undefined;

  const addReagent = useCallback(
    (reagentId: string, vesselId: string) => {
      const vessel = getSceneVessel(vesselId);
      const reagent = getSceneReagent(reagentId);
      if (!vessel || !reagent) return;

      const alreadyIn = contents[vesselId] ?? [];
      const outcome = resolveDrop(vessel, reagent, alreadyIn);

      setSelectedId(null);
      setDraggingId(null);

      if (!outcome.ok) {
        // 失败分支：立刻抖一下 + 事件条给规范文案，不等任何异步
        setFeedback({ vesselId, kind: "reject", key: Date.now() });
        tapFeedback(12);
        setNotice(outcome.caption);
        setRevealed(null);
        setReaction(null);
        return;
      }

      // 成功分支：先给手感（弹一下 + 光环），事件条同一帧出结果，现象动画随后接上
      setFeedback({ vesselId, kind: "success", key: Date.now() });
      tapFeedback(8);
      setNotice(null);
      setRevealed(outcome);
      setContents((prev) => ({ ...prev, [vesselId]: [...alreadyIn, reagentId] }));
      setReaction({ vesselId, outcome, key: Date.now() });
    },
    [contents],
  );

  const handleDrop = useCallback(
    (vesselId: string) => {
      const reagentId = draggingId ?? selectedId;
      if (!reagentId) return;
      addReagent(reagentId, vesselId);
    },
    [addReagent, draggingId, selectedId],
  );

  /** 点选路径与拖拽路径共用 handleDrop（同一个投放 handler，不写两份）。 */
  const handleActivate = useCallback(
    (vesselId: string) => {
      if (!selectedId) {
        setNotice("先点选一种试剂，再点器皿；也可以直接把试剂拖过去。");
        return;
      }
      handleDrop(vesselId);
    },
    [handleDrop, selectedId],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setNotice(null);
  }, []);

  // Esc 取消已选试剂
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onReveal = useCallback((outcome: SceneOutcome) => {
    setRevealed(outcome);
  }, []);

  const toggleSelect = useCallback((reagentId: string) => {
    setSelectedId((current) => (current === reagentId ? null : reagentId));
    setNotice(null);
  }, []);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const reset = useCallback(() => {
    setContents(initialContents());
    setReaction(null);
    setRevealed(null);
    setSelectedId(null);
    setDraggingId(null);
    setNotice(null);
    setFeedback(null);
  }, []);

  useEffect(() => {
    resetRef.current = reset;
  }, [reset]);

  const eventText =
    revealed?.caption ??
    (reaction ? "反应进行中……" : notice) ??
    "拖一瓶试剂到器皿上，或先点试剂、再点器皿；试管 A 装稀盐酸、试管 B 装硫氰酸钾。";

  // 演示钩子：?demo=1 直接置状态；window.__chemLabDemoScene 供导演台脚本调用
  useEffect(() => {
    addRef.current = addReagent;
  }, [addReagent]);

  // QA 钩子：`?contents=` 挂载后一次性覆盖种子内容物（见 contentsFromQuery）
  useEffect(() => {
    const seeded = contentsFromQuery();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 参数只在挂载后读一次，避免 SSR 水合不一致
    if (seeded) setContents((prev) => ({ ...prev, ...seeded }));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!presetDone.current) {
      presetDone.current = true;
      if (q.get("demo") === "1") {
        try {
          const reagent = q.get("reagent") ?? "agno3";
          const vessel = q.get("vessel") ?? "flask";
          if (getSceneReagent(reagent) && getSceneVessel(vessel)) addRef.current(reagent, vessel);
        } catch {
          /* 预设失败不影响正常页面 */
        }
      }
    }
    const host = window as Window & { __chemLabDemoScene?: DemoSceneApi };
    host.__chemLabDemoScene = {
      add: (reagentId, vesselId) => addRef.current(reagentId, vesselId),
      reset: () => resetRef.current(),
    };
    return () => {
      delete host.__chemLabDemoScene;
    };
  }, []);

  const hintText = revealed?.note ?? (selected ? `已选中 ${selected.name}（${selected.formula}）· ${selected.unit}` : undefined);

  return (
    <section className={styles.scene} aria-label="拖拽反应实验台" data-demo-id="demo-scene-root">
      <ReagentRack
        selectedId={selectedId}
        draggingId={draggingId}
        onSelect={toggleSelect}
        onDragStart={setDraggingId}
        onDragEnd={() => setDraggingId(null)}
      />

      <div className={styles.stageCol} data-demo-id="demo-scene-board">
        <div className={styles.stageTop}>
          <p className={styles.instructions} aria-live="polite">
            {selected ? `已选中 ${selected.name}：拖到器皿上，或再点一下器皿` : "拖试剂瓶到器皿上；也可以点试剂、再点器皿"}
          </p>
          <button type="button" className={`ix ${styles.reset}`} onClick={reset}>
            重新开始
          </button>
        </div>

        <BenchScene
          contents={contents}
          reaction={reaction}
          selectedReagentId={selectedId}
            draggingReagentId={draggingId}
          feedback={feedback}
          onFeedbackEnd={clearFeedback}
          onDropReagent={handleDrop}
          onActivateVessel={handleActivate}
          onClearSelection={clearSelection}
          onReveal={onReveal}
        />

        <div className={styles.event} data-demo-id="demo-scene-event" data-state={revealed ? "hit" : notice ? "miss" : "idle"}>
          <EventBar
            state={notice && !revealed ? "warn" : "info"}
            text={eventText}
            hint={hintText}
          />
        </div>

        <p className={styles.footnote}>
          试剂色取真实溶液色；滴定管只装标准溶液，不接受直接投加。所有现象来自课程现象表，未收录组合只提示、不编反应。
        </p>
      </div>
    </section>
  );
}
