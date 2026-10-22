import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { anchorOf } from "./geometry";
import { INCIDENT_TIMING, INCIDENT_TOTAL_MS, buildIncident } from "./incident";
import type { IncidentFx } from "./incident-art";

/**
 * 事故演出的时间线约束（用户 2026-10-23 的验收口径）：
 *   1. 中途炸 —— 出事的那段画面不能早于 lead 出现；
 *   2. 液面连续 —— 液体层的首帧与末帧必须是同一高度（前后不跳变）；
 *   3. 同一套资源 —— 全部画在器身 clipPath 里、只用 scene token，没有第二个小场景；
 *   4. 只动 transform / opacity（不动 width/height/top/left）。
 */

const anchor = anchorOf("volumetric");
if (!anchor) throw new Error("volumetric 不在 SCENE_VESSELS 里，几何数据坏了");

const ALL_FX: readonly IncidentFx[] = ["glassBreak", "explosion", "boilOver", "fire", "burn", "toxicGas"];

/** 事故那一半才出现的图层（lead 之前不该动） */
const HAZARD_SELECTORS = [
  '[data-i="crack"]',
  '[data-i="shard-',
  '[data-i="drop-',
  '[data-i="ring"]',
  '[data-i="ring2"]',
  '[data-i="flash"]',
  '[data-i="foam"]',
  '[data-i="blast"]',
  '[data-i="overflow"]',
  '[data-i="scald"]',
  '[data-i="gas"]',
];

const isHazardSelector = (sel: string) => HAZARD_SELECTORS.some((prefix) => sel.startsWith(prefix));

function translateY(frame: Keyframe): number {
  const match = String(frame.transform ?? "").match(/translateY\((-?[\d.]+)px\)/);
  return match ? Number(match[1]) : Number.NaN;
}

describe("buildIncident 时间线", () => {
  it("总时长 = 起手 + 出事 + 余波；事故在 lead 处、余波在 lead+hazard 处回调", () => {
    const scene = buildIncident(anchor, { fx: "glassBreak", op: "poke", clipId: "c1", baseLevel: 0.38 });
    expect(scene.ms).toBe(INCIDENT_TOTAL_MS);
    expect(INCIDENT_TOTAL_MS).toBe(INCIDENT_TIMING.lead + INCIDENT_TIMING.hazard + INCIDENT_TIMING.settle);
    expect(scene.cues?.map((cue) => [cue.kind, cue.at])).toEqual([
      ["impact", INCIDENT_TIMING.lead],
      ["settle", INCIDENT_TIMING.lead + INCIDENT_TIMING.hazard],
    ]);
    // 「中途」= 起手段占整条时间线的 1/3 左右（不是做完再炸）
    expect(INCIDENT_TIMING.lead / INCIDENT_TOTAL_MS).toBeGreaterThan(0.28);
    expect(INCIDENT_TIMING.lead / INCIDENT_TOTAL_MS).toBeLessThan(0.4);
  });

  it("出事那一段的图层全部从 lead 之后才开始动（中途炸，不是先炸后演）", () => {
    for (const fx of ALL_FX) {
      const scene = buildIncident(anchor, { fx, op: "pour", clipId: `c-${fx}`, baseLevel: 0.38 });
      for (const beat of scene.beats) {
        if (!isHazardSelector(beat.sel)) continue;
        expect(beat.delay ?? 0, `${fx} ${beat.sel}`).toBeGreaterThanOrEqual(INCIDENT_TIMING.lead);
      }
    }
  });

  it("液面连续：液体层首帧与末帧同高（事故前后不跳变），倒液/暴沸时中间要真的涨过", () => {
    for (const fx of ALL_FX) {
      const scene = buildIncident(anchor, { fx, op: "pour", clipId: `c-${fx}`, baseLevel: 0.38 });
      const liquid = scene.beats.find((beat) => beat.sel === '[data-i="liquid"]');
      expect(liquid, fx).toBeTruthy();
      const frames = liquid?.frames ?? [];
      expect(translateY(frames[0])).toBe(translateY(frames[frames.length - 1]));
      const shifts = frames.map((frame) => translateY(frame)).filter((value) => Number.isFinite(value));
      expect(new Set(shifts).size, fx).toBeGreaterThan(1);
    }
  });

  it("空器皿干烧：液面一直为空（加热空烧杯不该凭空长出液体）", () => {
    const scene = buildIncident(anchor, { fx: "glassBreak", op: "heat", clipId: "c-empty", baseLevel: 0 });
    const liquid = scene.beats.find((beat) => beat.sel === '[data-i="liquid"]');
    const shifts = new Set((liquid?.frames ?? []).map((frame) => translateY(frame)));
    expect(shifts.size).toBe(1);
  });

  it("只动 transform / opacity（不动布局属性）", () => {
    const allowed = new Set(["transform", "opacity", "offset", "easing"]);
    for (const fx of ALL_FX) {
      const scene = buildIncident(anchor, { fx, op: "heat", clipId: `c-${fx}`, baseLevel: 0.38 });
      for (const beat of scene.beats) {
        for (const frame of beat.frames) {
          for (const key of Object.keys(frame)) expect(allowed.has(key), `${fx} 动了 ${key}`).toBe(true);
        }
      }
    }
  });
});

describe("buildIncident 复用实验台资源", () => {
  it("液体 / 裂纹在器身 clipPath 里，颜色全走 --scene-* token", () => {
    const scene = buildIncident(anchor, { fx: "glassBreak", op: "poke", clipId: "clip-x", baseLevel: 0.38 });
    const html = renderToStaticMarkup(scene.node as React.ReactElement);
    // 同一个 clipPath 裁液体（和倾倒/搅拌同一套画法）
    expect(html).toContain('clip-path="url(#clip-x)"');
    expect(html).toContain("<clipPath");
    expect(html).toContain('data-i="liquid"');
    expect(html).toContain("var(--scene-water)");
    // 裂纹 + 碎片用事故 token，不用白色高光
    expect(html).toContain('data-i="crack"');
    expect(html).toContain("var(--scene-crack)");
    expect(html).toContain('data-i="shard-0"');
    expect(html).not.toContain("fill=\"#fff\"");
    // 没有第二个视口/独立小场景
    expect(html).not.toContain("viewBox");
  });

  it("每种事故都能在器皿上画出画面（6 种全非空）", () => {
    for (const fx of ALL_FX) {
      const scene = buildIncident(anchor, { fx, op: "pour", clipId: `c-${fx}`, baseLevel: 0 });
      const html = renderToStaticMarkup(scene.node as React.ReactElement);
      expect(html.length, fx).toBeGreaterThan(400);
      expect(scene.beats.length, fx).toBeGreaterThan(1);
    }
  });

  it("起手动作不同，画面不同（倒液有液柱、加热有火焰、捅洗有玻璃棒）", () => {
    const pour = renderToStaticMarkup(
      buildIncident(anchor, { fx: "glassBreak", op: "pour", clipId: "a", baseLevel: 0.38 }).node as React.ReactElement,
    );
    const heat = renderToStaticMarkup(
      buildIncident(anchor, { fx: "glassBreak", op: "heat", clipId: "a", baseLevel: 0.38 }).node as React.ReactElement,
    );
    const poke = renderToStaticMarkup(
      buildIncident(anchor, { fx: "glassBreak", op: "poke", clipId: "a", baseLevel: 0.38 }).node as React.ReactElement,
    );
    expect(pour).toContain('data-i="stream"');
    expect(heat).toContain('data-i="flame"');
    expect(poke).toContain('data-i="rod"');
    expect(pour).not.toBe(poke);
  });
});
