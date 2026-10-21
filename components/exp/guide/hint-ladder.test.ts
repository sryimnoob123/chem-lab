import { describe, expect, it } from "vitest";
import {
  HINT_DEDUCT,
  MAX_HINTS_PER_STEP,
  hintDeductFor,
  hintIndexFor,
  hintTierFor,
  isHintExhausted,
} from "./hint-ladder";

describe("hint ladder", () => {
  it("每步最多 3 级，第 4 次不再给", () => {
    expect(hintTierFor(0)).toBe(1);
    expect(hintTierFor(1)).toBe(2);
    expect(hintTierFor(2)).toBe(3);
    expect(hintTierFor(3)).toBeNull();
    expect(hintTierFor(9)).toBeNull();
    expect(isHintExhausted(MAX_HINTS_PER_STEP)).toBe(true);
  });

  it("扣分递增 1 / 3 / 5", () => {
    expect(hintDeductFor(1)).toBe(1);
    expect(hintDeductFor(2)).toBe(3);
    expect(hintDeductFor(3)).toBe(5);
    expect(HINT_DEDUCT).toEqual({ 1: 1, 2: 3, 3: 5 });
    expect(hintDeductFor(0)).toBe(0);
    expect(hintDeductFor(4)).toBe(0);
  });

  it("档位对应 definition 的 h0 / h1 / h2", () => {
    expect(hintIndexFor(1)).toBe(0);
    expect(hintIndexFor(2)).toBe(1);
    expect(hintIndexFor(3)).toBe(2);
  });
});
