import { describe, expect, it } from "vitest";
import {
  BUBBLE_COUNT,
  BUBBLE_MAX_MS,
  BUBBLE_MIN_MS,
  vesselBubbles,
} from "./vessel-paint";
import type { SceneVesselKind } from "./types";

const KINDS: readonly SceneVesselKind[] = ["flask", "beaker", "volumetric", "tube", "dish"];

describe("器皿常驻气泡（2.5D 液体质感）", () => {
  it("每个液体容器 3~6 个气泡，滴定管不画", () => {
    for (const kind of KINDS) {
      const bubbles = vesselBubbles(kind);
      expect(bubbles.length).toBe(BUBBLE_COUNT);
      expect(bubbles.length).toBeGreaterThanOrEqual(3);
      expect(bubbles.length).toBeLessThanOrEqual(6);
    }
    expect(vesselBubbles("burette")).toEqual([]);
  });

  it("周期落在 6~9s，只做 transform 上浮", () => {
    for (const kind of KINDS) {
      for (const bubble of vesselBubbles(kind)) {
        expect(bubble.durationMs).toBeGreaterThanOrEqual(BUBBLE_MIN_MS);
        expect(bubble.durationMs).toBeLessThanOrEqual(BUBBLE_MAX_MS);
        expect(bubble.rise).toBeGreaterThan(0);
        expect(bubble.r).toBeGreaterThan(0);
      }
    }
  });

  it("延迟彼此错开（不是整齐划一的一个节奏）", () => {
    for (const kind of KINDS) {
      const delays = vesselBubbles(kind).map((b) => b.delayMs);
      expect(new Set(delays).size).toBeGreaterThanOrEqual(4);
      expect(new Set(vesselBubbles(kind).map((b) => b.durationMs)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it("结果确定：同一 kind 调用两次完全一致（SSR 安全）", () => {
    for (const kind of KINDS) {
      expect(vesselBubbles(kind)).toEqual(vesselBubbles(kind));
    }
  });

  it("气泡都落在器皿液体的纵向范围内", () => {
    const flask = vesselBubbles("flask");
    for (const bubble of flask) {
      expect(bubble.cy).toBeGreaterThanOrEqual(164);
      expect(bubble.cy).toBeLessThanOrEqual(174);
      expect(bubble.cx).toBeGreaterThanOrEqual(40);
      expect(bubble.cx).toBeLessThanOrEqual(114);
    }
    const tube = vesselBubbles("tube");
    for (const bubble of tube) {
      expect(bubble.cx).toBeGreaterThanOrEqual(13);
      expect(bubble.cx).toBeLessThanOrEqual(26);
    }
  });
});
