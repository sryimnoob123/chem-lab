import { describe, expect, it } from "vitest";
import {
  MISSION_GUIDE_MAX,
  MISSION_GOALS,
  missionGoal,
  missionGuide,
  missionProgress,
} from "./mission-copy";

const IDS = ["exp01", "exp02", "exp03", "exp04", "exp05", "exp06", "exp07", "exp08", "exp09", "exp10"];

describe("missionGoal", () => {
  it("10 个实验都有一句话目标，且 ≤20 字、不带句末标点", () => {
    for (const id of IDS) {
      const goal = MISSION_GOALS[id];
      expect(goal, id).toBeTruthy();
      expect(goal.length, id).toBeLessThanOrEqual(20);
      expect(/[。；！]$/.test(goal), id).toBe(false);
    }
  });

  it("未知实验按步骤数兜底，不编化学内容", () => {
    expect(missionGoal("exp99", "某实验", 5)).toBe("5 步完成「某实验」");
  });

  it("长标题兜底也会截断", () => {
    const goal = missionGoal("exp99", "一个特别特别特别长的实验标题呀", 3);
    expect(goal.startsWith("3 步完成「")).toBe(true);
    expect(goal.length).toBeLessThanOrEqual(20);
  });
});

describe("missionProgress", () => {
  it("保留 walk-steps 解析用的「第 N/」格式", () => {
    expect(missionProgress(2, 7, "称量")).toBe("第 2/7 步 · 现在该称量了");
    expect(missionProgress(2, 7, "称量")).toMatch(/第\s*2\s*\//);
  });
});

describe("missionGuide", () => {
  it("有提示时用提示，没有时退回本步任务名", () => {
    expect(missionGuide("把锥形瓶放在白纸上", "差减法称 Na₂CO₃")).toBe("把锥形瓶放在白纸上");
    expect(missionGuide(undefined, "差减法称 Na₂CO₃")).toBe("差减法称 Na₂CO₃");
    expect(missionGuide("   ", "差减法称 Na₂CO₃")).toBe("差减法称 Na₂CO₃");
  });

  it(`超长一律压到 ${MISSION_GUIDE_MAX} 字（含省略号）`, () => {
    const long = "先把滴定管洗干净再用待测液润洗三次然后把气泡排干净";
    const guide = missionGuide(long, "洗涤");
    expect(guide.length).toBe(MISSION_GUIDE_MAX);
    expect(guide.endsWith("…")).toBe(true);
  });
});
