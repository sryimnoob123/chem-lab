import { describe, expect, it } from "vitest";
import { glassCrackPaths } from "./crack-geometry";

const BOUNDS = { left: 28, right: 132, top: 44, bottom: 186 };

function points(path: string): [number, number][] {
  const nums = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

describe("glassCrackPaths（B5 裂纹沿器皿几何）", () => {
  it("8 条裂纹，全部从撞击点起、至少两段折线", () => {
    const paths = glassCrackPaths(80, 120, BOUNDS);
    expect(paths).toHaveLength(8);
    for (const path of paths) {
      expect(path.startsWith("M80 120")).toBe(true);
      expect(path.split("L").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("端点落在器身包围盒附近（不飘到器外）", () => {
    const paths = glassCrackPaths(80, 120, BOUNDS);
    for (const path of paths) {
      const pts = points(path);
      const [x, y] = pts[pts.length - 1];
      // 折转会让末点略微拐向边界内侧/外侧，容差 14 单位
      expect(x).toBeGreaterThan(BOUNDS.left - 14);
      expect(x).toBeLessThan(BOUNDS.right + 14);
      expect(y).toBeGreaterThan(BOUNDS.top - 14);
      expect(y).toBeLessThan(BOUNDS.bottom + 14);
    }
  });

  it("撞击点靠右壁时，向右的裂纹自然变短（长度由几何决定）", () => {
    const center = glassCrackPaths(80, 120, BOUNDS);
    const nearRight = glassCrackPaths(126, 120, BOUNDS);
    const totalLength = (paths: string[]) =>
      paths.reduce((sum, path) => {
        const pts = points(path);
        let len = 0;
        for (let i = 1; i < pts.length; i += 1) {
          len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        }
        return sum + len;
      }, 0);
    expect(totalLength(nearRight)).toBeLessThan(totalLength(center));
  });

  it("确定性：同参数两次结果完全一致（截图可复现）", () => {
    expect(glassCrackPaths(80, 120, BOUNDS)).toEqual(glassCrackPaths(80, 120, BOUNDS));
  });
});
